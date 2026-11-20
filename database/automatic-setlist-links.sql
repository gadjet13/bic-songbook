begin;

create function songbook_private.create_setlist_link_on_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into songbook_private.setlist_links(setlist_id) values (new.id);
  return new;
end $$;

revoke all on function songbook_private.create_setlist_link_on_insert() from public, anon, authenticated;
create trigger create_setlist_link_on_insert
  after insert on public.songbook_setlists
  for each row when (new.owner_id is not null)
  execute function songbook_private.create_setlist_link_on_insert();

commit;
