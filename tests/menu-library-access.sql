-- Administrator regression checks; all test data rolls back.
begin;
do $$
declare manager uuid:=gen_random_uuid(); member uuid:=gen_random_uuid(); folder uuid; original timestamptz; blocked boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(manager,'bic-test-'||manager::text||'@example.invalid',now()),(member,'bic-test-'||member::text||'@example.invalid',now());
 insert into public.songbook_members(user_id,role) values(manager,'manager'),(member,'viewer');
 insert into public.songbook_handles(user_id,handle) values(member,'t_'||substr(replace(member::text,'-',''),1,20));
 perform set_config('request.jwt.claim.sub',member::text,true);
 blocked:=false;begin perform * from public.list_songbook_accounts_with_ids();exception when others then blocked:=true;end;
 if not blocked then raise exception 'Member could list accounts';end if;
 perform set_config('request.jwt.claim.sub',manager::text,true);
 if not exists(select 1 from public.list_songbook_accounts_with_ids() where email='bic-test-'||member::text||'@example.invalid' and handle='t_'||substr(replace(member::text,'-',''),1,20)) then raise exception 'Manager could not see ID';end if;
 insert into public.songbook_folders(owner_id,name,created_at,updated_at) values(manager,'Test folder','2000-01-01','2000-01-01') returning id,created_at into folder,original;
 update public.songbook_folders set name='Renamed',created_at='2010-01-01' where id=folder;
 if (select created_at from public.songbook_folders where id=folder) is distinct from original then raise exception 'Added date changed';end if;
 if (select updated_at from public.songbook_folders where id=folder)<='2000-01-01'::timestamptz then raise exception 'Edit date not tracked';end if;
 if has_function_privilege('anon','public.list_songbook_accounts_with_ids()','execute') then raise exception 'Anonymous account-list privilege';end if;
end $$;
rollback;
