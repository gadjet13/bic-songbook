begin;
insert into auth.users(id,email,email_confirmed_at) values('10000000-0000-0000-0000-000000000001','bic-test-sender@example.invalid',now()),('10000000-0000-0000-0000-000000000002','bic-test-recipient@example.invalid',now());
insert into public.songbook_members(user_id,role) values('10000000-0000-0000-0000-000000000001','viewer'),('10000000-0000-0000-0000-000000000002','viewer');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ declare song bigint; list uuid; blocked boolean:=false; begin
 insert into public.shared_songs(title,artist,key,category,content,owner_id) values('Share test','','C','','[Verse]\n{C}Test','10000000-0000-0000-0000-000000000001') returning id into song;
 insert into public.songbook_setlists(title,song_ids,owner_id) values('Share test',array[song,song],'10000000-0000-0000-0000-000000000001') returning id into list;
 perform public.share_setlist(list,'bic-test-recipient@example.invalid');
 if (select jsonb_array_length(songs) from public.songbook_setlist_shares where setlist_id=list)<>2 then raise exception 'Order/duplicates lost'; end if;
 begin perform public.share_setlist(list,'bukchoninternationalchapel@gmail.com'); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Church recipient allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
 if (select count(*) from public.songbook_setlist_shares where title='Share test')<>1 then raise exception 'Recipient missing snapshot'; end if;
 if exists(select 1 from public.shared_songs where owner_id='10000000-0000-0000-0000-000000000001') then raise exception 'Personal library leaked'; end if;
 if exists(select 1 from public.songbook_setlists where owner_id='10000000-0000-0000-0000-000000000001') then raise exception 'Personal setlists leaked'; end if;
end $$;
select set_config('request.jwt.claim.sub','c3db8ecb-a7ce-42cd-a5c1-6a46c25a2df8',true);
do $$ begin if exists(select 1 from public.songbook_setlist_shares where title='Share test') then raise exception 'Unrelated manager sees share'; end if; end $$;
select set_config('request.jwt.claim.sub','09464d2d-669b-4771-aecd-4776b7350b44',true);
do $$ declare blocked boolean:=false; begin
 if exists(select 1 from public.songbook_setlists) or exists(select 1 from public.songbook_setlist_shares) then raise exception 'Church sees setlists'; end if;
 begin insert into public.songbook_setlists(title,song_ids) values('Church blocked','{}'); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Church setlist insert allowed'; end if;
end $$;
select 'sharing permissions passed' as result;
rollback;
