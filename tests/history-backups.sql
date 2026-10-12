begin;
insert into auth.users(id,email,email_confirmed_at) values('20000000-0000-0000-0000-000000000001','bic-backup-test@example.invalid',now()),('20000000-0000-0000-0000-000000000002','bic-private-test@example.invalid',now());
insert into public.songbook_members(user_id,role) values('20000000-0000-0000-0000-000000000001','viewer'),('20000000-0000-0000-0000-000000000002','viewer');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ declare song bigint; folder uuid; version bigint; backup jsonb; church_count bigint; current_revision int; restored jsonb; begin
 insert into public.songbook_folders(owner_id,name) values(auth.uid(),'Test folder') returning id into folder;
 insert into public.shared_songs(owner_id,title,artist,key,category,content,folder_id) values(auth.uid(),'Backup test','','C','','{C}Original',folder) returning id into song;
 insert into public.songbook_setlists(owner_id,title,song_ids) values(auth.uid(),'Backup setlist',array[song,song]);
 insert into public.songbook_favorites(user_id,song_id) values(auth.uid(),song);
 perform public.add_songbook_friend('bic-private-test@example.invalid','Test Friend');
 select id into version from public.songbook_song_history where song_id=song and event='saved' order by id desc limit 1;
 update public.shared_songs set content='{G}Edited' where id=song;
 select revision into current_revision from public.shared_songs where id=song;
 restored:=public.restore_song_version(version,current_revision);
 if restored->>'content'<>'{C}Original' then raise exception 'Earlier version restore failed';end if;
 select count(*) into church_count from public.shared_songs where owner_id is null;
 delete from public.shared_songs where id=song;
 restored:=public.restore_song_version(version,null);
 if (restored->>'id')::bigint<>song then raise exception 'Recovery did not preserve ID';end if;
 if (select count(*) from public.shared_songs where owner_id is null)<>church_count then raise exception 'Recovery duplicated church song';end if;
 backup:=public.export_songbook_backup(false);
 if jsonb_array_length(backup->'folders')<>1 or jsonb_array_length(backup->'setlists')<>1 or jsonb_array_length(backup->'friends')<>1 then raise exception 'Incomplete backup';end if;
 -- Favorite was removed by song deletion; add it back before checking complete restore.
 insert into public.songbook_favorites(user_id,song_id) values(auth.uid(),song);
 backup:=public.export_songbook_backup(false);
 perform public.import_songbook_backup(backup);
 if (select count(*) from public.shared_songs where owner_id=auth.uid())<>2 then raise exception 'Backup song restore failed';end if;
 if (select count(*) from public.songbook_favorites where user_id=auth.uid())<>2 then raise exception 'Favorite restore failed';end if;
 if not exists(select 1 from public.songbook_setlists where owner_id=auth.uid() and title like '%(restored)' and cardinality(song_ids)=2 and song_ids[1]=song_ids[2] and song_ids[1]<>song) then raise exception 'Setlist mapping/order failed';end if;
 if (select count(*) from public.shared_songs where owner_id is null)<>church_count then raise exception 'Backup restore duplicated church song';end if;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
do $$ declare hidden bigint;blocked boolean:=false;begin
 if exists(select 1 from public.songbook_song_history where owner_id='20000000-0000-0000-0000-000000000001') then raise exception 'Private history leaked';end if;
 -- Cannot restore church history as a regular member, even by guessing an ID.
 begin perform public.restore_song_version(1,null);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Unauthorized restore accepted';end if;
end $$;
select 'backup roundtrip, version restore, deleted recovery and privacy passed' as result;
rollback;
