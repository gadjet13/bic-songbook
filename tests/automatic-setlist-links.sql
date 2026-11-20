-- Run on a disposable database after database/automatic-setlist-links.sql.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('b1c50000-0000-4000-8000-000000000001','link-owner@example.invalid',now()),
 ('b1c50000-0000-4000-8000-000000000002','link-reader@example.invalid',now());
insert into public.songbook_members(user_id,role)
 select id,'viewer' from auth.users where email in ('link-owner@example.invalid','link-reader@example.invalid');

set local role authenticated;
do $$
declare
 leader uuid := 'b1c50000-0000-4000-8000-000000000001';
 guest uuid := 'b1c50000-0000-4000-8000-000000000002';
 target uuid;
 song bigint;
 token uuid;
 share uuid;
 copied uuid;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader)::text,true);
 insert into public.shared_songs(owner_id,title,key,content)
 values (leader,'Automatic link chart','D','# Verse') returning id into song;
 insert into public.songbook_setlists(owner_id,title,song_entries)
 values (leader,'New set',jsonb_build_array(jsonb_build_object('song_id',song))) returning id into target;
 token:=public.manage_setlist_link(target,'status');
 if token is null then raise exception 'New personal set has no link'; end if;
 update public.songbook_setlists set title='Edited set' where id=target;
 if public.manage_setlist_link(target,'status') is distinct from token then
  raise exception 'Editing replaced an existing link';
 end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',guest)::text,true);
 share:=(public.open_setlist_link(token)->>'share_id')::uuid;
 if share is null then raise exception 'New link cannot be opened'; end if;
 copied:=(public.copy_shared_setlist(share,'Copied set')->>'id')::uuid;
 if copied is null or public.manage_setlist_link(copied,'status') is null then
  raise exception 'Copied set has no link';
 end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader)::text,true);
 perform public.manage_setlist_link(target,'disable');
 update public.songbook_setlists set title='Edited with link disabled' where id=target;
 if public.manage_setlist_link(target,'status') is not null or public.open_setlist_link(token) is not null then
  raise exception 'Editing re-enabled a revoked link';
 end if;
end $$;
rollback;
