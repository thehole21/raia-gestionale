create or replace function public.raia_finish_fic_invoice(target_draft text,document_id bigint,document_number text)
returns void language plpgsql security definer set search_path='' as $$
declare ws public.raia_workspace; op public.raia_fic_invoices; drafts jsonb;
begin
 if raia_private.raia_role() is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;
 if document_id<=0 then raise exception 'INVALID_DOCUMENT'; end if;
 select * into ws from public.raia_workspace where id=1 for update;
 select * into op from public.raia_fic_invoices where draft_id=target_draft for update;
 if not found or (op.remote_id is not null and op.remote_id<>document_id) then raise exception 'INVALID_OPERATION'; end if;
 update public.raia_fic_invoices set status='created',remote_id=document_id,remote_number=document_number,updated_at=now() where draft_id=target_draft;
 if exists(select 1 from jsonb_array_elements(ws.payload->'drafts') d where d->>'id'=target_draft and d->>'remoteDocumentId'=document_id::text and d->>'status'='created') then return; end if;
 select jsonb_agg(case when d->>'id'=target_draft then d||jsonb_build_object('status','created','remoteDocumentId',document_id,'remoteCompanyId',op.company_id,'remoteNumber',document_number) else d end order by n) into drafts from jsonb_array_elements(ws.payload->'drafts') with ordinality e(d,n);
 if not exists(select 1 from jsonb_array_elements(ws.payload->'drafts') d where d->>'id'=target_draft) then raise exception 'DRAFT_MISSING'; end if;
 update public.raia_workspace set payload=jsonb_set(payload,'{drafts}',drafts),revision=revision+1 where id=1;
 insert into public.raia_audit(actor,revision) values(auth.uid(),ws.revision+1);
end $$;
revoke all on function public.raia_finish_fic_invoice(text,bigint,text) from public,anon;
grant execute on function public.raia_finish_fic_invoice(text,bigint,text) to authenticated;


create function raia_private.raia_preserve_fic_drafts() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.raia_fic_invoices f where f.status in ('creating','created','reconcile')
 and not exists(select 1 from jsonb_array_elements(new.payload->'drafts') d where d->>'id'=f.draft_id and d->'workIds'=f.work_ids)) then raise exception 'FIC_DRAFT_LOCKED'; end if;
 return new;
end $$;
revoke all on function raia_private.raia_preserve_fic_drafts() from public,anon,authenticated;
create trigger raia_preserve_fic_drafts before update on public.raia_workspace for each row execute function raia_private.raia_preserve_fic_drafts();
