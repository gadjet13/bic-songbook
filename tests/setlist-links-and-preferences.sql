-- Run only on a disposable database after the setlist arrangements and link migrations.
begin;

insert into auth.users(id,email,email_confirmed_at) values
 ('bcb50000-0000-4000-8000-000000000001','setlinks-leader@example.invalid',now()),
 ('bcb50000-0000-4000-8000-000000000002','setlinks-guest@example.invalid',now()),
 ('bcb50000-0000-4000-8000-000000000003','setlinks-email@example.invalid',now()),
 ('bcb50000-0000-4000-8000-000000000004','setlinks-pending@example.invalid',now());
insert into public.songbook_members(user_id,role)
  select id,'viewer' from auth.users
  where id in ('bcb50000-0000-4000-8000-000000000001','bcb50000-0000-4000-8000-000000000002','bcb50000-0000-4000-8000-000000000003');

set local role authenticated;
do $$
declare
  leader uuid := 'bcb50000-0000-4000-8000-000000000001';
  guest uuid := 'bcb50000-0000-4000-8000-000000000002';
  email_member uuid := 'bcb50000-0000-4000-8000-000000000003';
  pending_member uuid := 'bcb50000-0000-4000-8000-000000000004';
  set_id uuid;
  song bigint;
  link uuid;
  share_id uuid;
  email_share uuid;
  payload jsonb;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',leader)::text,true);
  insert into public.shared_songs(owner_id,title,key,content)
  values (leader,'Link test chart','D','{D}Fixture') returning id into song;
  insert into public.songbook_setlists(owner_id,title,song_entries) values (leader,'Link test set',
    jsonb_build_array(jsonb_build_object('song_id',song,'key_override','G'),jsonb_build_object('song_id',song,'key_override','D')))
    returning id into set_id;
  perform public.share_setlist(set_id,'setlinks-email@example.invalid');
  select id into email_share from public.songbook_setlist_shares where setlist_id=set_id and recipient_id=email_member;
  link:=public.manage_setlist_link(set_id,'enable');
  if link is null or public.manage_setlist_link(set_id,'enable') is distinct from link then
    raise exception 'The link should remain stable while enabled';
  end if;
  if (public.open_setlist_link(link)->>'owned_setlist_id')::uuid is distinct from set_id then
    raise exception 'Owner could not open own setlist';
  end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',pending_member)::text,true);
  begin
    perform public.open_setlist_link(link);
    raise exception 'Unapproved member accessed the link';
  exception when others then
    if sqlerrm<>'Approved personal account required' then raise; end if;
  end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',guest)::text,true);
  begin
    perform public.manage_setlist_link(set_id,'disable');
    raise exception 'Recipient disabled the owner link';
  exception when others then
    if sqlerrm<>'Personal setlist not found' then raise; end if;
  end;
  share_id:=(public.open_setlist_link(link)->>'share_id')::uuid;
  if share_id is null or (public.open_setlist_link(link)->>'share_id')::uuid is distinct from share_id then
    raise exception 'Opening twice must reuse the share';
  end if;
  if (select songs->0->>'setlist_key' from public.songbook_setlist_shares where id=share_id) is distinct from 'G'
    or (select songs->1->>'setlist_key' from public.songbook_setlist_shares where id=share_id) is distinct from 'D'
  then raise exception 'Link lost per-occurrence sounding keys'; end if;
  payload:=public.save_setlist_preference(set_id,song,guest,note_value=>'Enter on verse two');
  payload:=public.save_setlist_preference(set_id,song,guest,capo_value=>2::smallint);
  perform public.save_setlist_preference(set_id,song,guest,capo_value=>1::smallint,initialize_capo=>true);
  if payload->>'note' is distinct from 'Enter on verse two' or
    (select capo from public.songbook_setlist_preferences where setlist_id=set_id) is distinct from 2::smallint
  then raise exception 'Independent patches or legacy initialization lost a preference'; end if;
  begin
    perform public.save_setlist_preference(set_id,song,leader,note_value=>'Wrong account write');
    raise exception 'Saved under a different expected user';
  exception when others then
    if sqlerrm<>'Setlist song unavailable' then raise; end if;
  end;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',email_member)::text,true);
  if (public.open_setlist_link(link)->>'share_id')::uuid is distinct from email_share then
    raise exception 'Email recipient did not keep the same share';
  end if;
  perform public.save_setlist_preference(set_id,song,email_member,note_value=>'Private to the email recipient');
  if exists(select 1 from public.songbook_setlist_preferences where user_id=guest)
    then raise exception 'Recipient saw another user preference'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',leader)::text,true);
  if exists(select 1 from public.songbook_friends where friend_id=guest)
    then raise exception 'Link enrollment exposed a new friend'; end if;
  if exists(select 1 from public.songbook_setlist_preferences where setlist_id=set_id)
    then raise exception 'Leader saw a recipient preference'; end if;
  update public.shared_songs set content='{D}Live revision' where id=song;
  if (select songs->0->>'content' from public.songbook_setlist_shares where id=share_id) is distinct from '{D}Live revision'
    then raise exception 'Link share did not refresh'; end if;
  perform public.manage_setlist_link(set_id,'disable');
  if exists(select 1 from public.songbook_setlist_shares where id=share_id)
    or not exists(select 1 from public.songbook_setlist_shares where id=email_share and shared_by_email and not shared_by_link)
    then raise exception 'Revocation mishandled link-only and dual-source access'; end if;
  if public.manage_setlist_link(set_id,'enable') is not distinct from link
    then raise exception 'Old tokens must not become valid again'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',guest)::text,true);
  if public.open_setlist_link(link) is not null or exists(select 1 from public.songbook_setlist_preferences where setlist_id=set_id)
    then raise exception 'Revoked access still works'; end if;
end $$;

reset role;
delete from public.songbook_members where user_id='bcb50000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bcb50000-0000-4000-8000-000000000003"}',true);
do $$
begin
  if exists(select 1 from public.songbook_setlist_shares) or exists(select 1 from public.songbook_setlist_preferences)
    then raise exception 'Account approval removal must also hide existing shares and private preferences';
  end if;
end $$;

rollback;
