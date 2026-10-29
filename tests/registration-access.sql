-- Regression checks for a configured test/live database; everything rolls back.
-- Run through an administrator SQL connection. No real account is changed.
begin;
do $$
declare applicant uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); member uuid:=gen_random_uuid();
 handle_value text:='t_'||substr(replace(gen_random_uuid()::text,'-',''),1,20); old_time timestamptz; new_time timestamptz; blocked boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (applicant,'bic-test-'||applicant::text||'@example.invalid',now()),
 (manager,'bic-test-'||manager::text||'@example.invalid',now()),
 (member,'bic-test-'||member::text||'@example.invalid',now());
 insert into public.songbook_members(user_id,role) values(manager,'manager'),(member,'viewer');
 perform set_config('request.jwt.claim.sub',applicant::text,true);
 if (public.get_songbook_registration()->>'request_status')<>'none' then raise exception 'Initial profile failed';end if;
 blocked:=false;begin perform public.request_songbook_access();exception when others then blocked:=true;end;
 if not blocked then raise exception 'Missing handle accepted';end if;
 perform public.set_songbook_handle(handle_value);
 perform public.request_songbook_access();
 select requested_at into old_time from public.songbook_access_requests where user_id=applicant;
 perform public.request_songbook_access();
 if old_time is distinct from (select requested_at from public.songbook_access_requests where user_id=applicant) then raise exception 'Repeated pending request changed its token';end if;
 blocked:=false;begin perform public.review_songbook_access_request(applicant,'approve',old_time);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Unapproved reviewer allowed';end if;
 perform set_config('request.jwt.claim.sub',member::text,true);
 blocked:=false;begin perform * from public.list_songbook_access_requests();exception when others then blocked:=true;end;
 if not blocked then raise exception 'Member read private queue';end if;
 blocked:=false;begin perform public.set_songbook_handle(handle_value);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Duplicate ID accepted';end if;
 perform set_config('request.jwt.claim.sub',manager::text,true);
 if not exists(select 1 from public.list_songbook_access_requests() where user_id=applicant) then raise exception 'Manager queue missing applicant';end if;
 perform public.review_songbook_access_request(applicant,'decline',old_time);
 if exists(select 1 from public.songbook_members where user_id=applicant) or not exists(select 1 from auth.users where id=applicant) then raise exception 'Decline changed login/access incorrectly';end if;
 perform set_config('request.jwt.claim.sub',applicant::text,true);
 if (public.get_songbook_registration()->>'request_status')<>'declined' then raise exception 'Decline status missing';end if;
 perform public.request_songbook_access();select requested_at into new_time from public.songbook_access_requests where user_id=applicant;
 if new_time=old_time then raise exception 'New request did not get fresh token';end if;
 perform set_config('request.jwt.claim.sub',manager::text,true);
 blocked:=false;begin perform public.review_songbook_access_request(applicant,'approve',old_time);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Stale decision accepted';end if;
 perform public.review_songbook_access_request(applicant,'approve',new_time);
 if (select role from public.songbook_members where user_id=applicant)<>'viewer' then raise exception 'Approval gave wrong role';end if;
 if exists(select 1 from public.list_songbook_access_requests() where user_id=applicant) then raise exception 'Approved request still pending';end if;
 insert into public.songbook_access_requests(user_id) values(manager);
 blocked:=false;begin perform public.review_songbook_access_request(manager,'decline',(select requested_at from public.songbook_access_requests where user_id=manager));exception when others then blocked:=true;end;
 if not blocked or (select role from public.songbook_members where user_id=manager)<>'manager' then raise exception 'Existing manager was changed';end if;
 if has_function_privilege('anon','public.list_songbook_access_requests()','execute') or has_function_privilege('anon','songbook_private.list_songbook_access_requests()','execute') then raise exception 'Anonymous queue privilege';end if;
 if has_table_privilege('authenticated','public.songbook_access_requests','insert') or has_table_privilege('authenticated','public.songbook_access_requests','update') then raise exception 'Direct request mutation granted';end if;
 if not (select relrowsecurity from pg_class where oid='public.songbook_access_requests'::regclass) then raise exception 'Missing RLS';end if;
end $$;
rollback;
