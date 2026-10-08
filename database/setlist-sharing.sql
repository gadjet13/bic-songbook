-- Already applied to the live database; reference only. Do not rerun.
-- Personal setlists only. Existing church setlists are retained but inaccessible.
drop policy setlists_read on public.songbook_setlists;
create policy setlists_read on public.songbook_setlists for select to authenticated using(owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner'));
drop policy setlists_add on public.songbook_setlists;
create policy setlists_add on public.songbook_setlists for insert to authenticated with check(owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner'));
drop policy setlists_edit on public.songbook_setlists;
create policy setlists_edit on public.songbook_setlists for update to authenticated using(owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner')) with check(owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner'));
drop policy setlists_remove on public.songbook_setlists;
create policy setlists_remove on public.songbook_setlists for delete to authenticated using(owner_id=(select auth.uid()) and coalesce((select songbook_private.songbook_role()),'') not in ('','owner'));
create table public.songbook_setlist_shares (
 id uuid primary key default gen_random_uuid(),
 setlist_id uuid not null references public.songbook_setlists(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 sender_email text not null,
 recipient_email text not null,
 title text not null,
 songs jsonb not null check(jsonb_typeof(songs)='array'),
 updated_at timestamptz not null default now(),
 unique(setlist_id,recipient_id), check(sender_id<>recipient_id)
);
create index setlist_shares_sender on public.songbook_setlist_shares(sender_id);
create index setlist_shares_recipient on public.songbook_setlist_shares(recipient_id);
alter table public.songbook_setlist_shares enable row level security;
revoke all on public.songbook_setlist_shares from anon,authenticated;
grant select,delete on public.songbook_setlist_shares to authenticated;
create policy shares_read on public.songbook_setlist_shares for select to authenticated using(coalesce((select songbook_private.songbook_role()),'') not in ('','owner') and (sender_id=(select auth.uid()) or recipient_id=(select auth.uid())));
create policy shares_remove on public.songbook_setlist_shares for delete to authenticated using(coalesce((select songbook_private.songbook_role()),'') not in ('','owner') and (sender_id=(select auth.uid()) or recipient_id=(select auth.uid())));
create function songbook_private.share_setlist(list_id uuid,recipient_email_address text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; list public.songbook_setlists; payload jsonb; from_email text; to_email text;
begin
 if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Personal account access required'; end if;
 select * into list from public.songbook_setlists where id=list_id and owner_id=actor;
 if not found then raise exception 'Personal setlist not found'; end if;
 select u.id,u.email into target,to_email from auth.users u join public.songbook_members m on m.user_id=u.id where lower(u.email)=lower(trim(recipient_email_address)) and u.email_confirmed_at is not null and m.role<>'owner';
 if target is null or target=actor then raise exception 'Choose another approved personal account; church accounts cannot receive setlists'; end if;
 select email into from_email from auth.users where id=actor;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'artist',s.artist,'key',s.key,'category',s.category,'content',s.content) order by requested.position),'[]'::jsonb) into payload from unnest(list.song_ids) with ordinality as requested(song_id,position) join public.shared_songs s on s.id=requested.song_id and s.owner_id=actor;
 if jsonb_array_length(payload)<>cardinality(list.song_ids) then raise exception 'Remove missing songs before sharing'; end if;
 insert into public.songbook_setlist_shares(setlist_id,sender_id,recipient_id,sender_email,recipient_email,title,songs) values(list.id,actor,target,from_email,to_email,list.title,payload) on conflict(setlist_id,recipient_id) do update set title=excluded.title,songs=excluded.songs,updated_at=now();
end $$;
revoke all on function songbook_private.share_setlist(uuid,text) from public,anon;
grant execute on function songbook_private.share_setlist(uuid,text) to authenticated;
create function public.share_setlist(list_id uuid,recipient_email_address text) returns void language sql security invoker set search_path='' as $$ select songbook_private.share_setlist(list_id,recipient_email_address); $$;
revoke all on function public.share_setlist(uuid,text) from public,anon;
grant execute on function public.share_setlist(uuid,text) to authenticated;
