create or replace function raia_private.raia_delete_work(target_order_id text,target_work_id text,actor_id uuid,expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare current_row public.raia_workspace; target jsonb; removed jsonb; remaining jsonb; updated_order jsonb;
begin
 if not exists(select 1 from public.raia_profiles p where p.id=actor_id and p.active and p.role in ('admin','operator')) then raise exception 'FORBIDDEN'; end if;
 select * into current_row from public.raia_workspace where id=1 for update;
 if current_row.revision is distinct from expected_revision then raise exception 'CONFLICT'; end if;
 select value into target from jsonb_array_elements(current_row.payload->'orders') where value->>'id'=target_order_id;
 if target is null then raise exception 'NOT_FOUND'; end if;
 select value into removed from jsonb_array_elements(target->'lines') where value->>'id'=target_work_id;
 if removed is null then raise exception 'NOT_FOUND'; end if;
 if removed->>'invoiceId' is not null or exists(select 1 from jsonb_array_elements(current_row.payload->'drafts') d,jsonb_array_elements_text(d->'workIds') wid where wid=target_work_id) then raise exception 'DRAFT_LINKED'; end if;
 if jsonb_array_length(target->'lines')=1 then return raia_private.raia_delete_order(target_order_id,actor_id,expected_revision); end if;
 select jsonb_agg(value order by ordinal) into remaining from jsonb_array_elements(target->'lines') with ordinality as t(value,ordinal) where value->>'id'<>target_work_id;
 insert into public.raia_deleted_orders(order_id,order_data,actor_id) values(target_order_id,jsonb_set(target,'{lines}',jsonb_build_array(removed))||jsonb_build_object('deletionScope','work','originalLineCount',jsonb_array_length(target->'lines')),actor_id);
 updated_order=jsonb_set(target,'{lines}',remaining);
 update public.raia_workspace set payload=jsonb_set(current_row.payload,'{orders}',(select jsonb_agg(case when value->>'id'=target_order_id then updated_order else value end order by ordinal) from jsonb_array_elements(current_row.payload->'orders') with ordinality as t(value,ordinal))),revision=revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(actor_id,current_row.revision+1);
 return current_row.revision+1;
end $$;
revoke all on function raia_private.raia_delete_work(text,text,uuid,integer) from public,anon,authenticated;
grant execute on function raia_private.raia_delete_work(text,text,uuid,integer) to service_role;
create or replace function public.raia_delete_work(target_order_id text,target_work_id text,actor_id uuid,expected_revision integer)
returns integer language sql set search_path='' as $$ select raia_private.raia_delete_work(target_order_id,target_work_id,actor_id,expected_revision) $$;
revoke all on function public.raia_delete_work(text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.raia_delete_work(text,text,uuid,integer) to service_role;
