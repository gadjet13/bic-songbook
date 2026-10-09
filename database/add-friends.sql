-- Already applied to live database; reference only.
create function songbook_private.add_songbook_friend(email_address text,private_nickname text default '') returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; target_email text;
begin
 if actor is null or coalesce(songbook_private.songbook_role(),'') in ('','owner') then raise exception 'Personal account access required'; end if;
 if length(coalesce(private_nickname,''))>80 then raise exception 'Nickname must be 80 characters or fewer'; end if;
 select u.id,u.email into target,target_email from auth.users u join public.songbook_members m on m.user_id=u.id where lower(u.email)=lower(trim(email_address)) and u.email_confirmed_at is not null and m.role<>'owner';
 if target is null or target=actor then raise exception 'Choose another approved personal account. Ask your friend to sign in and get access first.'; end if;
 insert into public.songbook_friends(owner_id,friend_id,email,nickname) values(actor,target,target_email,trim(coalesce(private_nickname,''))) on conflict(owner_id,friend_id) do update set email=excluded.email,nickname=case when excluded.nickname<>'' then excluded.nickname else public.songbook_friends.nickname end;
end $$;
revoke all on function songbook_private.add_songbook_friend(text,text) from public,anon;
grant execute on function songbook_private.add_songbook_friend(text,text) to authenticated;
create function public.add_songbook_friend(email_address text,private_nickname text default '') returns void language sql security invoker set search_path='' as $$ select songbook_private.add_songbook_friend(email_address,private_nickname); $$;
revoke all on function public.add_songbook_friend(text,text) from public,anon;
grant execute on function public.add_songbook_friend(text,text) to authenticated;
