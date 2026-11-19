begin;

-- Keep historical shares and their source flags so existing access is preserved.
-- Retire the invitation and address book endpoints, including for older clients.
revoke execute on function public.share_setlist(uuid,text),
  songbook_private.share_setlist(uuid,text),
  public.resolve_songbook_friend(text),
  songbook_private.resolve_songbook_friend(text),
  public.add_songbook_friend(text,text),
  songbook_private.add_songbook_friend(text,text)
from public, anon, authenticated;
revoke all on table public.songbook_friends from public, anon, authenticated;
revoke update (nickname) on public.songbook_friends from authenticated;

-- Version 2 backups remain readable. Ignore the legacy address book on restore.
create or replace function public.export_songbook_backup(church boolean default false)
returns jsonb language sql security invoker set search_path = ''
as $$ select songbook_private.export_songbook_backup(church) - 'friends' $$;

create or replace function public.import_songbook_backup(payload jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select songbook_private.import_songbook_backup(payload - 'friends') $$;

notify pgrst, 'reload schema';
commit;
