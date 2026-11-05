-- Already applied: fic_service_access_and_settings_guard
grant all on public.raia_fic_connection to service_role;
create or replace function raia_private.raia_admin_settings_only()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if raia_private.raia_role() is distinct from 'admin' and (
 new.payload->'technicalFields' is distinct from old.payload->'technicalFields' or
 new.payload->'ddtIssuer' is distinct from old.payload->'ddtIssuer' or
 new.payload->'operators' is distinct from old.payload->'operators' or
 new.payload->'clientHistory' is distinct from old.payload->'clientHistory')
 then raise exception 'ADMIN_REQUIRED_FOR_SETTINGS'; end if;
 return new;
end $$;
drop trigger if exists raia_admin_settings_only on public.raia_workspace;
create trigger raia_admin_settings_only before update on public.raia_workspace
for each row execute function raia_private.raia_admin_settings_only();
