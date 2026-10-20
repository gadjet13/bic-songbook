import { loginPersistence } from './login-storage'
export type SongDraft={id:string;songId:number|null;baseRevision?:number;title:string;artist:string;key:string;content:string;raw:string;folderId:string|null;updatedAt:string}
export const draftKey=(userId:string,book:'personal'|'church')=>`bic-song-drafts-v1:${userId}:${book}`
export function readSongDrafts(key:string):SongDraft[]{try{const value=JSON.parse(loginPersistence.storage.getItem(key)??'[]');return Array.isArray(value)?value.filter(row=>row&&typeof row.id==='string'&&(row.songId===null||typeof row.songId==='number')&&['title','artist','key','content','raw','updatedAt'].every(name=>typeof row[name]==='string')):[]}catch{return []}}
export function writeSongDraft(key:string,draft:SongDraft){const rows=readSongDrafts(key);loginPersistence.storage.setItem(key,JSON.stringify([draft,...rows.filter(row=>row.id!==draft.id)]));return readSongDrafts(key)}
export function removeSongDraft(key:string,id:string){const rows=readSongDrafts(key).filter(row=>row.id!==id);loginPersistence.storage.setItem(key,JSON.stringify(rows));return rows}
export function clearSongDrafts(userId:string){for(const book of ['personal','church'] as const)loginPersistence.storage.removeItem(draftKey(userId,book))}

export function canResumeSongDraft(draft:SongDraft,current:{id:number;revision?:number}|undefined){return !!current&&draft.songId===current.id&&current.revision===draft.baseRevision}
