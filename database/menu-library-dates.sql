-- Reference only: applied October 29, 2026. Do not rerun on the existing project.
alter table public.songbook_folders add column created_at timestamptz;
alter table public.songbook_folders add column updated_at timestamptz;
alter table public.songbook_folders alter column created_at set default now();
alter table public.songbook_folders alter column updated_at set default now();
create function songbook_private.touch_folder_dates() returns trigger language plpgsql set search_path='' as $$
begin new.created_at:=old.created_at;new.updated_at:=now();return new;end $$;
create trigger folder_dates before update on public.songbook_folders for each row execute function songbook_private.touch_folder_dates();
revoke all on function songbook_private.touch_folder_dates() from public,anon,authenticated;
create function songbook_private.list_songbook_accounts_with_ids() returns table(email text,member_role text,handle text) language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(songbook_private.songbook_role(),'') not in ('owner','manager') then raise exception 'Owner or manager access required';end if;
 return query select u.email::text,coalesce(m.role,'awaiting approval'),h.handle
 from auth.users u left join public.songbook_members m on m.user_id=u.id left join public.songbook_handles h on h.user_id=u.id
 where u.email_confirmed_at is not null order by lower(u.email);
end $$;
create function public.list_songbook_accounts_with_ids() returns table(email text,member_role text,handle text) language sql security invoker set search_path='' as $$select * from songbook_private.list_songbook_accounts_with_ids()$$;
revoke all on function songbook_private.list_songbook_accounts_with_ids(),public.list_songbook_accounts_with_ids() from public,anon;
grant execute on function songbook_private.list_songbook_accounts_with_ids(),public.list_songbook_accounts_with_ids() to authenticated;
