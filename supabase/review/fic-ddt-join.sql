alter table public.raia_fic_documents add column source_ids jsonb not null default '[]' check(jsonb_typeof(source_ids)='array');
alter table public.raia_fic_documents add column source_fingerprints jsonb not null default '{}';
update public.raia_fic_documents set source_ids=jsonb_build_array(source_id) where source_id is not null;
create function raia_private.raia_document_sources_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.source_id is not null and jsonb_array_length(new.source_ids)=0 then new.source_ids=jsonb_build_array(new.source_id); end if;
 if jsonb_array_length(new.source_ids)>50 or jsonb_array_length(new.source_ids)<>(select count(distinct value) from jsonb_array_elements_text(new.source_ids)) then raise exception 'INVALID_SOURCES'; end if;
 if new.status in ('creating','created','reconcile') and jsonb_array_length(new.source_ids)>0 then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('raia-fic-sources:'||new.company_id::text,0));
  if exists(select 1 from public.raia_fic_documents d where d.id<>new.id and d.company_id=new.company_id and d.target_type=new.target_type and d.status in ('creating','created','reconcile') and exists(select 1 from jsonb_array_elements_text(d.source_ids) a join jsonb_array_elements_text(new.source_ids) b on a.value=b.value)) then raise exception 'SOURCE_ALREADY_IN_USE'; end if;
 end if;
 return new;
end $$;
revoke all on function raia_private.raia_document_sources_guard() from public,anon,authenticated;
create trigger raia_document_sources_guard before insert or update on public.raia_fic_documents for each row execute function raia_private.raia_document_sources_guard();

