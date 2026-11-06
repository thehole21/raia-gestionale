begin;
select set_config('raia.test.quotes',(select count(*)::text from public.raia_quotes),true);
select set_config('raia.test.staff',(select id::text from public.raia_profiles where active and deleted_at is null limit 1),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $test$ begin
 if exists(select 1 from public.raia_quotes) then raise exception 'CUSTOMER_QUOTES_LEAK'; end if;
 if exists(select 1 from storage.objects where bucket_id='raia-customer-files') then raise exception 'CUSTOMER_PDFS_LEAK'; end if;
 if has_table_privilege('authenticated','raia_private.archived_portal_customers','SELECT') then raise exception 'ARCHIVE_LEAK'; end if;
 begin
  perform public.raia_submit_staff_quote(gen_random_uuid(),'{}',null,null,'',null);
  raise exception 'CUSTOMER_SUBMITTED';
 exception when raise_exception then
  if sqlerrm <> 'FORBIDDEN' then raise; end if;
 end;
end $test$;
select set_config('request.jwt.claim.sub',current_setting('raia.test.staff'),true);
do $test$ begin
 if (select count(*) from public.raia_quotes)<>current_setting('raia.test.quotes')::int then raise exception 'STAFF_CANNOT_READ'; end if;
 if to_regprocedure('public.raia_submit_quote(uuid,jsonb,text,text)') is not null then raise exception 'PORTAL_STILL_EXISTS'; end if;
end $test$;
reset role;
select 'PASS: customer denied, staff retained, archive inaccessible, public submission removed' as result;
rollback;
