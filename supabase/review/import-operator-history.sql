CREATE OR REPLACE FUNCTION raia_private.raia_normalize_operators()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   coalesce(new.payload->'operatorHistory','[]')||coalesce(new.payload->'operators','[]')||coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name)) from public.raia_profiles p),'[]')
  ) with ordinality e(o,seq)
  where coalesce(o->>'id','')<>'' order by o->>'id',seq desc
 ) labels;
 new.payload:=jsonb_set(jsonb_set(new.payload,'{operators}',staff),'{operatorHistory}',history);
 return new;
end $function$;
