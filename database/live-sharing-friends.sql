-- Already applied to live database; reference only after deployment.
create table public.songbook_friends (
 owner_id uuid not null references auth.users(id) on delete cascade,
 friend_id uuid not null references auth.users(id) on delete cascade,
 email text not null,
 nickname text not null default '' check(length(nickname)<=80),
 primary key(owner_id,friend_id),check(owner_id<>friend_id)
);
alter table public.songbook_friends enable row level security;
revoke all on public.songbook_friends from anon,authenticated;
grant select,delete on public.songbook_friends to authenticated;
grant update(nickname) on public.songbook_friends to authenticated;
create policy friends_read on public.songbook_friends for select to authenticated using(owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner'));
create policy friends_edit on public.songbook_friends for update to authenticated using(owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner')) with check(owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner'));
create policy friends_remove on public.songbook_friends for delete to authenticated using(owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner'));
create function songbook_private.remember_setlist_friend() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.songbook_friends(owner_id,friend_id,email) values(new.sender_id,new.recipient_id,new.recipient_email) on conflict(owner_id,friend_id) do update set email=excluded.email;
 return new;
end $$;
revoke all on function songbook_private.remember_setlist_friend() from public,anon,authenticated;
create trigger remember_setlist_friend after insert on public.songbook_setlist_shares for each row execute function songbook_private.remember_setlist_friend();
insert into public.songbook_friends(owner_id,friend_id,email) select distinct sender_id,recipient_id,recipient_email from public.songbook_setlist_shares on conflict do nothing;
create function songbook_private.refresh_live_setlist(target uuid) returns void language sql security definer set search_path='' as $$
 update public.songbook_setlist_shares sh set title=l.title,songs=(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'artist',s.artist,'key',s.key,'category',s.category,'content',s.content) order by requested.position),'[]'::jsonb) from unnest(l.song_ids) with ordinality requested(song_id,position) join public.shared_songs s on s.id=requested.song_id and s.owner_id=l.owner_id),updated_at=now() from public.songbook_setlists l where sh.setlist_id=l.id and l.id=target and sh.sender_id=l.owner_id;
$$;
revoke all on function songbook_private.refresh_live_setlist(uuid) from public,anon,authenticated;
create function songbook_private.live_setlist_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin perform songbook_private.refresh_live_setlist(new.id);return new;end $$;
revoke all on function songbook_private.live_setlist_changed() from public,anon,authenticated;
create trigger live_setlist_changed after update on public.songbook_setlists for each row execute function songbook_private.live_setlist_changed();
create function songbook_private.live_song_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare item uuid; song_id bigint;
begin
 song_id:=case when tg_op='DELETE' then old.id else new.id end;
 for item in select l.id from public.songbook_setlists l where song_id=any(l.song_ids) and exists(select 1 from public.songbook_setlist_shares sh where sh.setlist_id=l.id) loop
 perform songbook_private.refresh_live_setlist(item);
 end loop;
 return null;
end $$;
revoke all on function songbook_private.live_song_changed() from public,anon,authenticated;
create trigger live_song_changed after update or delete on public.shared_songs for each row execute function songbook_private.live_song_changed();
do $$ declare item uuid;begin for item in select distinct setlist_id from public.songbook_setlist_shares loop perform songbook_private.refresh_live_setlist(item);end loop;end $$;
