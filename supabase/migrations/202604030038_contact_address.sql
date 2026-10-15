alter table public.contacts
  add column address text,
  add constraint contacts_address_length check (address is null or char_length(address) <= 500);

grant update (address) on public.contacts to authenticated;
