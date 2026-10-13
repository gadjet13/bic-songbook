-- Already applied to live database; reference only.
create function songbook_private.copy_shared_setlist(share_id uuid,new_title text,replace_id uuid default null,expected_revision integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); shared public.songbook_setlist_shares; item jsonb; personal public.shared_songs; ids bigint[]:='{}'; new_list public.songbook_setlists; old_list public.songbook_setlists; previous text;
begin
 if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Approved personal account required';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,25));
 select * into shared from public.songbook_setlist_shares where id=share_id and recipient_id=actor for share;
 if not found then raise exception 'Shared setlist not available';end if;
 if replace_id is not null then
 select * into old_list from public.songbook_setlists where id=replace_id and owner_id=actor for update;
 if not found or expected_revision is null or old_list.revision<>expected_revision then raise exception 'Setlist changed. Refresh before replacing.';end if;
 delete from public.songbook_setlists where id=old_list.id;
 end if;
 if (select count(*) from public.songbook_setlists where owner_id=actor)>=25 then raise exception 'You have reached the limit of 25 personal setlists.';end if;
 if jsonb_array_length(shared.songs)>100 then raise exception 'Shared setlist is too long';end if;
 previous:=current_setting('bic.restoring',true);perform set_config('bic.restoring','yes',true);
 for item in select value from jsonb_array_elements(shared.songs) loop
 select * into personal from public.shared_songs where owner_id=actor and title=item->>'title' and artist=item->>'artist' and key=item->>'key' and content=item->>'content' order by id limit 1;
 if not found then insert into public.shared_songs(owner_id,title,artist,key,category,content) values(actor,item->>'title',item->>'artist',item->>'key',coalesce(item->>'category',''),item->>'content') returning * into personal;end if;
 ids:=array_append(ids,personal.id);
 end loop;
 insert into public.songbook_setlists(owner_id,title,song_ids) values(actor,coalesce(nullif(trim(new_title),''),shared.title),ids) returning * into new_list;
 perform set_config('bic.restoring',coalesce(previous,''),true);return to_jsonb(new_list);
end $$;
revoke all on function songbook_private.copy_shared_setlist(uuid,text,uuid,integer) from public,anon;
grant execute on function songbook_private.copy_shared_setlist(uuid,text,uuid,integer) to authenticated;
create function public.copy_shared_setlist(share_id uuid,new_title text,replace_id uuid default null,expected_revision integer default null) returns jsonb language sql security invoker set search_path='' as $$select songbook_private.copy_shared_setlist(share_id,new_title,replace_id,expected_revision);$$;
revoke all on function public.copy_shared_setlist(uuid,text,uuid,integer) from public,anon;
grant execute on function public.copy_shared_setlist(uuid,text,uuid,integer) to authenticated;
