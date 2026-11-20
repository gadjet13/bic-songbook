-- Run against a disposable database with the link and reader URL migrations applied.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('fcac0000-0000-4000-8000-000000000001','reader-url-owner@example.invalid',now()),
 ('fcac0000-0000-4000-8000-000000000002','reader-url-guest@example.invalid',now());
insert into public.songbook_members(user_id,role)
 select id,'viewer' from auth.users where email in ('reader-url-owner@example.invalid','reader-url-guest@example.invalid');

set local role authenticated;
do $$
declare
 leader uuid := 'fcac0000-0000-4000-8000-000000000001';
 guest uuid := 'fcac0000-0000-4000-8000-000000000002';
 target uuid;
 token uuid;
 fresh uuid;
 redeemed uuid;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader)::text,true);
 insert into public.songbook_setlists(owner_id,title,song_ids) values (leader,'Reader URL test','{}') returning id into target;
 token:=public.manage_setlist_link(target,'enable');
 if token is null or public.get_setlist_reader_link(target) is distinct from token then
  raise exception 'Owner could not read the active token';
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',guest)::text,true);
 if public.get_setlist_reader_link(target) is not null then raise exception 'Unrelated member saw the token'; end if;
 redeemed:=(public.open_setlist_link(token)->>'share_id')::uuid;
 if redeemed is null or public.get_setlist_reader_link(target) is distinct from token then
  raise exception 'Member who joined through the link could not read its token';
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader)::text,true);
 perform public.manage_setlist_link(target,'disable');
 if public.get_setlist_reader_link(target) is not null then raise exception 'Owner saw revoked token'; end if;
 fresh:=public.manage_setlist_link(target,'enable');
 if fresh is null or fresh=token then raise exception 'Re-enabled link reused the old token'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',guest)::text,true);
 if public.get_setlist_reader_link(target) is not null or public.open_setlist_link(token) is not null then
  raise exception 'Previous recipient retained link access after revocation';
 end if;
end $$;
rollback;
