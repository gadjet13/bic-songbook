begin;

create function songbook_private.get_setlist_reader_link(target uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select link.token
  from songbook_private.setlist_links link
  join public.songbook_setlists list on list.id=link.setlist_id
  join public.songbook_members owner on owner.user_id=list.owner_id and owner.role<>'owner'
  where link.setlist_id=target
    and coalesce(songbook_private.songbook_role(),'') not in ('','owner')
    and (
      list.owner_id=auth.uid() or exists (
        select 1 from public.songbook_setlist_shares share
        where share.setlist_id=list.id and share.sender_id=list.owner_id
          and share.recipient_id=auth.uid() and share.shared_by_link
      )
    );
$$;

create function public.get_setlist_reader_link(target uuid) returns uuid
language sql stable security invoker set search_path='' as $$
  select songbook_private.get_setlist_reader_link(target);
$$;

revoke all on function public.get_setlist_reader_link(uuid), songbook_private.get_setlist_reader_link(uuid)
  from public,anon,authenticated;
grant execute on function public.get_setlist_reader_link(uuid), songbook_private.get_setlist_reader_link(uuid)
  to authenticated;

commit;
