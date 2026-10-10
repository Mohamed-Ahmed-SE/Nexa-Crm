alter table public.profiles
  add column date_format text not null default 'MM/DD/YYYY'
  check (date_format in ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'));
