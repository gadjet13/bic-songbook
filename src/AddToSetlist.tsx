import { useState } from 'react'
import { cloud } from './lib/cloud'

type List = {id:string;title:string;song_ids:number[];revision:number}
export default function AddToSetlist({songId,ownerId}:{songId:number;ownerId:string}) {
 const [open,setOpen]=useState(false)
 const [lists,setLists]=useState<List[]>([])
 const [chosen,setChosen]=useState('')
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
   setLists(rows=>rows.map(row=>row.id===data.id?data:row));setNotice(`Added to ${list.title}. Shared copies stay unchanged until you share again.`)
  }catch(error){setNotice((error as {message:string}).message)}finally{setBusy(false)}
 }
 return <div className="add-to-setlist"><button aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void load()}}>{open?'Close setlist choices':'Add to setlist'}</button>{open&&<div>
 <label>Choose personal setlist<select disabled={busy} value={chosen} onChange={event=>setChosen(event.target.value)}><option value="">Choose a setlist</option>{lists.map(list=><option key={list.id} value={list.id}>{list.title}</option>)}</select></label>
 <button disabled={busy||!chosen} onClick={()=>void add()}>Add song</button><button disabled={busy} onClick={()=>void load()}>Refresh choices</button>
 {!busy&&!lists.length&&<p>Create a personal setlist from the song list → Setlists → New setlist, then return here.</p>}
 <p role="status">{notice}</p></div>}</div>
}
