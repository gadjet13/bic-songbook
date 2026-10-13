import type { Song } from '../App'
export const normalizeTitle=(title:string)=>title.trim().toLowerCase().replace(/\s+/g,' ')
export function setlistSearch(personal:Song[],church:Song[],query:string):{song:Song;source:'personal'|'church'}[]{
 const matches=(song:Song)=>`${song.title} ${song.artist}`.toLowerCase().includes(query.trim().toLowerCase())
 const owned=personal.filter(matches)
 for(const song of church.filter(matches)){const preferred=personal.find(item=>item.source_song_id===song.id||normalizeTitle(item.title)===normalizeTitle(song.title));if(preferred&&!owned.some(item=>item.id===preferred.id))owned.push(preferred)}
 const titles=new Set(personal.map(song=>normalizeTitle(song.title)))
 const sources=new Set(personal.map(song=>song.source_song_id))
 return [...owned.map(song=>({song,source:'personal' as const})),...church.filter(song=>matches(song)&&!sources.has(song.id)&&!titles.has(normalizeTitle(song.title))).map(song=>({song,source:'church' as const}))].slice(0,20)
}
