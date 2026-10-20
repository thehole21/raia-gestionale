begin;
select set_config('raia.test.customer',gen_random_uuid()::text,true),set_config('raia.test.other',gen_random_uuid()::text,true),set_config('raia.test.quote',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
values(current_setting('raia.test.customer')::uuid,'portal-test@example.invalid',now(),'{"raia_customer":true,"customer":{"name":"RAIA test temporaneo","city":"Roma","address":"Test","phone":"000","postalCode":"00100","country":"IT"}}'),
(current_setting('raia.test.other')::uuid,'portal-other@example.invalid',now(),'{"raia_customer":true,"customer":{"name":"RAIA secondo test"}}');
insert into storage.objects(bucket_id,name,metadata) values
('raia-customer-files',current_setting('raia.test.customer')||'/test/book.pdf','{"mimetype":"application/pdf","size":100}'),
('raia-customer-files',current_setting('raia.test.customer')||'/test/cover.pdf','{"mimetype":"application/pdf","size":100}');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('raia.test.customer'),true);
do $$
declare q uuid;
begin
 if (select count(*) from public.raia_workspace)<>0 then raise exception 'TEST_CUSTOMER_WORKSPACE_LEAK'; end if;
 if (select count(*) from public.raia_customers)<>1 then raise exception 'TEST_CUSTOMER_ISOLATION'; end if;
 if raia_private.raia_role() is not null then raise exception 'TEST_CUSTOMER_STAFF_ROLE'; end if;
 q:=public.raia_submit_quote(current_setting('raia.test.quote')::uuid,'{"title":"Libro test","pages":100,"copies":10,"paperWeight":80,"format":"A5","paper":"Uso mano","print":"Bianco e nero","colorPages":0,"cover":"Morbida"}',current_setting('raia.test.customer')||'/test/book.pdf',current_setting('raia.test.customer')||'/test/cover.pdf');
 perform public.raia_submit_quote(q,'{}','','');
 if (select count(*) from public.raia_quotes)<>1 then raise exception 'TEST_DUPLICATE'; end if;
 begin
  perform public.raia_manage_quote(q,true,'','');
  raise exception 'TEST_CUSTOMER_CONFIRM_ALLOWED';
 exception when others then
  if sqlerrm<>'FORBIDDEN' then raise; end if;
 end;
 if has_function_privilege('authenticated','public.raia_tracking_event(text,text,uuid,text,text,timestamptz)','execute') then raise exception 'TEST_TRACKING_PRIVILEGE'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('raia.test.other'),true);
do $$ begin
 if (select count(*) from public.raia_quotes)<>0 then raise exception 'TEST_OTHER_QUOTES_LEAK'; end if;
 if (select count(*) from storage.objects where bucket_id='raia-customer-files')<>0 then raise exception 'TEST_OTHER_FILES_LEAK'; end if;
 begin
  perform public.raia_submit_quote(current_setting('raia.test.quote')::uuid,'{}','','');
  raise exception 'TEST_OTHER_RETRY_ALLOWED';
 exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from public.raia_profiles where role='admin' and active limit 1),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.raia_workspace,jsonb_array_elements(payload->'orders') o where o->>'customerRequestId'=current_setting('raia.test.quote'))<>1 then raise exception 'TEST_ORDER_MISSING_OR_DUPLICATE'; end if;
 perform public.raia_manage_quote(current_setting('raia.test.quote')::uuid,true,'test-carrier','TRACK-123');
 if (select status from public.raia_quotes where id=current_setting('raia.test.quote')::uuid)<>'confirmed' then raise exception 'TEST_CONFIRM'; end if;
end $$;
reset role;
set local role service_role;
select public.raia_tracking_event('test-carrier','event-1',current_setting('raia.test.quote')::uuid,'TRACK-123','shipped',now()-interval '1 minute');
select public.raia_tracking_event('test-carrier','event-2',current_setting('raia.test.quote')::uuid,'TRACK-123','delivered',now());
select public.raia_tracking_event('test-carrier','event-2',current_setting('raia.test.quote')::uuid,'TRACK-123','delivered',now());
select public.raia_tracking_event('test-carrier','event-3',current_setting('raia.test.quote')::uuid,'TRACK-123','shipped',now()-interval '2 minutes');
do $$ begin
 if (select status from public.raia_quotes where id=current_setting('raia.test.quote')::uuid)<>'delivered' then raise exception 'TEST_TRACKING_REGRESSION'; end if;
 if (select count(*) from public.raia_tracking_events where quote_id=current_setting('raia.test.quote')::uuid)<>3 then raise exception 'TEST_TRACKING_DUPLICATE'; end if;
end $$;
reset role;

reset role;
insert into public.raia_profiles(id,name,email,role,active) values(current_setting('raia.test.other')::uuid,'Titolare test','portal-other@example.invalid','admin',true);
do $$ begin
 if not exists(select 1 from public.raia_workspace,jsonb_array_elements(payload->'operators') o where o->>'id'=current_setting('raia.test.other')) then raise exception 'ADMIN_NOT_ASSIGNABLE'; end if;
 if exists(select 1 from public.raia_workspace,jsonb_array_elements(payload->'operators') o join public.raia_profiles p on p.id::text=o->>'id' where p.title='Tecnico') then raise exception 'TECHNICIAN_ASSIGNABLE'; end if;
end $$;
set local role service_role;
select public.raia_delete_order('web_'||current_setting('raia.test.quote'),current_setting('raia.test.other')::uuid,(select revision from public.raia_workspace where id=1));
do $$ begin
 if (select status from public.raia_quotes where id=current_setting('raia.test.quote')::uuid)<>'cancelled' then raise exception 'CANCELLATION_NOT_PROPAGATED'; end if;
 if not exists(select 1 from public.raia_deleted_orders where order_id='web_'||current_setting('raia.test.quote') and actor_name='Titolare test' and client_data->>'name'='RAIA test temporaneo') then raise exception 'ARCHIVE_DETAILS_MISSING'; end if;
 begin
 perform public.raia_tracking_event('test-carrier','late-event',current_setting('raia.test.quote')::uuid,'TRACK-123','shipped',now());
 raise exception 'CANCELLED_TRACKING_ALLOWED';
 exception when others then if sqlerrm<>'TRACKING_MISMATCH' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('raia.test.other'),true);
set local role authenticated;
do $$ begin
 begin
 perform public.raia_manage_quote(current_setting('raia.test.quote')::uuid,true,'test-carrier','TRACK-123');
 raise exception 'CANCELLED_CONFIRM_ALLOWED';
 exception when others then if sqlerrm<>'NOT_FOUND' then raise; end if; end;
 if not exists(select 1 from public.raia_deleted_orders where order_id='web_'||current_setting('raia.test.quote')) then raise exception 'ARCHIVE_STAFF_READ_FAILED'; end if;
end $$;
reset role;

select 'PASS: cancellation, archive snapshot, admin assignment, technician exclusion, late-event protection;  registration, customer isolation, PDF isolation, idempotent submission, staff confirmation, service-only tracking, duplicate/out-of-order events' as result;
rollback;
