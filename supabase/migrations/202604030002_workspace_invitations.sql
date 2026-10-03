alter table public.workspace_invites
  add column revoked_at timestamptz;

drop index public.workspace_invites_pending_email_idx;
create unique index workspace_invites_pending_email_idx
  on public.workspace_invites (workspace_id, lower(email))
  where accepted_at is null and revoked_at is null;

drop policy workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_self on public.workspace_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy workspace_members_select_admin on public.workspace_members
  for select to authenticated using (public.has_workspace_role(workspace_id, array['admin']));

revoke all on table public.workspace_invites from public, anon, authenticated;

create or replace function public.create_workspace_invite(
  target_workspace_id uuid,
  invite_email text,
  invite_role text,
  invite_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_email text := lower(btrim(invite_email));
  created_invite_id uuid;
begin
  if current_user_id is null or not public.has_workspace_role(target_workspace_id, array['admin']) then
    raise exception 'Workspace administrator access required' using errcode = '42501';
  end if;
  if normalized_email is null or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_email) > 254 then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;
  if invite_role is null or invite_role not in ('admin', 'manager', 'member', 'viewer') then
    raise exception 'Invalid invitation role' using errcode = '22023';
  end if;
  if invite_token_hash is null or invite_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid invitation token hash' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_workspace_id::text || ':' || normalized_email, 2)
  );

  if exists (
    select 1
    from public.workspace_members wm
    join auth.users u on u.id = wm.user_id
    where wm.workspace_id = target_workspace_id
      and lower(btrim(u.email)) = normalized_email
  ) then
    raise exception 'This account already has a workspace membership' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.workspace_invites wi
    where wi.workspace_id = target_workspace_id
      and lower(wi.email) = normalized_email
      and wi.accepted_at is null and wi.revoked_at is null
  ) then
    raise exception 'A pending invitation already exists' using errcode = '23505';
  end if;

  insert into public.workspace_invites (workspace_id, email, role, token_hash, invited_by)
  values (target_workspace_id, normalized_email, invite_role, invite_token_hash, current_user_id)
  returning id into created_invite_id;
  return created_invite_id;
end;
$$;

create or replace function public.list_workspace_members(target_workspace_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  status text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['admin']) then
    raise exception 'Workspace administrator access required' using errcode = '42501';
  end if;

  return query
  select wm.id, wm.user_id, coalesce(u.email, '')::text,
    coalesce(nullif(p.full_name, ''), split_part(coalesce(u.email, ''), '@', 1)),
    wm.role, wm.status, wm.joined_at
  from public.workspace_members wm
  join auth.users u on u.id = wm.user_id
  left join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = target_workspace_id
  order by wm.joined_at, wm.created_at;
end;
$$;

create or replace function public.list_workspace_invites(target_workspace_id uuid)
returns table (
  invite_id uuid,
  email text,
  role text,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['admin']) then
    raise exception 'Workspace administrator access required' using errcode = '42501';
  end if;

  return query
  select wi.id, wi.email, wi.role, wi.expires_at, wi.accepted_at, wi.revoked_at, wi.created_at
  from public.workspace_invites wi
  where wi.workspace_id = target_workspace_id
  order by wi.created_at desc;
end;
$$;

create or replace function public.revoke_workspace_invite(
  target_workspace_id uuid,
  target_invite_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_workspace_role(target_workspace_id, array['admin']) then
    raise exception 'Workspace administrator access required' using errcode = '42501';
  end if;

  update public.workspace_invites
  set revoked_at = now()
  where id = target_invite_id
    and workspace_id = target_workspace_id
    and accepted_at is null
    and revoked_at is null;
  return found;
end;
$$;

create or replace function public.accept_workspace_invite(invite_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_user_email text;
  pending_invite public.workspace_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sign in to accept this invitation' using errcode = '28000';
  end if;
  if invite_token_hash is null or invite_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation is invalid, expired, or already used' using errcode = '22023';
  end if;

  select wi.* into pending_invite
  from public.workspace_invites wi
  where wi.token_hash = invite_token_hash
  for update;
  if not found or pending_invite.accepted_at is not null
    or pending_invite.revoked_at is not null or pending_invite.expires_at <= now() then
    raise exception 'Invitation is invalid, expired, or already used' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pending_invite.workspace_id::text || ':' || pending_invite.email, 2)
  );
  if pending_invite.expires_at <= now() then
    raise exception 'Invitation is invalid, expired, or already used' using errcode = '22023';
  end if;

  select lower(btrim(u.email)) into normalized_user_email
  from auth.users u where u.id = current_user_id;
  if normalized_user_email is null or normalized_user_email <> pending_invite.email then
    raise exception 'The signed-in email does not match this invitation' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = pending_invite.workspace_id and wm.user_id = current_user_id
  ) then
    raise exception 'This account already has a workspace membership' using errcode = '23514';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (pending_invite.workspace_id, current_user_id, pending_invite.role, 'active');
  update public.workspace_invites
  set accepted_at = now()
  where id = pending_invite.id and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'Invitation is invalid, expired, or already used' using errcode = '22023';
  end if;
  return pending_invite.workspace_id;
end;
$$;

revoke all on function public.create_workspace_invite(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.list_workspace_members(uuid) from public, anon, authenticated;
revoke all on function public.list_workspace_invites(uuid) from public, anon, authenticated;
revoke all on function public.revoke_workspace_invite(uuid, uuid) from public, anon, authenticated;
revoke all on function public.accept_workspace_invite(text) from public, anon, authenticated;
grant execute on function public.create_workspace_invite(uuid, text, text, text) to authenticated;
grant execute on function public.list_workspace_members(uuid) to authenticated;
grant execute on function public.list_workspace_invites(uuid) to authenticated;
grant execute on function public.revoke_workspace_invite(uuid, uuid) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
