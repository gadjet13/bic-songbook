-- Run on a disposable database after database/setlist-cues.sql.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('cbea0000-0000-4000-8000-000000000001','cue-leader@example.invalid',now()),
 ('cbea0000-0000-4000-8000-000000000002','cue-guest@example.invalid',now()),
 ('cbea0000-0000-4000-8000-000000000003','cue-guest-2@example.invalid',now()),
 ('cbea0000-0000-4000-8000-000000000004','cue-outsider@example.invalid',now());
insert into public.songbook_members(user_id,role)
 select id,'viewer' from auth.users where email like 'cue-%@example.invalid';

set local role authenticated;
do $$
declare
 leader uuid := 'cbea0000-0000-4000-8000-000000000001';
 guest uuid := 'cbea0000-0000-4000-8000-000000000002';
 guest_two uuid := 'cbea0000-0000-4000-8000-000000000003';
 outsider uuid := 'cbea0000-0000-4000-8000-000000000004';
 list uuid;
 song bigint;
 link uuid;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader)::text,true);
 insert into public.shared_songs(owner_id,title,key,content) values (leader,'Cue chart','D','# Verse') returning id into song;
 insert into public.songbook_setlists(owner_id,title,song_ids) values (leader,'Cue set',array[song]) returning id into list;
 link:=public.manage_setlist_link(list,'enable');
 perform public.save_setlist_cue(list,song,leader,'song','team','First team cue');
 perform public.save_setlist_cue(list,song,leader,'song','private','Leader cue');
 perform public.save_setlist_cue(list,song,leader,'song','team','Updated team cue');
 if (select count(*) from public.songbook_setlist_cues where setlist_id=list)<>2 then
  raise exception 'Owner could not see both cues';
 end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',guest)::text,true);
 perform public.open_setlist_link(link);
 perform public.save_setlist_cue(list,song,guest,'["Verse",1]','private','Guest cue');
 if (select array_agg(cue order by cue) from public.songbook_setlist_cues where setlist_id=list)
   is distinct from array['Guest cue','Updated team cue'] then raise exception 'Incorrect guest cues'; end if;
 begin
  perform public.save_setlist_cue(list,song,guest,'song','team','Forbidden cue');
  raise exception 'Guest wrote a team cue';
 exception when others then if sqlerrm<>'Only the setlist owner can change a team cue' then raise; end if;
 end;
 begin
  perform public.save_setlist_cue(list,song,leader,'song','private','Forged cue');
  raise exception 'Guest impersonated the owner';
 exception when others then if sqlerrm<>'Setlist song unavailable' then raise; end if;
 end;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',guest_two)::text,true);
 perform public.open_setlist_link(link);
 if (select array_agg(cue) from public.songbook_setlist_cues where setlist_id=list)
   is distinct from array['Updated team cue'] then raise exception 'Incorrect second guest cues'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider)::text,true);
 if exists(select 1 from public.songbook_setlist_cues where setlist_id=list) then raise exception 'Outsider read cues'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',leader)::text,true);
 perform public.save_setlist_cue(list,song,leader,'song','private','');
 if (select array_agg(cue) from public.songbook_setlist_cues where setlist_id=list)
   is distinct from array['Updated team cue'] then raise exception 'Wrong cues after removal'; end if;
 perform public.manage_setlist_link(list,'disable');

 perform set_config('request.jwt.claims',jsonb_build_object('sub',guest)::text,true);
 if exists(select 1 from public.songbook_setlist_cues where setlist_id=list) then raise exception 'Revoked guest read cues'; end if;
 begin
  perform public.save_setlist_cue(list,song,guest,'song','private','Forbidden cue');
  raise exception 'Revoked guest wrote a cue';
 exception when others then if sqlerrm<>'Setlist song unavailable' then raise; end if;
 end;
end $$;
rollback;
