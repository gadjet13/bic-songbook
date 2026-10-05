import { createClient } from '@supabase/supabase-js'
import type { Song } from '../App'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const cloud = url && key ? createClient(url, key) : null
export type CloudSong = Song & { revision?: number }
function client() { if (!cloud) throw new Error('Database connection is not configured.'); return cloud }
function fields(song: Song) { return {title:song.title,artist:song.artist,key:song.key,category:song.category,content:song.content} }
export async function loadSongs(): Promise<CloudSong[]> {
  const {data,error}=await client().from('shared_songs').select('*').order('title')
  if(error) throw new Error(error.message)
  return data
}
export async function insertSongs(songs: Song[]): Promise<CloudSong[]> {
  const {data,error}=await client().from('shared_songs').insert(songs.map(fields)).select()
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
