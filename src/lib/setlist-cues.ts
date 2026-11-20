import { useEffect, useRef, useState } from 'react'
import { cloud } from './cloud'

export type CueScope = 'team' | 'private'
export type SetlistCue = { song_id: number; location: string; scope: CueScope; cue: string }
const prefix = 'bic-setlist-cues:'
const cacheKey = (user: string, list: string) => `${prefix}${user}:${list}`
const memory = new Map<string, SetlistCue[]>()
const invalidations = new Map<string, number>()
const invalidationVersion = (user: string, key: string) => (invalidations.get(user) ?? 0) + (invalidations.get(key) ?? 0)

function readCache(key: string): SetlistCue[] {
  try { return memory.get(key) ?? JSON.parse(localStorage.getItem(key) ?? '[]') }
  catch { return memory.get(key) ?? [] }
}

function writeCache(key: string, cues: SetlistCue[]) {
  memory.set(key, cues)
  try { localStorage.setItem(key, JSON.stringify(cues)) } catch { /* storage is optional */ }
}

export function clearSetlistCueCache(user: string, list?: string) {
  if (list) {
    const key = cacheKey(user, list)
    invalidations.set(key, (invalidations.get(key) ?? 0) + 1)
    memory.delete(key)
    try { localStorage.removeItem(key) } catch { /* storage is optional */ }
    return
  }
  invalidations.set(user, (invalidations.get(user) ?? 0) + 1)
  const start = `${prefix}${user}:`
  for (const key of memory.keys()) if (key.startsWith(start)) memory.delete(key)
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index)
      if (key?.startsWith(start)) localStorage.removeItem(key)
    }
  } catch { /* storage is optional */ }
}

export function useSetlistCues(user: string, list: string | null, offline: boolean) {
  const key = list ? cacheKey(user, list) : ''
  const [current, setCurrent] = useState(() => ({ key, cues: key ? readCache(key) : [] }))
  const [failure, setFailure] = useState('')
  const writes = useRef(0)
  const [revision, refresh] = useState(0)
  const cues = current.key === key ? current.cues : key ? readCache(key) : []

  useEffect(() => {
    if (!list || !cloud || offline) return
    const client = cloud
    let active = true
    let request = 0
    const generation = invalidationVersion(user, key)
    async function load() {
      const serial = ++request
      const writeVersion = writes.current
      const { data, error } = await client.from('songbook_setlist_cues')
        .select('song_id,location,scope,cue').eq('setlist_id', list!)
      if (!active || generation !== invalidationVersion(user, key) || serial !== request || writeVersion !== writes.current) return
      if (error) { setFailure('Could not refresh setlist cues.'); return }
      writeCache(key, data as SetlistCue[])
      setCurrent({ key, cues: data as SetlistCue[] })
      setFailure('')
    }
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 15000)
    window.addEventListener('focus', load)
    window.addEventListener('online', load)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', load)
      window.removeEventListener('online', load)
    }
  }, [user, list, key, offline, revision])

  async function save(row: SetlistCue) {
    if (!list || !cloud || offline || !navigator.onLine) throw new Error('Reconnect to save the cue.')
    const generation = invalidationVersion(user, key)
    const { error } = await cloud.rpc('save_setlist_cue', {
      target: list, song: row.song_id, expected_user: user, cue_location: row.location,
      cue_scope: row.scope, cue_value: row.cue.trim(),
    })
    if (error) throw error
    if (generation !== invalidationVersion(user, key)) return
    writes.current++
    const remaining = readCache(key).filter(cue =>
      cue.song_id !== row.song_id || cue.location !== row.location || cue.scope !== row.scope)
    const cue = row.cue.trim()
    const updated = cue ? [...remaining, { ...row, cue }] : remaining
    writeCache(key, updated)
    setCurrent({ key, cues: updated })
    refresh(value => value + 1)
  }

  return { cues, failure: offline ? '' : failure, save }
}
