import { createClient } from '@supabase/supabase-js'
import type { Song } from '../App'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const cloud = url && key ? createClient(url, key) : null
export type CloudSong = Song & { revision?: number }
function client() { if (!cloud) throw new Error('Database connection is not configured.'); return cloud }
function fields(song: Song) { return {title:song.title,artist:song.artist,key:song.key,category:song.category,content:song.content,folder_id:song.folder_id??null} }
export async function loadSongs(ownerId: string | null): Promise<CloudSong[]> {
  let query=client().from('shared_songs').select('*').order('title')
  query=ownerId ? query.eq('owner_id',ownerId) : query.is('owner_id',null)
  const {data,error}=await query
  if(error) throw new Error(error.message)
  return data
}
export async function insertSongs(songs: Song[], ownerId: string | null): Promise<CloudSong[]> {
  const {data,error}=await client().from('shared_songs').insert(songs.map(song=>({...fields(song),owner_id:ownerId,source_song_id:song.source_song_id??null}))).select()
  if(error) throw new Error(error.message)
  return data
}
export async function updateSong(song: CloudSong): Promise<CloudSong> {
  const {data,error}=await client().from('shared_songs').update(fields(song)).eq('id',song.id).eq('revision',song.revision).select().maybeSingle()
  if(error) throw new Error(error.message)
  if(!data) throw new Error('This song was changed or your access was removed. Refresh the library before editing again. Copy your unsaved lyrics first.')
  return data
}
export async function removeSong(song: CloudSong) {
  const {data,error}=await client().from('shared_songs').delete().eq('id',song.id).eq('revision',song.revision).select('id')
  if(error) throw new Error(error.message)
  if(!data?.length) throw new Error('This song changed or your access was removed. Refresh before deleting.')
}
