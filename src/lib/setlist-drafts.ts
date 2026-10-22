import {loginPersistence} from './login-storage'
export type SetlistDraft={id:string;listId:string|null;baseRevision?:number;fromSongId?:number;title:string;songIds:number[];updatedAt:string}
export const setlistDraftKey=(userId:string)=>`bic-setlist-drafts-v1:${userId}`
export function readSetlistDrafts(userId:string):SetlistDraft[]{try{const rows=JSON.parse(loginPersistence.storage.getItem(setlistDraftKey(userId))??'[]');return Array.isArray(rows)?rows.filter(row=>row&&typeof row.id==='string'&&(row.listId===null||typeof row.listId==='string')&&typeof row.title==='string'&&typeof row.updatedAt==='string'&&Array.isArray(row.songIds)&&row.songIds.every((id:unknown)=>typeof id==='number'&&Number.isSafeInteger(id)&&id>0)):[]}catch{return []}}
export function saveSetlistDraft(userId:string,draft:SetlistDraft){const rows=[draft,...readSetlistDrafts(userId).filter(row=>row.id!==draft.id)];loginPersistence.storage.setItem(setlistDraftKey(userId),JSON.stringify(rows));return rows}
export function removeSetlistDraft(userId:string,id:string){const rows=readSetlistDrafts(userId).filter(row=>row.id!==id);loginPersistence.storage.setItem(setlistDraftKey(userId),JSON.stringify(rows));return rows}
export function clearSetlistDrafts(userId:string){loginPersistence.storage.removeItem(setlistDraftKey(userId))}
export function canResumeSetlistDraft(draft:SetlistDraft,current:{id:string;revision:number}|undefined){return !!current&&draft.listId===current.id&&draft.baseRevision===current.revision}
