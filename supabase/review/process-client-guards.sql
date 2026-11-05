create or replace function raia_private.raia_process_client_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changed_order jsonb;
begin
  if new.payload->'processes' is distinct from old.payload->'processes' then
    if not exists(select 1 from public.raia_profiles where id=auth.uid() and role='admin' and active and deleted_at is null) then
      raise exception 'ADMIN_REQUIRED_FOR_SETTINGS';
    end if;
    if jsonb_typeof(new.payload->'processes') is distinct from 'array' then raise exception 'INVALID_PROCESSES'; end if;
    if jsonb_array_length(new.payload->'processes') not between 1 and 200 then raise exception 'INVALID_PROCESSES'; end if;
    if exists(select 1 from jsonb_array_elements(new.payload->'processes') p where
      jsonb_typeof(p->'id') is distinct from 'string' or length(p->>'id') not between 1 and 100 or
      jsonb_typeof(p->'label') is distinct from 'string' or length(trim(p->>'label')) not between 1 and 80 or
      jsonb_typeof(p->'active') is distinct from 'boolean' or
      coalesce(p->>'background','') !~ '^#[0-9A-Fa-f]{6}$' or
      coalesce(p->>'foreground','') !~ '^#[0-9A-Fa-f]{6}$') then raise exception 'INVALID_PROCESSES'; end if;
    if not exists(select 1 from jsonb_array_elements(new.payload->'processes') p where (p->>'active')::boolean) or
      (select count(*)<>count(distinct p->>'id') from jsonb_array_elements(new.payload->'processes') p) or
      (select count(*)<>count(distinct lower(trim(p->>'label'))) from jsonb_array_elements(new.payload->'processes') p where (p->>'active')::boolean)
      then raise exception 'INVALID_PROCESSES'; end if;
  end if;

  for changed_order in
    select n from jsonb_array_elements(new.payload->'orders') n
    join jsonb_array_elements(old.payload->'orders') o on o->>'id'=n->>'id'
    where n->>'clientId' is distinct from o->>'clientId'
  loop
    if not exists(select 1 from jsonb_array_elements(new.payload->'clients') c where c->>'id'=changed_order->>'clientId') then raise exception 'CLIENT_NOT_FOUND'; end if;
    if exists(select 1 from public.raia_fic_deliveries d where d.order_id=changed_order->>'id' and d.status in ('creating','reconcile')) or
       exists(select 1 from public.raia_fic_ddts d where d.order_id=changed_order->>'id' and d.status in ('creating','reconcile')) or
       exists(select 1 from public.raia_fic_invoices f where f.status in ('creating','reconcile') and exists(select 1 from jsonb_array_elements(changed_order->'lines') l where f.work_ids ? (l->>'id')))
    then raise exception 'DOCUMENT_IN_PROGRESS'; end if;
  end loop;
  return new;
end $$;
revoke all on function raia_private.raia_process_client_guard() from public,anon,authenticated;
create trigger raia_process_client_guard before update on public.raia_workspace
for each row execute function raia_private.raia_process_client_guard();
