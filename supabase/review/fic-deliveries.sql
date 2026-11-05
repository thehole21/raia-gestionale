-- Multiple deliveries per order. Legacy whole-order DDT records stay intact.
create table public.raia_fic_deliveries (
 id text primary key, order_id text not null, work_ids jsonb not null,
 company_id bigint not null, status text not null check(status in ('creating','created','failed','reconcile')),
 remote_id bigint, remote_number text, request_data jsonb not null,
 created_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create index raia_fic_deliveries_order on public.raia_fic_deliveries(order_id);
alter table public.raia_fic_deliveries enable row level security;
revoke all on public.raia_fic_deliveries from anon,authenticated;
grant select on public.raia_fic_deliveries to authenticated;
grant all on public.raia_fic_deliveries to service_role;
create policy delivery_staff_read on public.raia_fic_deliveries for select to authenticated using(exists(select 1 from public.raia_profiles where id=(select auth.uid()) and role in ('admin','operator') and active and deleted_at is null));

create function raia_private.raia_claim_delivery(operation_id text,target_order text,selected_ids jsonb,expected_revision integer,target_company bigint,document_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ws public.raia_workspace; o jsonb; op public.raia_fic_deliveries;
begin
 if not exists(select 1 from public.raia_profiles where id=auth.uid() and role in ('admin','operator') and active and deleted_at is null) then raise exception 'FORBIDDEN'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_deliveries where id=operation_id;
 if found then return jsonb_build_object('claimed',false); end if;
 if operation_id is null or length(operation_id)>100 or ws.revision<>expected_revision then raise exception 'CONFLICT'; end if;
 if not exists(select 1 from public.raia_fic_connection where id=1 and company_id=target_company) then raise exception 'COMPANY_CHANGED'; end if;
 select value into o from jsonb_array_elements(ws.payload->'orders') where value->>'id'=target_order;
 if o is null or coalesce(o->'ddt'->>'number','')<>'' then raise exception 'LEGACY_DDT_OR_ORDER_MISSING'; end if;
 if jsonb_typeof(selected_ids) is distinct from 'array' then raise exception 'INVALID_SELECTION'; end if;
 if jsonb_array_length(selected_ids)=0 or jsonb_array_length(selected_ids)<>(select count(distinct value) from jsonb_array_elements_text(selected_ids)) then raise exception 'INVALID_SELECTION'; end if;
 if exists(select 1 from jsonb_array_elements_text(selected_ids) s where not exists(select 1 from jsonb_array_elements(o->'lines') l where l->>'id'=s.value)) then raise exception 'UNKNOWN_WORK'; end if;
 if exists(select 1 from jsonb_array_elements(o->'lines') l where selected_ids ? (l->>'id') and (coalesce(l->'ddt'->>'number','')<>'' or coalesce(l->'production'->>'ddtNumber','')<>'')) then raise exception 'WORK_HAS_DDT'; end if;
 if exists(select 1 from public.raia_fic_deliveries d where d.order_id=target_order and d.status<>'failed' and exists(select 1 from jsonb_array_elements_text(selected_ids) s where d.work_ids ? s.value)) or exists(select 1 from public.raia_fic_ddts where order_id=target_order and status<>'failed') then raise exception 'WORK_ALREADY_RESERVED'; end if;
 insert into public.raia_fic_deliveries(id,order_id,work_ids,company_id,status,request_data,created_by) values(operation_id,target_order,selected_ids,target_company,'creating',document_data,auth.uid());
 return jsonb_build_object('claimed',true);
end $$;

create function raia_private.raia_finish_delivery(operation_id text,document_id bigint,document_number text) returns void language plpgsql security definer set search_path='' as $$
declare ws public.raia_workspace; op public.raia_fic_deliveries; orders jsonb; note jsonb;
begin
 if not exists(select 1 from public.raia_profiles where id=auth.uid() and role in ('admin','operator') and active and deleted_at is null) then raise exception 'FORBIDDEN'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_deliveries where id=operation_id for update;
 -- Only the server can persist the remote ID, never accept a fabricated document from the browser.
 if not found or op.remote_id is distinct from document_id or document_id<=0 or op.remote_number is distinct from document_number then raise exception 'INVALID_OPERATION'; end if;
 if not exists(select 1 from jsonb_array_elements(ws.payload->'orders') o where o->>'id'=op.order_id) then raise exception 'ORDER_MISSING'; end if;
 if exists(select 1 from jsonb_array_elements(ws.payload->'orders') o, jsonb_array_elements(coalesce(o->'deliveryNotes','[]')) d where o->>'id'=op.order_id and d->>'id'=operation_id) then return; end if;
 note=jsonb_build_object('id',operation_id,'workIds',op.work_ids,'number',document_number,'date',op.request_data->>'date','remoteDocumentId',document_id,'remoteCompanyId',op.company_id);
 select jsonb_agg(case when o->>'id'=op.order_id then o||jsonb_build_object('deliveryNotes',coalesce(o->'deliveryNotes','[]')||jsonb_build_array(note),'lines',(select jsonb_agg(case when op.work_ids ? (l->>'id') then l||jsonb_build_object('ddt',note)||case when jsonb_typeof(l->'production')='object' then jsonb_build_object('production',(l->'production')||jsonb_build_object('ddtNumber',document_number)) else '{}'::jsonb end else l end order by ln) from jsonb_array_elements(o->'lines') with ordinality x(l,ln))) else o end order by n) into orders from jsonb_array_elements(ws.payload->'orders') with ordinality e(o,n);
 update public.raia_fic_deliveries set status='created',updated_at=now() where id=operation_id;
 update public.raia_workspace set payload=jsonb_set(payload,'{orders}',orders),revision=revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(auth.uid(),ws.revision+1);
end $$;
revoke all on function raia_private.raia_claim_delivery(text,text,jsonb,integer,bigint,jsonb),raia_private.raia_finish_delivery(text,bigint,text) from public,anon;
grant execute on function raia_private.raia_claim_delivery(text,text,jsonb,integer,bigint,jsonb),raia_private.raia_finish_delivery(text,bigint,text) to authenticated;
create function public.raia_claim_delivery(operation_id text,target_order text,selected_ids jsonb,expected_revision integer,target_company bigint,document_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select raia_private.raia_claim_delivery(operation_id,target_order,selected_ids,expected_revision,target_company,document_data) $$;
create function public.raia_finish_delivery(operation_id text,document_id bigint,document_number text) returns void language sql security invoker set search_path='' as $$ select raia_private.raia_finish_delivery(operation_id,document_id,document_number) $$;
revoke all on function public.raia_claim_delivery(text,text,jsonb,integer,bigint,jsonb),public.raia_finish_delivery(text,bigint,text) from public,anon;
grant execute on function public.raia_claim_delivery(text,text,jsonb,integer,bigint,jsonb),public.raia_finish_delivery(text,bigint,text) to authenticated;
