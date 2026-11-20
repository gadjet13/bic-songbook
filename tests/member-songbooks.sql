-- Run on a disposable database after database/member-songbooks.sql.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('caca0000-0000-4000-8000-000000000001','browse-author@example.invalid',now(),'{"full_name":"Fixture Author"}'),
 ('caca0000-0000-4000-8000-000000000002','browse-reader@example.invalid',now(),'{}'),
 ('caca0000-0000-4000-8000-000000000003','browse-outsider@example.invalid',now(),'{}');
insert into public.songbook_members(user_id,role)
 select id,'viewer' from auth.users where email in ('browse-author@example.invalid','browse-reader@example.invalid');
insert into public.songbook_handles(user_id,handle)
 values ('caca0000-0000-4000-8000-000000000001','browse_fixture');

set local role authenticated;
do $$
declare
 author uuid := 'caca0000-0000-4000-8000-000000000001';
 reader uuid := 'caca0000-0000-4000-8000-000000000002';
 outsider uuid := 'caca0000-0000-4000-8000-000000000003';
 original bigint;
 copy bigint;
 payload jsonb;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',author)::text,true);
 -- This fixture represents a member chart with no matching church chart.
 perform set_config('bic.restoring','yes',true);
 insert into public.shared_songs(owner_id,title,artist,key,content)
 values (author,'Member fixture','Fixture Music','G','# Verse'||chr(10)||'{G}Original chart') returning id into original;
 perform set_config('bic.restoring','',true);

 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider)::text,true);
 if exists(select 1 from public.list_member_songbooks()) or
    exists(select 1 from public.list_member_charts(author)) or public.read_member_chart(author,original) is not null
 then raise exception 'Unapproved reader could browse a member chart'; end if;
 begin
  perform public.copy_member_chart(author,original);
  raise exception 'Unapproved reader copied a chart';
 exception when others then if sqlerrm<>'Approved personal account required' then raise; end if;
 end;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',reader)::text,true);
 if (select display_name from public.list_member_songbooks() where member_id=author) is distinct from '@browse_fixture'
    or (select id from public.list_member_charts(author,'fixture music')) is distinct from original
 then raise exception 'Approved reader could not browse the existing chart'; end if;
 payload:=public.read_member_chart(author,original);
 if payload->>'content' is distinct from '# Verse'||chr(10)||'{G}Original chart'
    or payload ?| array['owner_id','folder_id','revision','source_song_id','email']
    or public.read_member_chart(reader,original) is not null
 then raise exception 'Unexpected member chart fields or incorrect owner matching'; end if;
 if exists(select 1 from public.shared_songs where id=original) then raise exception 'Personal table access broadened'; end if;
 update public.shared_songs set content='Forbidden update' where id=original;
 if found then raise exception 'Reader edited the original'; end if;
 delete from public.shared_songs where id=original;
 if found then raise exception 'Reader deleted the original'; end if;

 copy:=public.copy_member_chart(author,original);
 if copy=original or not exists (select 1 from public.shared_songs
    where id=copy and owner_id=reader and content=payload->>'content' and folder_id is null and source_song_id is null)
 then raise exception 'Copy was not saved in the reader''s library'; end if;
 if exists(select 1 from public.shared_songs where owner_id is null and title='Member fixture')
 then raise exception 'Copy published a church chart'; end if;
 update public.shared_songs set content='Personal variation' where id=copy;
 if not found or public.read_member_chart(author,original)->>'content' is distinct from payload->>'content'
 then raise exception 'Copy was not independent'; end if;
end $$;
rollback;
