create table public.raia_fic_documents (
 id uuid primary key, company_id bigint not null, source_id bigint, target_type text not null,
 status text not null check(status in ('prepared','creating','created','failed','reconcile','removed')),
 source_fingerprint text, request_data jsonb not null, options jsonb not null default '{}',
 work_ids jsonb not null default '[]', workspace_revision integer,
 remote_id bigint, remote_number text, created_by uuid not null references public.raia_profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.raia_fic_documents enable row level security;
revoke all on public.raia_fic_documents from anon,authenticated;
grant all on public.raia_fic_documents to service_role;
create index raia_fic_documents_company_recent on public.raia_fic_documents(company_id,created_at desc);
create unique index raia_fic_documents_transformation on public.raia_fic_documents(company_id,source_id,target_type) where source_id is not null and status in ('creating','created','reconcile');
create or replace function public.raia_claim_document(operation_id uuid,actor_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare op public.raia_fic_documents; ws public.raia_workspace;
begin
 if not exists(select 1 from public.raia_profiles where id=actor_id and role='admin' and active and deleted_at is null) then raise exception 'ADMIN_REQUIRED'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_documents where id=operation_id for update;
 if not found or op.created_by<>actor_id or op.status<>'prepared' or op.created_at<now()-interval '15 minutes' then raise exception 'PREVIEW_EXPIRED_OR_ALREADY_USED'; end if;
 if jsonb_array_length(op.work_ids)>0 then
  if op.workspace_revision<>ws.revision then raise exception 'WORKSPACE_CHANGED'; end if;
  if op.target_type='invoice' then
   if exists(select 1 from public.raia_fic_invoices f where f.status in ('creating','created','reconcile') and exists(select 1 from jsonb_array_elements_text(f.work_ids) w(value) where op.work_ids ? w.value)) then raise exception 'INVOICE_IN_PROGRESS'; end if;
   if exists(select 1 from jsonb_array_elements(ws.payload->'orders') o cross join lateral jsonb_array_elements(o->'lines') l where op.work_ids ? (l->>'id') and (nullif(l->>'invoiceId','') is not null or lower(l->'production'->>'invoicing') in ('si','sì','true'))) then raise exception 'ALREADY_BILLED'; end if;
   if exists(select 1 from public.raia_fic_documents d where d.id<>op.id and d.target_type='invoice' and d.status in ('creating','reconcile') and exists(select 1 from jsonb_array_elements_text(d.work_ids) w where op.work_ids ? w)) then raise exception 'INVOICE_IN_PROGRESS'; end if;
  end if;
 end if;
 update public.raia_fic_documents set status='creating',updated_at=now() where id=op.id;
end $$;
create or replace function public.raia_finish_document(operation_id uuid,document_id bigint,document_number text,actor_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare op public.raia_fic_documents; ws public.raia_workspace; draft_id text; client_id text; orders jsonb; draft jsonb;
begin
 if not exists(select 1 from public.raia_profiles where id=actor_id and role='admin' and active and deleted_at is null) then raise exception 'ADMIN_REQUIRED'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_documents where id=operation_id for update;
 if not found or op.status not in ('creating','reconcile','created') or document_id<=0 or (op.remote_id is not null and op.remote_id<>document_id) then raise exception 'INVALID_OPERATION'; end if;
 if op.status='created' then return; end if;
 if op.target_type='invoice' and jsonb_array_length(op.work_ids)>0 then
  draft_id:='ficdoc_'||op.id::text;
  if (select count(*) from jsonb_array_elements(ws.payload->'orders') o cross join lateral jsonb_array_elements(o->'lines') l where op.work_ids ? (l->>'id'))<>jsonb_array_length(op.work_ids) then raise exception 'WORK_MISSING'; end if;
  if exists(select 1 from jsonb_array_elements(ws.payload->'orders') o cross join lateral jsonb_array_elements(o->'lines') l where op.work_ids ? (l->>'id') and nullif(l->>'invoiceId','') is not null) then raise exception 'WORK_ALREADY_LINKED'; end if;
  select o->>'clientId' into client_id from jsonb_array_elements(ws.payload->'orders') o cross join lateral jsonb_array_elements(o->'lines') l where op.work_ids ? (l->>'id') limit 1;
  draft:=jsonb_build_object('id',draft_id,'number',document_number,'clientId',client_id,'created',op.request_data->>'date','workIds',op.work_ids,'status','created','remoteDocumentId',document_id,'remoteCompanyId',op.company_id,'remoteNumber',document_number);
  insert into public.raia_fic_invoices(draft_id,company_id,work_ids,status,remote_id,remote_number,request_data,created_by) values(draft_id,op.company_id,op.work_ids,'created',document_id,document_number,op.request_data,actor_id);
  select jsonb_agg(jsonb_set(o,'{lines}',(select jsonb_agg(case when op.work_ids ? (l->>'id') then l||jsonb_build_object('invoiceId',draft_id) else l end order by k) from jsonb_array_elements(o->'lines') with ordinality e(l,k))) order by n) into orders from jsonb_array_elements(ws.payload->'orders') with ordinality e(o,n);
  update public.raia_workspace set payload=jsonb_set(jsonb_set(payload,'{orders}',orders),'{drafts}',coalesce(payload->'drafts','[]')||jsonb_build_array(draft)),revision=revision+1 where id=1;
  insert into public.raia_audit(actor,revision) values(actor_id,ws.revision+1);
 end if;
 update public.raia_fic_documents set status='created',remote_id=document_id,remote_number=document_number,updated_at=now() where id=op.id;
end $$;
revoke all on function public.raia_claim_document(uuid,uuid) from public,anon,authenticated;
revoke all on function public.raia_finish_document(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.raia_claim_document(uuid,uuid) to service_role;
grant execute on function public.raia_finish_document(uuid,bigint,text,uuid) to service_role;

-- Shared lock prevents old invoice flow and new transformation flow billing the same work.
create function raia_private.raia_document_invoice_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('creating','created','reconcile') and exists(select 1 from public.raia_fic_documents d where d.target_type='invoice' and d.status in ('creating','reconcile') and new.draft_id<>'ficdoc_'||d.id::text and exists(select 1 from jsonb_array_elements_text(d.work_ids) w(value) where new.work_ids ? w.value)) then raise exception 'DOCUMENT_IN_PROGRESS'; end if;
 return new;
end $$;
revoke all on function raia_private.raia_document_invoice_guard() from public,anon,authenticated;
create trigger raia_document_invoice_guard before insert or update on public.raia_fic_invoices for each row execute function raia_private.raia_document_invoice_guard();
create function raia_private.raia_document_workspace_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.raia_fic_documents d cross join lateral jsonb_array_elements_text(d.work_ids) w(value) where d.status in ('creating','reconcile') and d.target_type='invoice' and not exists(select 1 from jsonb_array_elements(new.payload->'orders') o cross join lateral jsonb_array_elements(o->'lines') l where l->>'id'=w.value and (nullif(l->>'invoiceId','') is null or l->>'invoiceId'='ficdoc_'||d.id::text))) then raise exception 'DOCUMENT_IN_PROGRESS'; end if;
 return new;
end $$;
revoke all on function raia_private.raia_document_workspace_guard() from public,anon,authenticated;
create trigger raia_document_workspace_guard before update on public.raia_workspace for each row execute function raia_private.raia_document_workspace_guard();
