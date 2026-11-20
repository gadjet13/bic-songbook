import { setlistLink } from './lib/setlist-links'
import { copySetlistLink, createSetlistLink, useSetlistLink } from './SetlistLinkSharing'
import FullSetlistReader from './FullSetlistReader'
import type { FullReaderControls } from './FullSetlistReader'
import { setlistEntries, setlistSoundingKey, songKey, soundingTonics } from './lib/setlist-arrangement'
import type { SetlistEntry, SetlistOrder } from './lib/setlist-arrangement'
import LibrarySortControl from './LibrarySortControl'
import {sortLibraryItems} from './lib/library-sort'
import type {LibrarySort,LibraryDates} from './lib/library-sort'
import {readSetlistDrafts,saveSetlistDraft,removeSetlistDraft,canResumeSetlistDraft,setlistDraftKey} from './lib/setlist-drafts'
import type {SetlistDraft} from './lib/setlist-drafts'
import {loginPersistence} from './lib/login-storage'
import { useEffect, useRef, useState } from 'react'
import { loadSongs, cloud } from './lib/cloud'
import type { Song } from './App'
import type { OfflineList } from './lib/offline'
import SetlistLimitPanel from './SetlistLimitPanel'
import { setlistSearch } from './lib/setlist-search'
import useUnsavedChanges from './useUnsavedChanges'
import { allowNavigation } from './lib/unsaved'

type Setlist = LibraryDates & SetlistOrder & {id:string; title:string; revision:number}
const message = (error: unknown) => error instanceof Error ? error.message : String((error as {message?:string})?.message ?? error)
export function useFavorites(userId: string, offlineFavorites?:number[]) {
 const [favorites,setFavorites]=useState<number[]>([])
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 useEffect(()=>{if(offlineFavorites){setFavorites(offlineFavorites);setError('');return}let active=true;const load=async()=>{const {data,error}=await cloud!.from('songbook_favorites').select('song_id').eq('user_id',userId);if(active){if(error)setError(error.message);else {setFavorites((data??[]).map(row=>row.song_id));setError('')}}};void load();window.addEventListener('focus',load);return()=>{active=false;window.removeEventListener('focus',load)}},[userId,offlineFavorites])
 async function toggle(id:number){if(busy)return;setBusy(true);setError('');try{const exists=favorites.includes(id);const result=exists?await cloud!.from('songbook_favorites').delete().eq('user_id',userId).eq('song_id',id):await cloud!.from('songbook_favorites').insert({user_id:userId,song_id:id});if(result.error)throw result.error;setFavorites(current=>exists?current.filter(value=>value!==id):[...current,id])}catch(error){setError(message(error))}finally{setBusy(false)}}
 return {favorites,toggle,error,busy}
}
export default function SongOrganization({songs,canEdit,ownerId,offlineLists,churchSongs,onSongsChanged,activeId,onNavigate,onBack,onSongEditor,fullReader,onReadFull}: {activeId:string|null;onNavigate:(id:string)=>void;onBack:()=>void;churchSongs:Song[];onSongsChanged:()=>Promise<void>;offlineLists?:OfflineList[];songs:Song[];canEdit:boolean;ownerId:string|null;onSongEditor:(song:Song|null,onSaved:(song:Song)=>void,returnFocus:HTMLElement)=>void;fullReader:FullReaderControls|null;onReadFull:(id?:string)=>void}) {
 const [listSort,setListSort]=useState<LibrarySort>('added-newest')
 const [church,setChurch]=useState(churchSongs),[churchError,setChurchError]=useState('')
 useEffect(()=>{let active=true;if(offlineLists){setChurch(churchSongs);return}setChurch(churchSongs);void loadSongs(null).then(rows=>{if(active){setChurch(rows);setChurchError('')}}).catch(error=>{if(active)setChurchError(message(error))});return()=>{active=false}},[ownerId,churchSongs,offlineLists])
 const [personal,setPersonal]=useState(songs)
 useEffect(()=>{setPersonal(previous=>{const merged=new Map(previous.map(song=>[song.id,song]));for(const song of songs){const old=merged.get(song.id);if(!old||(song.revision??0)>=(old.revision??0))merged.set(song.id,song)}return [...merged.values()]})},[songs])
 const [lists,setLists]=useState<Setlist[]>([]),[selected,setSelected]=useState<Setlist|null>(null)
 const [title,setTitle]=useState(''),[entries,setEntries]=useState<SetlistEntry[]>([]),[search,setSearch]=useState('')
 const [editing,setEditing]=useState(false),[limit,setLimit]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false)
 const [returnAfterSave,setReturnAfterSave]=useState(false)
 const [cardLink,setCardLink]=useState<{id:string;fallback:string|null;created?:boolean}|null>(null)
 const [pickerOpen,setPickerOpen]=useState(false)
 const searchInput=useRef<HTMLInputElement>(null)
 const actionPending=useRef(false)
 const ids=entries.map(entry=>entry.song_id)
 const dirty=!!activeId&&editing&&(title!==(selected?.title??'')||JSON.stringify(entries)!==JSON.stringify(selected?setlistEntries(selected):[]))
 useUnsavedChanges(dirty)
 const [drafts,setDrafts]=useState(()=>ownerId?readSetlistDrafts(ownerId):[]),[draftStatus,setDraftStatus]=useState('')
 const pendingDraft=useRef<SetlistDraft|null>(null)
 function clearDraft(id:string){if(ownerId)setDrafts(removeSetlistDraft(ownerId,id));setDraftStatus('')}
 function applyDraft(draft:SetlistDraft,current:Setlist|null){setSelected(current);setTitle(draft.title);setEntries(setlistEntries({song_ids:draft.songIds,song_entries:draft.songEntries}));setEditing(true);pendingDraft.current=null;setNotice('Draft recovered. Review the order and save when ready.')}
 async function recoverDraft(draft:SetlistDraft){if(!ownerId||!canEdit||!allowNavigation())return;await action(async()=>{
  const rows=await refresh(),current=rows.find(row=>row.id===draft.listId),resume=canResumeSetlistDraft(draft,current)
  if(draft.listId!==null&&!resume&&!window.confirm('This setlist changed or was deleted after the draft began. Recover it as a new setlist instead? The saved original will stay unchanged.'))return
  let recovered=draft
  if(!resume&&draft.listId!==null){if(readSetlistDrafts(ownerId).some(row=>row.id==='new')){setNotice('Recover or discard your existing new-setlist draft first.');return}recovered={...draft,id:'new',listId:null,baseRevision:undefined};setDrafts(saveSetlistDraft(ownerId,recovered));clearDraft(draft.id)}
  const destination=resume?current!.id:'new'
  if(destination===activeId)applyDraft(recovered,resume?current!:null)
  else{pendingDraft.current=recovered;onNavigate(destination)}
 })}
 function startNew(){const draft=drafts.find(row=>row.id==='new');if(draft)void recoverDraft(draft);else onNavigate('new')}

 const results=setlistSearch(personal,church,search)
 function query(){return cloud!.from('songbook_setlists').select('*').eq('owner_id',ownerId).order('title')}
 async function refresh(){if(offlineLists){setLists(offlineLists);setLoaded(true);return offlineLists}const {data,error}=await query();if(error)throw error;setLists(data??[]);setLoaded(true);return (data??[]) as Setlist[]}
 useEffect(()=>{let active=true;if(offlineLists){setLists(offlineLists);setLoaded(true);return}void query().then(({data,error})=>{if(active){if(error)setNotice(error.message);else setLists(data??[]);setLoaded(true)}});return()=>{active=false}},[ownerId,offlineLists])
 useEffect(()=>{const restored=()=>{setSelected(null);void refresh().catch(error=>setNotice(message(error)))};window.addEventListener('songbook-restored',restored);return()=>window.removeEventListener('songbook-restored',restored)},[ownerId])
 function choose(list:Setlist,edit=false){if(pendingDraft.current?.listId===list.id){applyDraft(pendingDraft.current,list);return}setSelected(list);setTitle(list.title);setEntries(setlistEntries(list));setEditing(edit);setSearch('');setNotice('');if(!offlineLists)void cloud!.rpc('recover_setlist_songs',{list_id:list.id}).then(async({data,error})=>{if(error){setNotice(error.message);return}if(data?.length){setPersonal(rows=>[...rows.filter(row=>!data.some((song:Song)=>song.id===row.id)),...data]);await onSongsChanged();setNotice('Missing setlist songs restored to your personal songbook.')}})}
 function editSetlist(list:Setlist){
  if(!canEdit||offlineLists){onReadFull(list.id);return}
  const draft=drafts.find(row=>row.listId===list.id)
  if(draft){void recoverDraft(draft);return}
  if(!allowNavigation())return
  if(!activeId){onNavigate(list.id);choose(list,true)}
  else{setTitle(list.title);setEntries(setlistEntries(list));setEditing(true)}
 }
 useEffect(()=>{
  setLimit(false);setPickerOpen(false);setSearch('');setNotice('')
  if(activeId==='new'){
   const draft=pendingDraft.current??(ownerId?readSetlistDrafts(ownerId).find(row=>row.id==='new'):undefined)
   if(draft)applyDraft(draft,null)
   else{setSelected(null);setTitle('');setEntries([]);setEditing(true)}
  }else if(!activeId){setSelected(null);setEditing(false)}
 },[activeId,ownerId])
 useEffect(()=>{if(pickerOpen)searchInput.current?.focus()},[pickerOpen])
 useEffect(()=>{if(activeId&&activeId!=='new'&&selected?.id!==activeId){const list=lists.find(row=>row.id===activeId);if(list)choose(list,!fullReader)}},[activeId,lists,selected?.id,!!fullReader])
 useEffect(()=>{
  if(!ownerId||!canEdit||!activeId||!editing)return
  if((activeId==='new'&&selected)||(activeId!=='new'&&selected?.id!==activeId))return
  const id=selected?.id??'new'
  if(!dirty){if(readSetlistDrafts(ownerId).some(row=>row.id===id))clearDraft(id);return}
  setDrafts(saveSetlistDraft(ownerId,{id,listId:selected?.id??null,baseRevision:selected?.revision,title,songIds:ids,songEntries:entries,updatedAt:new Date().toISOString()}))
  setDraftStatus(loginPersistence.isPersisted(setlistDraftKey(ownerId))?'Setlist draft saved on this browser. Save setlist to update the database.':'Draft is only in memory. Browser storage is unavailable or full; save before closing this tab.')
 },[ownerId,canEdit,activeId,editing,dirty,title,JSON.stringify(entries),selected?.id,selected?.revision])
 async function action(fn:()=>Promise<void>){
  if(actionPending.current)return
  actionPending.current=true;setBusy(true);setNotice('')
  try{await fn()}catch(error){setNotice(message(error))}finally{actionPending.current=false;setBusy(false)}
 }
 function copyLinkFromCard(list:Setlist){
  void action(async()=>{
   setCardLink(null)
   const fallback=await copySetlistLink(await createSetlistLink(list.id))
   setCardLink({id:list.id,fallback})
  })
 }
 function deleteSetlist(list:Setlist){
  if(actionPending.current||!window.confirm(`Delete “${list.title}”? Its share link will stop working. Songs will stay in the library.`))return
  void action(async()=>{
   const {data,error}=await cloud!.from('songbook_setlists').delete()
    .eq('id',list.id).eq('owner_id',ownerId).eq('revision',list.revision).select('id')
   if(error)throw error
   if(!data?.length)throw new Error('Setlist changed. Refresh before deleting.')
   setLists(rows=>rows.filter(row=>row.id!==list.id))
   setCardLink(current=>current?.id===list.id?null:current)
   setNotice(`Deleted “${list.title}”.`)
   void onSongsChanged().catch(error=>setNotice('Setlist deleted, but refreshing failed: '+message(error)))
  })
 }
 function rememberSong(song:Song){
  setPersonal(rows=>[...rows.filter(row=>row.id!==song.id),song])
 }
 function appendSong(song:Song){
  rememberSong(song)
  setEntries(values=>values.length<100?[...values,{song_id:song.id}]:values)
  setNotice(`Added “${song.title}” to the set draft.`)
 }
 function addCandidate(song:Song,source:'personal'|'church'){
  if(entries.length>=100||actionPending.current)return
  if(source==='personal'){appendSong(song);return}
  void action(async()=>{
   const {data,error}=await cloud!.rpc('ensure_personal_church_song',{church_song_id:song.id})
   if(error)throw error
   appendSong(data)
   void onSongsChanged().catch(error=>setNotice('Song added, but refreshing failed: '+message(error)))
  })
 }
 function showSavedSet(list:Setlist,created:boolean){
  if(created)void createSetlistLink(list.id).then(token=>{
   if(!token)throw new Error('No link returned.')
   setCardLink({id:list.id,fallback:setlistLink(token),created:true})
  }).catch(()=>setNotice('Setlist saved. Use Copy setlist link to retry creating its link.'))
  clearDraft(created?'new':list.id)
  setLists(rows=>[...rows.filter(row=>row.id!==list.id),list])
  setEditing(false);setReturnAfterSave(true)
  void onSongsChanged().catch(error=>setNotice('Setlist saved, but refreshing failed: '+message(error)))
 }
 async function save(){
  if(offlineLists)throw new Error('Reconnect before saving setlists.')
  if(!title.trim())throw new Error('Enter a setlist name.')
  if(!selected&&lists.length>=25){setLimit(true);return}
  const fields={title:title.trim(),song_entries:entries}
  const result=selected
   ? await cloud!.from('songbook_setlists').update(fields).eq('id',selected.id).eq('revision',selected.revision).select().maybeSingle()
   : await cloud!.from('songbook_setlists').insert({...fields,owner_id:ownerId}).select().single()
  if(result.error)throw result.error
  if(!result.data)throw new Error('Someone changed this setlist. Copy your changes, then refresh and try again.')
  showSavedSet(result.data,!selected)
 }
 function move(index:number,direction:number){const next=[...entries];[next[index],next[index+direction]]=[next[index+direction],next[index]];setEntries(next)}
 const slots=(list:Setlist)=>setlistEntries(list).map(entry=>{
  const song=personal.find(item=>item.id===entry.song_id)
  return song ? {...song,setlist_key:entry.key_override} : undefined
 })
 const queue=(list:Setlist)=>slots(list).filter(song=>song!==undefined)
 useEffect(()=>{
  if(!returnAfterSave)return
  setReturnAfterSave(false)
  onBack()
 },[returnAfterSave])
 const readingSet=fullReader?lists.find(list=>list.id===activeId):null
 const sharingId=canEdit&&!offlineLists?readingSet?.id??null:null
 const link=useSetlistLink(sharingId)
 if(fullReader&&readingSet)return <FullSetlistReader title={readingSet.title} songs={slots(readingSet)} controls={fullReader}
  shareOptions={sharingId&&(link.token||link.notice)&&<details className="setlist-sharing"><summary>Share options</summary>
   {link.token&&<button type="button" disabled={link.busy} onClick={()=>void link.disableLink().then(disabled=>{
    if(disabled)setCardLink(current=>current?.id===sharingId?null:current)
   })}>Turn off link</button>}
   {link.notice&&<p role="status">{link.notice}</p>}
  </details>}/>
 if(fullReader)return <section className="setlist-page"><button type="button" onClick={fullReader.exit}>Back to setlists</button>
  <p>{loaded?'This setlist is no longer available.':'Loading setlist…'}</p></section>
 if(!activeId)return <section className="setlist-panel setlist-index" aria-label="My setlists">{!!drafts.length&&<section className="draft-recovery" aria-label="Recover unsaved setlists"><h3>Unsaved setlist drafts</h3><p>Stored in this browser only. Recovering does not change a saved setlist.</p>{drafts.map(draft=><div className="draft-row" key={draft.id}><span>{draft.title||'Untitled setlist'} · {draft.songIds.length} songs · {new Date(draft.updatedAt).toLocaleString()}</span><button disabled={busy||!canEdit||!loaded} onClick={()=>void recoverDraft(draft)}>Recover setlist draft</button><button disabled={busy} onClick={()=>{if(window.confirm('Permanently discard this setlist draft?'))clearDraft(draft.id)}}>Discard setlist draft</button></div>)}</section>}<div className="setlist-tools"><button disabled={busy} onClick={()=>void action(async()=>{await refresh()})}>Refresh setlists</button>{canEdit&&<button disabled={busy} onClick={startNew}>New setlist</button>}</div><LibrarySortControl label="Setlists" value={listSort} onChange={setListSort}/><div className="setlist-cards">{sortLibraryItems(lists,listSort).map(list=>{
  const playable=queue(list)
  return <article className="library-setlist-card" key={list.id} aria-label={list.title}>
   <button type="button" className="setlist-card-summary" aria-label={list.title} title={canEdit?'Edit setlist':'Open setlist'}
    disabled={busy} onClick={()=>editSetlist(list)}>
    <strong>{list.title}</strong>
    <span>{list.song_ids.length} {list.song_ids.length===1?'song':'songs'}</span>
    {!playable.length&&<small>{list.song_ids.length?'No available songs':'Add a song to start this setlist'}</small>}
   </button>
   <div className="setlist-card-actions">
    <button type="button" className="setlist-card-start" aria-label="Start setlist" title="Read full set" data-read-full-set={list.id}
     disabled={busy||!playable.length} onClick={()=>onReadFull(list.id)}>
     <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M8 4.7a.8.8 0 0 0-1.2.7v13.2a.8.8 0 0 0 1.2.7l10.8-6.6a.8.8 0 0 0 0-1.4Z"/></svg>
    </button>
    {canEdit&&!offlineLists&&<>
     <button type="button" aria-label="Copy setlist link" title="Copy setlist link" disabled={busy} onClick={()=>copyLinkFromCard(list)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
       <path d="M10 13a4 4 0 0 0 6 .4l4-4a4 4 0 0 0-5.7-5.7l-2.3 2.3m2 5a4 4 0 0 0-6-.4l-4 4a4 4 0 0 0 5.7 5.7l2.3-2.3"/>
      </svg>
     </button>
     <button type="button" className="setlist-card-delete" aria-label="Delete setlist" title="Delete setlist" disabled={busy} onClick={()=>deleteSetlist(list)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
       <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>
      </svg>
     </button>
    </>}
   </div>
   {canEdit&&!offlineLists&&cardLink?.id===list.id&&<>
    <p role="status">{cardLink.created?'Setlist saved. Your share link is ready.':cardLink.fallback?'Select and copy the setlist link.':'Setlist link copied.'}</p>
    {cardLink.fallback&&<input className="setlist-card-link" type="text" aria-label="Setlist link" readOnly
     value={cardLink.fallback} autoFocus onFocus={event=>event.currentTarget.select()}/>}
   </>}
  </article>
 })}</div>{loaded&&!lists.length&&<p>No setlists yet.</p>}<p role="status">{notice}</p></section>
 return <section className="setlist-page" aria-label="Setlist page"><button className="back-button" onClick={onBack}>← Back to setlists</button><h2>{activeId==='new'?'Plan a worship set':selected?.title??'Setlist'}</h2>
 {!editing&&!selected&&<p>{loaded?'This setlist is no longer available.':'Loading setlist…'}</p>}
 {editing&&draftStatus&&<p className="storage-note" role="status">{draftStatus}</p>}
 {limit&&ownerId&&<SetlistLimitPanel ownerId={ownerId} title={title} songIds={ids} songEntries={entries} onCreated={list=>{setLimit(false);showSavedSet(list,true);void refresh().catch(error=>setNotice(message(error)))}} onCancel={onBack}/>}
 {editing?<fieldset className="worship-set-editor" disabled={!canEdit||busy}>
  <label>Setlist name<input maxLength={200} value={title} placeholder="Sunday worship" onChange={event=>setTitle(event.target.value)}/></label>
  <div className="worship-set-actions">
   <button type="button" aria-expanded={pickerOpen} aria-controls="worship-song-picker" onClick={()=>setPickerOpen(open=>!open)}>Add from library</button>
   <button type="button" disabled={ids.length>=100} onClick={event=>onSongEditor(null,appendSong,event.currentTarget)}>Add new song</button>
  </div>
  {ids.length>=100&&<p role="status">This setlist has 100 songs. Remove a song to add another.</p>}
  {pickerOpen&&<section id="worship-song-picker" aria-label="Song library">
   <label>Search songs to add<input ref={searchInput} type="search" value={search} placeholder="Song title or artist" onChange={event=>setSearch(event.target.value)}/></label>
   {churchError&&<p role="status">Church search unavailable. {churchError}</p>}
   <div className="setlist-search-results">{results.map(({song,source})=><button type="button" key={source+song.id}
    disabled={ids.length>=100} onClick={()=>addCandidate(song,source)}>
    <strong>{song.title}</strong> <small>{source==='personal'?'My songbook':'Church library'}{song.artist&&` · ${song.artist}`}</small>
   </button>)}</div>
   {results.length===0&&<p>{search.trim()?'No matching songs. Choose Add new song to create a chart.':'No songs in the library yet.'}</p>}
  </section>}
  <h3>Song order</h3>
  {entries.length===0&&<p>Add songs to start building this set.</p>}
  <ol className="setlist-songs">{entries.map(({song_id,key_override},index)=>{
   const song=personal.find(item=>item.id===song_id)
   return <li key={song_id+'-'+index}>
    <span>{song?.title??'Song removed from library'} <strong className="key-badge">{song?.key||'Not set'}</strong></span>
    {song&&<label>Sounding key<select aria-label={'Sounding key for song '+(index+1)} value={key_override??''} disabled={!songKey(song.key)}
     onChange={event=>setEntries(entries.map((entry,i)=>i===index?{...entry,key_override:event.target.value||undefined}:entry))}>
     <option value="">Song key</option>{soundingTonics.map(note=><option key={note} value={note}>{setlistSoundingKey(song.key,note)}</option>)}
    </select>{!songKey(song.key)&&<small>Set a recognized song key to transpose.</small>}</label>}
    <div className="worship-set-actions">
     {song&&<button type="button" onClick={event=>onSongEditor(song,saved=>{
      rememberSong(saved)
      setNotice(`Saved your arrangement of “${saved.title}”.`)
     },event.currentTarget)}>Edit arrangement</button>}
     <button type="button" disabled={index===0} aria-label={'Move song '+(index+1)+' up'} onClick={()=>move(index,-1)}>↑</button>
     <button type="button" disabled={index===entries.length-1} aria-label={'Move song '+(index+1)+' down'} onClick={()=>move(index,1)}>↓</button>
     <button type="button" onClick={()=>setEntries(entries.filter((_,i)=>i!==index))}>Remove</button>
    </div>
   </li>
  })}</ol>
  <div className="worship-set-actions">
   <button type="button" className="worship-primary" onClick={()=>void action(save)}>Save setlist</button>
   <button type="button" onClick={()=>{if(!allowNavigation())return;clearDraft(selected?.id??'new');setEditing(false);onBack()}}>Cancel</button>
  </div>
 </fieldset>:null}<p role="status">{notice}</p></section>
}
