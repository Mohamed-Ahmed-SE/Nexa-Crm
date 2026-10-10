alter table public.saved_views
  drop constraint saved_views_entity_type_check;

alter table public.saved_views
  add constraint saved_views_entity_type_check check (entity_type in ('leads', 'contacts'));
