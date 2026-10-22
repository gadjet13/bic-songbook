import {readSetlistDrafts,saveSetlistDraft,removeSetlistDraft,setlistDraftKey} from './lib/setlist-drafts'
import {loginPersistence} from './lib/login-storage'
import { useEffect, useState } from 'react'
import SetlistLimitPanel from './SetlistLimitPanel'
import useUnsavedChanges from './useUnsavedChanges'
import { allowNavigation } from './lib/unsaved'
import { cloud } from './lib/cloud'

type List = {id:string;title:string;song_ids:number[];revision:number}
export default function AddToSetlist({songId,ownerId}:{songId:number;ownerId:string}) {
 const [open,setOpen]=useState(false)
 const [lists,setLists]=useState<List[]>([])
 const [chosen,setChosen]=useState('')
 const [newTitle,setNewTitle]=useState(()=>readSetlistDrafts(ownerId).find(row=>row.id==='new'&&row.fromSongId===songId)?.title??'')
 const existingNew=readSetlistDrafts(ownerId).find(row=>row.id==='new')
 const blocked=!!existingNew&&existingNew.fromSongId!==songId
 const [draftNotice,setDraftNotice]=useState('')
 const [limit,setLimit]=useState(false)
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 useUnsavedChanges(open&&!!newTitle.trim())
 useEffect(()=>{if(!open||blocked)return;if(!newTitle.trim()){if(readSetlistDrafts(ownerId).some(row=>row.id==='new'&&row.fromSongId===songId))removeSetlistDraft(ownerId,'new');return}saveSetlistDraft(ownerId,{id:'new',listId:null,fromSongId:songId,title:newTitle,songIds:[songId],updatedAt:new Date().toISOString()});setDraftNotice(loginPersistence.isPersisted(setlistDraftKey(ownerId))?'New-setlist draft saved on this browser.':'Draft is only in memory; save before closing this tab.')},[open,newTitle,songId,ownerId,blocked])
 async function load(){
  setBusy(true);setNotice('')
  try {const {data,error}=await cloud!.from('songbook_setlists').select('id,title,song_ids,revision').eq('owner_id',ownerId).order('title');if(error)throw error;setLists(data??[])}
  catch(error){setNotice((error as {message:string}).message)}finally{setBusy(false)}
 }
 async function add(){
  const list=lists.find(row=>row.id===chosen);if(!list)return
  if(list.song_ids.includes(songId)){setNotice('This song is already in that setlist.');return}
  if(list.song_ids.length>=100){setNotice('This setlist already has 100 songs.');return}
  setBusy(true);setNotice('')
  try {
   const ids=[...list.song_ids,songId]
   const {data,error}=await cloud!.from('songbook_setlists').update({song_ids:ids}).eq('id',list.id).eq('owner_id',ownerId).eq('revision',list.revision).select('id,title,song_ids,revision').maybeSingle()
   if(error)throw error
   if(!data)throw new Error('The setlist changed. Refresh the choices and try again.')
   setLists(rows=>rows.map(row=>row.id===data.id?data:row));setNotice(`Added to ${list.title}. Shared setlists update automatically.`)
  }catch(error){setNotice((error as {message:string}).message)}finally{setBusy(false)}
 }
 async function create(){
  if(!newTitle.trim())return
  if(lists.length>=25){setLimit(true);return}
  setBusy(true);setNotice('')
  try{const {data,error}=await cloud!.from('songbook_setlists').insert({title:newTitle.trim(),song_ids:[songId],owner_id:ownerId}).select('id,title,song_ids,revision').single();if(error)throw error;setLists(rows=>[...rows,data]);setChosen(data.id);removeSetlistDraft(ownerId,'new');setNewTitle('');setDraftNotice('');setNotice(`Created ${data.title} with this song first.`)}catch(error){setNotice((error as {message:string}).message)}finally{setBusy(false)}
 }
 return <div className="add-to-setlist"><button aria-expanded={open} onClick={()=>{if(open&&!allowNavigation())return;setOpen(!open);if(!open)void load()}}>{open?'Close setlist choices':'Add to setlist'}</button>{open&&<div>
 <label>Choose personal setlist<select disabled={busy} value={chosen} onChange={event=>setChosen(event.target.value)}><option value="">Choose a setlist</option>{lists.map(list=><option key={list.id} value={list.id}>{list.title}</option>)}</select></label>
 <button disabled={busy||!chosen} onClick={()=>void add()}>Add song</button><button disabled={busy} onClick={()=>void load()}>Refresh choices</button>
 {!busy&&!lists.length&&<p>No setlists yet. Create one below.</p>}
 <p>{lists.length} / 25 personal setlists</p><form onSubmit={event=>{event.preventDefault();void create()}}><label>New setlist name<input disabled={busy||blocked} maxLength={200} value={newTitle} onChange={event=>setNewTitle(event.target.value)} placeholder="Sunday worship"/></label><button disabled={busy||blocked||!newTitle.trim()}>Create setlist with this song</button></form>
 {limit&&<SetlistLimitPanel ownerId={ownerId} title={newTitle} songIds={[songId]} onCreated={list=>{setLimit(false);setLists(rows=>[...rows.filter(row=>row.id!==list.id),list]);setChosen(list.id);removeSetlistDraft(ownerId,'new');setNewTitle('');setDraftNotice('');void load();setNotice('New setlist created.')}} onCancel={()=>{if(!allowNavigation())return;setLimit(false);removeSetlistDraft(ownerId,'new');setNewTitle('');setDraftNotice('');setNotice('Creation cancelled. Choose an existing setlist to review.')}}/>}
<p className="storage-note">{blocked?'You already have a new-setlist draft. Recover or discard it in My Setlists before creating another.':draftNotice}</p>
 <p role="status">{notice}</p></div>}</div>
}

