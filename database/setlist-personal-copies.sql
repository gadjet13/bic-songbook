-- Already applied to live database; reference only.
create function songbook_private.ensure_personal_church_song(church_song_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); original public.shared_songs; personal public.shared_songs;
begin
 if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Approved personal account required';end if;
 select * into original from public.shared_songs where id=church_song_id and owner_id is null for share;
 if not found then raise exception 'Church song not available';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||songbook_private.normalized_song_title(original.title),1));
 select * into personal from public.shared_songs where owner_id=actor and (source_song_id=original.id or songbook_private.normalized_song_title(title)=songbook_private.normalized_song_title(original.title)) order by (source_song_id=original.id) desc nulls last,id limit 1;
 if not found then insert into public.shared_songs(owner_id,source_song_id,title,artist,key,category,content) values(actor,original.id,original.title,original.artist,original.key,original.category,original.content) returning * into personal;end if;
 return to_jsonb(personal);
end $$;
revoke all on function songbook_private.ensure_personal_church_song(bigint) from public,anon;
grant execute on function songbook_private.ensure_personal_church_song(bigint) to authenticated;
create function public.ensure_personal_church_song(church_song_id bigint) returns jsonb language sql security invoker set search_path='' as $$select songbook_private.ensure_personal_church_song(church_song_id);$$;
revoke all on function public.ensure_personal_church_song(bigint) from public,anon;
grant execute on function public.ensure_personal_church_song(bigint) to authenticated;
create function songbook_private.recover_setlist_songs(list_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); list public.songbook_setlists; v_song_id bigint; version_id bigint; result jsonb:='[]';
begin
 if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Approved personal account required';end if;
 select * into list from public.songbook_setlists where id=list_id and owner_id=actor;
 if not found then raise exception 'Personal setlist not found';end if;
 for v_song_id in select distinct unnest(list.song_ids) loop
 if not exists(select 1 from public.shared_songs s where s.id=v_song_id) then
 select id into version_id from public.songbook_song_history h where h.song_id=v_song_id and h.owner_id=actor order by h.id desc limit 1;
 if version_id is not null then result:=result||jsonb_build_array(songbook_private.restore_song_version(version_id,null));end if;
 end if;
 end loop;return result;
end $$;
revoke all on function songbook_private.recover_setlist_songs(uuid) from public,anon;
grant execute on function songbook_private.recover_setlist_songs(uuid) to authenticated;
create function public.recover_setlist_songs(list_id uuid) returns jsonb language sql security invoker set search_path='' as $$select songbook_private.recover_setlist_songs(list_id);$$;
revoke all on function public.recover_setlist_songs(uuid) from public,anon;
grant execute on function public.recover_setlist_songs(uuid) to authenticated;
