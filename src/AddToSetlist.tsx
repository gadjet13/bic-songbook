import { useState } from 'react'
import { cloud } from './lib/cloud'

type List = {id:string;title:string;song_ids:number[];revision:number}
export default function AddToSetlist({songId,ownerId}:{songId:number;ownerId:string}) {
 const [open,setOpen]=useState(false)
 const [lists,setLists]=useState<List[]>([])
 const [chosen,setChosen]=useState('')
 const [newTitle,setNewTitle]=useState('')
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
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
  setBusy(true);setNotice('')
  try{const {data,error}=await cloud!.from('songbook_setlists').insert({title:newTitle.trim(),song_ids:[songId],owner_id:ownerId}).select('id,title,song_ids,revision').single();if(error)throw error;setLists(rows=>[...rows,data]);setChosen(data.id);setNewTitle('');setNotice(`Created ${data.title} with this song first.`)}catch(error){setNotice((error as {message:string}).message)}finally{setBusy(false)}
 }
 return <div className="add-to-setlist"><button aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void load()}}>{open?'Close setlist choices':'Add to setlist'}</button>{open&&<div>
 <label>Choose personal setlist<select disabled={busy} value={chosen} onChange={event=>setChosen(event.target.value)}><option value="">Choose a setlist</option>{lists.map(list=><option key={list.id} value={list.id}>{list.title}</option>)}</select></label>
 <button disabled={busy||!chosen} onClick={()=>void add()}>Add song</button><button disabled={busy} onClick={()=>void load()}>Refresh choices</button>
 {!busy&&!lists.length&&<p>No setlists yet. Create one below.</p>}
 <p>{lists.length} / 25 personal setlists</p><form onSubmit={event=>{event.preventDefault();void create()}}><label>New setlist name<input disabled={busy} maxLength={200} value={newTitle} onChange={event=>setNewTitle(event.target.value)} placeholder="Sunday worship"/></label><button disabled={busy||!newTitle.trim()||lists.length>=25}>Create setlist with this song</button></form>
 <p role="status">{notice}</p></div>}</div>
}
