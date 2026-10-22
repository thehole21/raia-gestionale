-- Only staff accounts created in Settings populate selectable operators.
-- Historical labels remain separate from assignable accounts.
alter table public.raia_profiles add column if not exists deleted_at timestamptz;

create or replace function raia_private.raia_normalize_operators()
returns trigger language plpgsql security definer set search_path='' as $$
declare staff jsonb; history jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name),'[]'::jsonb)
 into staff from public.raia_profiles p
 where p.active and p.deleted_at is null and p.role in ('admin','operator') and p.title is distinct from 'Tecnico';
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by id),'[]'::jsonb) into history
 from (
  select distinct on (o->>'id') o->>'id' id,o->>'name' name
  from jsonb_array_elements(
   coalesce(old.payload->'operatorHistory','[]')||coalesce(old.payload->'operators','[]')||
   coalesce(new.payload->'operators','[]')||coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.raia_profiles p),'[]')
  ) with ordinality e(o,seq)
  where coalesce(o->>'id','')<>'' order by o->>'id',seq desc
 ) labels;
 new.payload:=jsonb_set(jsonb_set(new.payload,'{operators}',staff),'{operatorHistory}',history);
 return new;
end $$;
revoke all on function raia_private.raia_normalize_operators() from public,anon,authenticated;
create trigger raia_assignable_staff before update on public.raia_workspace
for each row execute function raia_private.raia_normalize_operators();

create or replace function raia_private.raia_sync_staff()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- The workspace trigger rebuilds the list and saves historical display names.
 update public.raia_workspace set revision=revision+1 where id=1;
 return new;
end $$;
-- Rebuild once; do not modify orders, profiles, customers or their access.
update public.raia_workspace set revision=revision+1 where id=1;
