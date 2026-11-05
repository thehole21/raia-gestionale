create or replace function raia_private.raia_normalize_operators()
returns trigger language plpgsql security definer set search_path='' as $$
declare history jsonb;
begin
 if jsonb_typeof(new.payload->'operators') is distinct from 'array' then raise exception 'INVALID_OPERATORS'; end if;
 if exists(select 1 from jsonb_array_elements(new.payload->'operators') o where jsonb_typeof(o->'id') is distinct from 'string' or jsonb_typeof(o->'name') is distinct from 'string' or length(trim(o->>'name')) not between 1 and 120 or coalesce(o->>'id','')='') then raise exception 'INVALID_OPERATORS'; end if;
 if (select count(*)<>count(distinct o->>'id') from jsonb_array_elements(new.payload->'operators') o) then raise exception 'DUPLICATE_OPERATOR'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by id),'[]'::jsonb) into history from (
 select distinct on (o->>'id') o->>'id' id,o->>'name' name from jsonb_array_elements(
 coalesce(old.payload->'operatorHistory','[]')||coalesce(old.payload->'operators','[]')||
 coalesce(new.payload->'operatorHistory','[]')||coalesce(new.payload->'operators','[]')
 ) with ordinality e(o,seq) where coalesce(o->>'id','')<>'' order by o->>'id',seq desc
 ) labels;
 new.payload:=jsonb_set(new.payload,'{operatorHistory}',history);
 return new;
end $$;
revoke all on function raia_private.raia_normalize_operators() from public,anon,authenticated;
