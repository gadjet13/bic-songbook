-- Already applied to live database; reference only.
alter table public.songbook_setlists add column created_at timestamptz;
update public.songbook_setlists set created_at=updated_at;
alter table public.songbook_setlists alter column created_at set default now();
alter table public.songbook_setlists alter column created_at set not null;
create function songbook_private.replace_personal_setlist(delete_id uuid,expected_revision integer,new_title text,new_song_ids bigint[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();old_list public.songbook_setlists;new_list public.songbook_setlists;
begin
 if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Personal account access required';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,25));
 select * into old_list from public.songbook_setlists where id=delete_id and owner_id=actor for update;
 if not found or expected_revision is null or old_list.revision<>expected_revision then raise exception 'Setlist changed. Refresh your choices and try again.';end if;
 delete from public.songbook_setlists where id=old_list.id;
 insert into public.songbook_setlists(owner_id,title,song_ids) values(actor,new_title,new_song_ids) returning * into new_list;
 return to_jsonb(new_list);
end $$;
revoke all on function songbook_private.replace_personal_setlist(uuid,integer,text,bigint[]) from public,anon;
grant execute on function songbook_private.replace_personal_setlist(uuid,integer,text,bigint[]) to authenticated;
create function public.replace_personal_setlist(delete_id uuid,expected_revision integer,new_title text,new_song_ids bigint[]) returns jsonb language sql security invoker set search_path='' as $$select songbook_private.replace_personal_setlist(delete_id,expected_revision,new_title,new_song_ids);$$;
revoke all on function public.replace_personal_setlist(uuid,integer,text,bigint[]) from public,anon;
grant execute on function public.replace_personal_setlist(uuid,integer,text,bigint[]) to authenticated;
