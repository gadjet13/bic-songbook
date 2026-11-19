-- Run on the disposable songbook database after applying the arrangement migration.
begin;
insert into auth.users (id,email,email_confirmed_at) values
 ('46246b6a-74b5-4292-9921-58afe3dfe70a','arrange-sender@example.invalid',now()),
 ('fe403e27-d878-4cea-a522-04d4584adb72','arrange-recipient@example.invalid',now());
insert into public.songbook_members (user_id,role) values
 ('46246b6a-74b5-4292-9921-58afe3dfe70a','viewer'),
 ('fe403e27-d878-4cea-a522-04d4584adb72','viewer');

set local role authenticated;
do $$
declare
 actor uuid := '46246b6a-74b5-4292-9921-58afe3dfe70a';
 receiver uuid := 'fe403e27-d878-4cea-a522-04d4584adb72';
 first_song bigint;
 second_song bigint;
 list_id uuid;
 share_id uuid;
 copied jsonb;
 backup jsonb;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor)::text,true);
 insert into public.shared_songs(owner_id,title,key,content) values(actor,'Arrangement SQL fixture one','C','{C}Test')
 returning id into first_song;
 insert into public.shared_songs(owner_id,title,key,content) values(actor,'Arrangement SQL fixture two','C','{C}Test')
 returning id into second_song;
 insert into public.songbook_setlists(owner_id,title,song_entries) values(actor,'Repeated song',jsonb_build_array(
  jsonb_build_object('song_id',first_song,'key_override','G'),jsonb_build_object('song_id',second_song),
  jsonb_build_object('song_id',first_song,'key_override','Bb'))) returning id into list_id;
 if (select song_ids from public.songbook_setlists where id=list_id) is distinct from array[first_song,second_song,first_song]
 then raise exception 'Projection lost entry order'; end if;
 perform public.share_setlist(list_id,'arrange-recipient@example.invalid');
 update public.songbook_setlists set song_ids=array[first_song,first_song,second_song] where id=list_id;
 select id into share_id from public.songbook_setlist_shares where setlist_id=list_id;
 if (select songs->1->>'setlist_key' from public.songbook_setlist_shares where id=share_id) is distinct from 'Bb'
 then raise exception 'Live sharing or legacy edit lost the second occurrence key'; end if;
 backup:=public.export_songbook_backup(false);
 perform public.import_songbook_backup(backup);
 if not exists(select 1 from public.songbook_setlists where title='Repeated song (restored)'
  and song_entries->0->>'key_override'='G' and song_entries->1->>'key_override'='Bb'
  and song_ids[1]=song_ids[2] and song_ids[1]<>first_song)
 then raise exception 'Backup restore lost keys or repeated entry remapping'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',receiver)::text,true);
 copied:=public.copy_shared_setlist(share_id,'Band copy');
 if (copied->'song_entries'->1->>'key_override') is distinct from 'Bb'
 then raise exception 'Copy lost setlist key'; end if;
end $$;
rollback;
