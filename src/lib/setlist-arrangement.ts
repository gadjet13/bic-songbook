import type { Song } from '../App'
import { transposeChord, transposeSongContent } from './chord/transpose'

export const soundingTonics = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'] as const
const chromatic = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
export type SetlistEntry = { song_id:number; key_override?:string|null }
export type SetlistOrder = { song_ids:number[]; song_entries?:SetlistEntry[]|null }

export function setlistEntries(list:SetlistOrder): SetlistEntry[] {
  return list.song_entries ?? list.song_ids.map(song_id=>({song_id}))
}

export function songKey(value:string) {
  const match=/^([A-G](?:#|b)?)(m|maj|min)?$/.exec(value.trim())
  return match&&soundingTonics.some(note=>note===match[1]) ? match : null
}

export function setlistSoundingKey(key:string,tonic?:string|null) {
  const base=songKey(key)
  return base&&tonic ? tonic+(base[2]??'') : key
}

export function arrangedSong(song:Song,capo=0): Song {
  const sounding=setlistSoundingKey(song.key,song.setlist_key)
  const base=songKey(song.key),target=songKey(sounding)
  if(!base||!target||(!song.setlist_key&&!capo))return song
  const pitch=(note:string)=>chromatic.indexOf(transposeChord(note,0))
  const from=pitch(base[1]),to=pitch(target[1])
  if(from<0||to<0)return song
  const flats=target[1].includes('b')
  return {...song,key:capo?transposeChord(sounding,-capo,flats):sounding,
    content:transposeSongContent(song.content,to-from-capo,flats)}
}
