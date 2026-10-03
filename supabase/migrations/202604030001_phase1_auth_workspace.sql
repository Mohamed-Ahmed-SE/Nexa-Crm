create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  phone text,
  job_title text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique,
  logo_url text,
  default_currency text not null default 'USD',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'deactivated')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_status_idx on public.workspace_members (user_id, status, created_at);
create index workspace_members_workspace_role_idx on public.workspace_members (workspace_id, role, status);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (char_length(trim(email)) between 3 and 254),
  role text not null check (role in ('admin', 'manager', 'member', 'viewer')),
  token_hash text unique,
  invited_by uuid not null references auth.users (id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index workspace_invites_workspace_email_idx on public.workspace_invites (workspace_id, lower(email));
create unique index workspace_invites_pending_email_idx
  on public.workspace_invites (workspace_id, lower(email)) where accepted_at is null;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and wm.role = any (allowed_roles)
  );
$$;

create or replace function public.create_first_workspace(workspace_name text, member_job_title text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_workspace_id uuid := gen_random_uuid();
  clean_name text := trim(workspace_name);
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 0));
  if clean_name is null or char_length(clean_name) not between 2 and 80 then
    raise exception 'Workspace name must be between 2 and 80 characters' using errcode = '22023';
  end if;
  if member_job_title is not null and char_length(trim(member_job_title)) > 100 then
    raise exception 'Job title is too long' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.workspace_members wm
    where wm.user_id = current_user_id and wm.status = 'active'
  ) then
    raise exception 'An active workspace membership already exists' using errcode = '23505';
  end if;

  insert into public.profiles (id, job_title)
  values (current_user_id, nullif(trim(member_job_title), ''))
  on conflict (id) do update
  set job_title = excluded.job_title, updated_at = now();

  insert into public.workspaces (id, name, slug)
  values (
    created_workspace_id,
    clean_name,
    trim(both '-' from regexp_replace(lower(clean_name), '[^a-z0-9]+', '-', 'g')) || '-' || left(created_workspace_id::text, 8)
  );

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (created_workspace_id, current_user_id, 'admin', 'active');

  return created_workspace_id;
end;
$$;

create or replace function public.protect_last_workspace_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.status = 'active'
    and (new.role <> 'admin' or new.status <> 'active') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.workspace_id::text, 1));
    if not exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = old.workspace_id
        and wm.id <> old.id and wm.role = 'admin' and wm.status = 'active'
    ) then
      raise exception 'A workspace must retain an active administrator' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger workspace_members_retain_admin
  before update of role, status on public.workspace_members
  for each row execute function public.protect_last_workspace_admin();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_select_member on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_update_admin on public.workspaces
  for update to authenticated using (public.has_workspace_role(id, array['admin']))
  with check (public.has_workspace_role(id, array['admin']));

create policy workspace_members_select_member on public.workspace_members
  for select to authenticated using (
    user_id = (select auth.uid()) or public.is_workspace_member(workspace_id)
  );
create policy workspace_members_update_admin on public.workspace_members
  for update to authenticated
  using (public.has_workspace_role(workspace_id, array['admin']) and user_id <> (select auth.uid()))
  with check (public.has_workspace_role(workspace_id, array['admin']) and user_id <> (select auth.uid()));

create policy workspace_invites_select_admin on public.workspace_invites
  for select to authenticated using (public.has_workspace_role(workspace_id, array['admin']));
create policy workspace_invites_insert_admin on public.workspace_invites
  for insert to authenticated with check (
    public.has_workspace_role(workspace_id, array['admin']) and invited_by = (select auth.uid())
  );
create policy workspace_invites_update_admin on public.workspace_invites
  for update to authenticated
  using (public.has_workspace_role(workspace_id, array['admin']))
  with check (public.has_workspace_role(workspace_id, array['admin']));
create policy workspace_invites_delete_admin on public.workspace_invites
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['admin']));

revoke all on table public.profiles, public.workspaces, public.workspace_members, public.workspace_invites
  from public, anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant select, update on table public.workspaces to authenticated;
grant select, update on table public.workspace_members to authenticated;
grant select, insert, update, delete on table public.workspace_invites to authenticated;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function public.protect_last_workspace_admin() from public, anon, authenticated;
revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.has_workspace_role(uuid, text[]) from public, anon;
revoke all on function public.create_first_workspace(text, text) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;
grant execute on function public.create_first_workspace(text, text) to authenticated;
