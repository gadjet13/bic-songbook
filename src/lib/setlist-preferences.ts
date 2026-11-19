import { cloud } from './cloud'
import { capoStorageKey } from './setlist-arrangement'

type Preference = { song_id: number; note: string; capo: number | null }
type PendingCapo = { listId: string; songId: number; capo: number; change: string; fromLegacyShare?: boolean }
export const preferencesChanged = 'songbook-setlist-preferences-changed'
const memory = new Map<string, string>()
const flushing = new Map<string, Promise<void>>()
const writes = new Map<string, number>()
const cacheKey = (userId: string, listId: string) => `bic-setlist-preferences:${userId}:${listId}`
const queueKey = (userId: string) => `bic-setlist-pending-capo:${userId}`

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(memory.get(key) ?? localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}

function write<T>(key: string, value: T) {
  const json = JSON.stringify(value)
  try { localStorage.setItem(key, json); memory.delete(key) }
  catch { memory.set(key, json) }
  window.dispatchEvent(new Event(preferencesChanged))
}

function updateCache(userId: string, listId: string, value: Preference, field: 'note' | 'capo') {
  const key = cacheKey(userId, listId)
  writes.set(key, (writes.get(key) ?? 0) + 1)
  const cached = read<Record<number, Preference>>(key, {})
  cached[value.song_id] = { ...(cached[value.song_id] ?? value), [field]: value[field] }
  write(key, cached)
}

export async function loadSetlistPreferences(userId: string, listId: string) {
  const key = cacheKey(userId, listId)
  const revision = writes.get(key) ?? 0
  const {data,error} = await cloud!.from('songbook_setlist_preferences')
    .select('song_id,note,capo').eq('setlist_id', listId).eq('user_id', userId)
  if (error) throw error
  const {data:{session}}=await cloud!.auth.getSession()
  if (session?.user.id===userId && (writes.get(key) ?? 0) === revision) {
    write(key, Object.fromEntries((data as Preference[]).map(row => [row.song_id,row])))
  }
}

export function legacyCapo(userId: string, listId: string, songId: number) {
  try {
    const value = localStorage.getItem(capoStorageKey(userId, listId, songId))
    if (value !== null && /^(?:[0-9]|1[01])$/.test(value)) return Number(value)
  } catch { /* browser storage is optional */ }
  return null
}

export function cachedPreference(userId: string, listId: string, songId: number, oldListId = listId) {
  const queue = read<Record<string, PendingCapo>>(queueKey(userId), {})
  const pending = queue[`${listId}:${songId}`] ?? queue[`${oldListId}:${songId}`]
  const saved = read<Record<number, Preference>>(cacheKey(userId,listId), {})[songId]
  return {
    note: saved?.note ?? '',
    capo: pending?.capo ?? saved?.capo ?? legacyCapo(userId,oldListId,songId) ?? 0,
    savedCapo: saved?.capo ?? null,
    pending: !!pending,
  }
}

async function save(userId: string, listId: string, songId: number, patch: {note_value?: string; capo_value?: number; initialize_capo?: boolean}) {
  const {data,error} = await cloud!.rpc('save_setlist_preference', {target:listId, song:songId, expected_user:userId, ...patch})
  if (error) throw error
  return data as Preference
}

export async function saveSetlistNote(userId: string, listId: string, songId: number, note: string) {
  const saved = await save(userId,listId,songId,{note_value:note})
  updateCache(userId,listId,saved,'note')
}

export async function initializeSetlistCapo(userId: string, listId: string, songId: number, capo: number) {
  const saved = await save(userId,listId,songId,{capo_value:capo,initialize_capo:true})
  updateCache(userId,listId,saved,'capo')
}

export function queueSetlistCapo(userId: string, listId: string, songId: number, capo: number, fromLegacyShare = false) {
  const key=queueKey(userId)
  const pending=read<Record<string, PendingCapo>>(key,{})
  pending[`${listId}:${songId}`] = {listId,songId,capo,change:crypto.randomUUID(),fromLegacyShare}
  write(key,pending)
}

export function flushSetlistCapos(userId: string): Promise<void> {
  const current = flushing.get(userId)
  if (current) return current
  const key=queueKey(userId)
  const sync=async()=>{
    while (navigator.onLine) {
      const entry=Object.entries(read<Record<string, PendingCapo>>(key,{}))[0]
      if (!entry) return
      const [id, pending]=entry
      // A request running during sign-out must never write as the next user.
      const {data}=await cloud!.auth.getSession()
      if (data.session?.user.id!==userId) return
      try {
        let target=pending.listId
        if (pending.fromLegacyShare) {
          const {data:share,error}=await cloud!.from('songbook_setlist_shares').select('setlist_id')
            .eq('id',target).eq('recipient_id',userId).maybeSingle()
          if (error) throw error
          if (!share) throw new Error('Setlist song unavailable')
          target=share.setlist_id
        }
        const saved=await save(userId,target,pending.songId,{capo_value:pending.capo})
        updateCache(userId,target,saved,'capo')
      } catch(error) {
        if ((error as {message?:string}).message!=='Setlist song unavailable') throw error
      }
      const latest=read<Record<string, PendingCapo>>(key,{})
      if (latest[id]?.change===pending.change) {
        delete latest[id]
        write(key,latest)
      }
    }
  }
  const promise=sync().finally(()=>flushing.delete(userId))
  flushing.set(userId,promise)
  return promise
}

export function clearSetlistPreferenceCache(userId: string) {
  const prefix=`bic-setlist-preferences:${userId}:`
  for (const key of memory.keys()) if(key.startsWith(prefix)) memory.delete(key)
  try {
    for(let index=localStorage.length-1;index>=0;index--){
      const key=localStorage.key(index)
      if(key?.startsWith(prefix))localStorage.removeItem(key)
    }
  } catch { /* Storage can be disabled. */ }
}
