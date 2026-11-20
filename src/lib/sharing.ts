import type { Song } from '../App'

function validateSong(value: unknown): Song {
  if (!value || typeof value !== 'object') throw new Error('Invalid song file.')
  const s = value as Record<string, unknown>
  for (const field of ['title', 'artist', 'key', 'category', 'content']) {
    if (typeof s[field] !== 'string') throw new Error(`Song is missing ${field}.`)
  }
  if (!(s.title as string).trim() || (s.content as string).length > 200000) throw new Error('Invalid song title or song is too long.')
  return { id: 0, title: s.title as string, artist: s.artist as string, key: s.key as string, category: s.category as string, content: s.content as string }
}
export function parseSongFile(text: string): Song[] {
  const data = JSON.parse(text)
  const songs = Array.isArray(data) ? data : data.songs
  if (!Array.isArray(songs) || songs.length > 2000) throw new Error('Choose a Song Database backup with at most 2,000 songs.')
  return songs.map(validateSong)
}
export function downloadSongs(songs: Song[]) {
  const blob = new Blob([JSON.stringify({ version: 1, songs }, null, 2)], {type: 'application/json'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'songbook-backup.json'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function makeSongLink(song: Song): string {
  const bytes = new TextEncoder().encode(JSON.stringify(song))
  const encoded = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
  return `${location.origin}/#song=${encodeURIComponent(encoded)}`
}
export function readSongLink(): Song | null {
  try {
    if (!location.hash.startsWith('#song=') || location.hash.length > 300000) return null
    const bytes = Uint8Array.from(atob(decodeURIComponent(location.hash.slice(6))), c => c.charCodeAt(0))
    return validateSong(JSON.parse(new TextDecoder().decode(bytes)))
  } catch { return null }
}
