import { setlistEntries, setlistSoundingKey, songKey, soundingTonics } from './lib/setlist-arrangement'
import type { SetlistEntry, SetlistOrder } from './lib/setlist-arrangement'
import LibrarySortControl from './LibrarySortControl'
import {sortLibraryItems} from './lib/library-sort'
import type {LibrarySort,LibraryDates} from './lib/library-sort'
import OfflineSetlistStatus from './OfflineSetlistStatus'
import type {OfflineSnapshot} from './lib/offline-readiness'
import {readSetlistDrafts,saveSetlistDraft,removeSetlistDraft,canResumeSetlistDraft,setlistDraftKey} from './lib/setlist-drafts'
import type {SetlistDraft} from './lib/setlist-drafts'
import {loginPersistence} from './lib/login-storage'
import SetlistKeyOverview from './SetlistKeyOverview'
import { useEffect, useRef, useState } from 'react'
import { loadSongs, cloud } from './lib/cloud'
import type { Song } from './App'
import type { OfflineList } from './lib/offline'
import SetlistLimitPanel from './SetlistLimitPanel'
import SetlistCopy from './SetlistCopy'
import SetlistPrint from './SetlistPrint'
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
export default function SongOrganization({songs,canEdit,onOpen,ownerId,offlineLists,churchSongs,onSongsChanged,personalName,activeId,onNavigate,onBack,offlineSnapshot,refreshing}: {offlineSnapshot?:OfflineSnapshot;refreshing?:boolean;activeId:string|null;onNavigate:(id:string,saved?:boolean)=>void;onBack:()=>void;personalName:string;churchSongs:Song[];onSongsChanged:()=>Promise<void>;offlineLists?:OfflineList[];songs:Song[];canEdit:boolean;ownerId:string|null;onOpen:(songs:Song[],listId?:string,index?:number,missing?:number)=>void}) {
 const [listSort,setListSort]=useState<LibrarySort>('added-newest')
 const [church,setChurch]=useState(churchSongs),[churchError,setChurchError]=useState('')
 useEffect(()=>{let active=true;if(offlineLists){setChurch(churchSongs);return}setChurch(churchSongs);void loadSongs(null).then(rows=>{if(active){setChurch(rows);setChurchError('')}}).catch(error=>{if(active)setChurchError(message(error))});return()=>{active=false}},[ownerId,churchSongs,offlineLists])
 const [personal,setPersonal]=useState(songs)
 useEffect(()=>{setPersonal(previous=>{const merged=new Map(previous.map(song=>[song.id,song]));for(const song of songs){const old=merged.get(song.id);if(!old||(song.revision??0)>=(old.revision??0))merged.set(song.id,song)}return [...merged.values()]})},[songs])
 const [lists,setLists]=useState<Setlist[]>([]),[selected,setSelected]=useState<Setlist|null>(null)
 const [title,setTitle]=useState(''),[entries,setEntries]=useState<SetlistEntry[]>([]),[search,setSearch]=useState(''),[recipient,setRecipient]=useState('')
 const [shares,setShares]=useState<{id:string;recipient_email:string}[]>([]),[friends,setFriends]=useState<{email:string;nickname:string}[]>([])
 const [editing,setEditing]=useState(false),[limit,setLimit]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false)
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
 function choose(list:Setlist){if(pendingDraft.current?.listId===list.id){applyDraft(pendingDraft.current,list);return}setSelected(list);setTitle(list.title);setEntries(setlistEntries(list));setEditing(false);setSearch('');setNotice('');if(!offlineLists)void cloud!.rpc('recover_setlist_songs',{list_id:list.id}).then(async({data,error})=>{if(error){setNotice(error.message);return}if(data?.length){setPersonal(rows=>[...rows.filter(row=>!data.some((song:Song)=>song.id===row.id)),...data]);await onSongsChanged();setNotice('Missing setlist songs restored to your personal songbook.')}})}
 useEffect(()=>{setLimit(false);setSearch('');setRecipient('');setNotice('');if(activeId==='new'){if(pendingDraft.current)applyDraft(pendingDraft.current,null);else{setSelected(null);setTitle('');setEntries([]);setEditing(true)}}else if(!activeId){setSelected(null);setEditing(false)}},[activeId])
 useEffect(()=>{if(activeId&&activeId!=='new'&&selected?.id!==activeId){const list=lists.find(row=>row.id===activeId);if(list)choose(list)}},[activeId,lists,selected?.id])
 useEffect(()=>{
  if(!ownerId||!canEdit||!activeId||!editing)return
  if((activeId==='new'&&selected)||(activeId!=='new'&&selected?.id!==activeId))return
  const id=selected?.id??'new'
  if(!dirty){if(readSetlistDrafts(ownerId).some(row=>row.id===id))clearDraft(id);return}
  setDrafts(saveSetlistDraft(ownerId,{id,listId:selected?.id??null,baseRevision:selected?.revision,title,songIds:ids,songEntries:entries,updatedAt:new Date().toISOString()}))
  setDraftStatus(loginPersistence.isPersisted(setlistDraftKey(ownerId))?'Setlist draft saved on this browser. Save setlist to update the database.':'Draft is only in memory. Browser storage is unavailable or full; save before closing this tab.')
 },[ownerId,canEdit,activeId,editing,dirty,title,JSON.stringify(entries),selected?.id,selected?.revision])
 async function loadShares(id:string){if(offlineLists)return;const {data,error}=await cloud!.from('songbook_setlist_shares').select('id,recipient_email').eq('setlist_id',id);if(error)throw error;setShares(data??[])}
 useEffect(()=>{setShares([]);if(selected&&!offlineLists)void loadShares(selected.id).catch(error=>setNotice(message(error)))},[selected?.id,offlineLists])
 async function loadFriends(){if(!ownerId||offlineLists)return;const {data,error}=await cloud!.from('songbook_friends').select('email,nickname').eq('owner_id',ownerId).order('email');if(error)throw error;setFriends(data??[])}
 async function action(fn:()=>Promise<void>){setBusy(true);setNotice('');try{await fn()}catch(error){setNotice(message(error))}finally{setBusy(false)}}
 async function addCandidate(song:Song,source:'personal'|'church'){if(source==='personal'){setEntries(values=>[...values,{song_id:song.id}]);setSearch('');return}await action(async()=>{const {data,error}=await cloud!.rpc('ensure_personal_church_song',{church_song_id:song.id});if(error)throw error;setPersonal(rows=>rows.some(row=>row.id===data.id)?rows:[...rows,data]);setEntries(values=>[...values,{song_id:data.id}]);setSearch('');await onSongsChanged();setNotice('Church song added using your personal version.')})}
 async function save(){if(offlineLists)throw new Error('Reconnect before saving setlists.');if(!title.trim())throw new Error('Enter a setlist name.');if(!selected&&lists.length>=25){setLimit(true);return}const fields={title:title.trim(),song_entries:entries};const result=selected?await cloud!.from('songbook_setlists').update(fields).eq('id',selected.id).eq('revision',selected.revision).select().maybeSingle():await cloud!.from('songbook_setlists').insert({...fields,owner_id:ownerId}).select().single();if(result.error)throw result.error;if(!result.data)throw new Error('Someone changed this setlist. Copy your changes, then refresh and try again.');clearDraft(selected?.id??'new');await refresh();choose(result.data);onNavigate(result.data.id,true);setNotice('Setlist saved.');void onSongsChanged().catch(error=>setNotice('Setlist saved, but refreshing failed: '+message(error)))}
 function move(index:number,direction:number){const next=[...entries];[next[index],next[index+direction]]=[next[index+direction],next[index]];setEntries(next)}
 const slots=(list:Setlist)=>setlistEntries(list).map(entry=>{
  const song=personal.find(item=>item.id===entry.song_id)
  return song ? {...song,setlist_key:entry.key_override} : undefined
 })
 const queue=(list:Setlist)=>slots(list).filter(song=>song!==undefined)
 if(!activeId)return <section className="setlist-panel setlist-index" aria-label="My setlists">{!!drafts.length&&<section className="draft-recovery" aria-label="Recover unsaved setlists"><h3>Unsaved setlist drafts</h3><p>Stored in this browser only. Recovering does not change a saved setlist.</p>{drafts.map(draft=><div className="draft-row" key={draft.id}><span>{draft.title||'Untitled setlist'} · {draft.songIds.length} songs · {new Date(draft.updatedAt).toLocaleString()}</span><button disabled={busy||!canEdit||!loaded} onClick={()=>void recoverDraft(draft)}>Recover setlist draft</button><button disabled={busy} onClick={()=>{if(window.confirm('Permanently discard this setlist draft?'))clearDraft(draft.id)}}>Discard setlist draft</button></div>)}</section>}<div className="setlist-tools"><button disabled={busy} onClick={()=>void action(async()=>{await refresh()})}>Refresh setlists</button>{canEdit&&<button disabled={busy} onClick={startNew}>New setlist</button>}</div><LibrarySortControl label="Setlists" value={listSort} onChange={setListSort}/><div className="setlist-cards">{sortLibraryItems(lists,listSort).map(list=>{
  const playable=queue(list)
  return <article className="library-setlist-card" key={list.id}>
   <button className="setlist-card-title" disabled={busy} onClick={()=>onNavigate(list.id)}>{list.title}</button>
   <p>{list.song_ids.length} {list.song_ids.length===1?'song':'songs'}</p>
   <OfflineSetlistStatus compact snapshot={offlineSnapshot} userId={ownerId??''} list={list} songs={songs}/>
   {!playable.length&&<small>{list.song_ids.length?'No available songs':'Add a song to start this setlist'}</small>}
   <button className="primary-action" disabled={busy||!playable.length} onClick={()=>onOpen(playable,list.id,0,list.song_ids.length-playable.length)}>Start setlist</button>
  </article>
 })}</div>{loaded&&!lists.length&&<p>No setlists yet.</p>}<p role="status">{notice}</p></section>
 return <section className="setlist-page" aria-label="Setlist page"><button className="back-button" onClick={onBack}>← Back to setlists</button><h2>{activeId==='new'?'New setlist':selected?.title??'Setlist'}</h2>
 {!editing&&!selected&&<p>{loaded?'This setlist is no longer available.':'Loading setlist…'}</p>}
 {editing&&draftStatus&&<p className="storage-note" role="status">{draftStatus}</p>}
 {limit&&ownerId&&<SetlistLimitPanel ownerId={ownerId} title={title} songIds={ids} songEntries={entries} onCreated={list=>{clearDraft('new');setLimit(false);choose(list);onNavigate(list.id,true);void refresh()}} onCancel={onBack}/>}
 {editing?<fieldset disabled={!canEdit||busy}><label>Setlist name<input maxLength={200} value={title} placeholder="Sunday service" onChange={event=>setTitle(event.target.value)}/></label><ol className="setlist-songs">{ids.map((id,index)=><li key={id+'-'+index}><span>{personal.find(song=>song.id===id)?.title??'Song removed from library'} <strong className="key-badge">{personal.find(song=>song.id===id)?.key||'Not set'}</strong></span>{(()=>{const song=personal.find(item=>item.id===id);return song&&<label>Sounding key<select
  aria-label={'Sounding key for song '+(index+1)} value={entries[index].key_override??''} disabled={!songKey(song.key)}
  onChange={event=>setEntries(entries.map((entry,i)=>i===index?{...entry,key_override:event.target.value||undefined}:entry))}>
  <option value="">Song key</option>{soundingTonics.map(note=><option key={note} value={note}>{setlistSoundingKey(song.key,note)}</option>)}
 </select>{!songKey(song.key)&&<small>Set a recognized song key to transpose.</small>}</label>})()}<button disabled={index===0} aria-label={'Move song '+(index+1)+' up'} onClick={()=>move(index,-1)}>↑</button><button disabled={index===ids.length-1} aria-label={'Move song '+(index+1)+' down'} onClick={()=>move(index,1)}>↓</button><button onClick={()=>setEntries(entries.filter((_,i)=>i!==index))}>Remove</button></li>)}</ol><label>Search songs to add<input type="search" value={search} placeholder="Song title or artist" onChange={event=>setSearch(event.target.value)}/></label><p role="status">{churchError&&`Church search unavailable: ${churchError}`}</p>{search.trim()&&<div className="setlist-search-results">{results.map(({song,source})=><button key={source+song.id} disabled={ids.length>=100} onClick={()=>void addCandidate(song,source)}>＋ {song.title} · {source==='personal'?personalName:'BIC · copies to My songbook'} {song.artist&&`· ${song.artist}`}</button>)}{!results.length&&<p>No matching songs.</p>}</div>}<button onClick={()=>void action(save)}>Save setlist</button><button onClick={()=>{if(!allowNavigation())return;clearDraft(selected?.id??'new');setEditing(false);if(selected)choose(selected);else onBack()}}>Cancel</button></fieldset>:selected&&<>
 <OfflineSetlistStatus snapshot={offlineSnapshot} userId={ownerId??''} list={selected} songs={songs} offline={!!offlineLists} onSave={onSongsChanged} disabled={refreshing||busy}/>
 <SetlistKeyOverview songs={slots(selected)} onOpen={index=>{const playable=queue(selected);onOpen(playable,selected.id,slots(selected).slice(0,index).filter(Boolean).length,selected.song_ids.length-playable.length)}}/>
 <div className="setlist-primary-actions"><button disabled={!queue(selected).length} onClick={()=>{const playable=queue(selected);onOpen(playable,selected.id,0,selected.song_ids.length-playable.length)}}>Start setlist</button>{canEdit&&<button disabled={busy} onClick={()=>{const draft=drafts.find(row=>row.listId===selected.id);if(draft)void recoverDraft(draft);else{setTitle(selected.title);setEntries(setlistEntries(selected));setEditing(true)}}}>Edit setlist</button>}</div>
 <div className="setlist-copy-row"><SetlistCopy songs={queue(selected)}/></div>
 {ownerId&&<SetlistPrint title={selected.title} songs={slots(selected)} userId={ownerId} listId={selected.id}/>}
 {!offlineLists&&<details className="setlist-sharing" onToggle={event=>{if(event.currentTarget.open)void loadFriends().catch(error=>setNotice(message(error)))}}><summary>Sharing</summary><p>Share only this live setlist. Manage your friends from the Friends tab on the home page.</p>{!!friends.length&&<label>Choose recipient<select value={recipient} onChange={event=>setRecipient(event.target.value)}><option value="">Choose a friend or enter an email below</option>{friends.map(friend=><option key={friend.email} value={friend.email}>{friend.nickname||friend.email}</option>)}</select></label>}<form onSubmit={event=>{event.preventDefault();void action(async()=>{const {error}=await cloud!.rpc('share_setlist',{list_id:selected.id,recipient_email_address:recipient});if(error)throw error;await loadShares(selected.id);setRecipient('');setNotice('Shared. Your friend can find it under Shared with me. Saved changes update automatically.')})}}><label>Share with account email<input type="email" required value={recipient} onChange={event=>setRecipient(event.target.value)}/></label><button disabled={busy}>Share setlist</button></form>{shares.map(share=><p key={share.id}>{share.recipient_email} <button disabled={busy} onClick={()=>void action(async()=>{const {error}=await cloud!.from('songbook_setlist_shares').delete().eq('id',share.id);if(error)throw error;await loadShares(selected.id)})}>Revoke sharing</button></p>)}</details>}
 {canEdit&&<details className="setlist-delete"><summary>Delete setlist</summary><button disabled={busy} onClick={()=>{if(window.confirm('Delete setlist '+selected.title+'? Songs will stay in the library.'))void action(async()=>{const {data,error}=await cloud!.from('songbook_setlists').delete().eq('id',selected.id).eq('revision',selected.revision).select('id');if(error)throw error;if(!data?.length)throw new Error('Setlist changed. Refresh before deleting.');await refresh();onBack()})}}>Delete this setlist</button></details>}
 </>}<p role="status">{notice}</p></section>
}
