import { cachedPreference } from './lib/setlist-preferences'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Song } from './App'
import { displaySong } from './SongChart'
import { arrangedSong, setlistSoundingKey, songKey } from './lib/setlist-arrangement'

type PrintMode = 'order' | 'lyrics' | 'chords'

export default function SetlistPrint({title,songs,userId,listId,legacyListId=listId}:{
  title:string
  songs:(Song|undefined)[]
  userId:string
  listId:string
  legacyListId?:string
}) {
  const [mode,setMode]=useState<PrintMode>('order')
  const [useCapo,setUseCapo]=useState(false)
  const [printing,setPrinting]=useState(false)

  useEffect(()=>{
    if(!printing)return
    const done=()=>setPrinting(false)
    window.addEventListener('afterprint',done,{once:true})
    const frame=requestAnimationFrame(()=>{
      try{window.print()}catch{done()}
    })
    return ()=>{
      cancelAnimationFrame(frame)
      window.removeEventListener('afterprint',done)
    }
  },[printing])

  return <details className="copy-options setlist-print">
    <summary>Print setlist</summary>
    <label>Print format
      <select value={mode} onChange={event=>setMode(event.target.value as PrintMode)}>
        <option value="order">Order and keys</option>
        <option value="lyrics">Lyrics</option>
        <option value="chords">Lyrics + chords</option>
      </select>
    </label>
    {mode==='chords'&&<label className="print-capo">
      <input type="checkbox" checked={useCapo} onChange={event=>setUseCapo(event.target.checked)}/>
      Use my capo shapes
    </label>}
    <button disabled={!songs.length||printing} onClick={()=>setPrinting(true)}>Open print dialog</button>
    {printing&&createPortal(<article className="setlist-print-output">
      <h1>{title}</h1>
      <ol>
        {songs.map((song,index)=><li key={index}>{song ? <>
          {song.title} · {setlistSoundingKey(song.key,song.setlist_key)||'Key not set'}
        </>:'Song unavailable'}</li>)}
      </ol>
      {mode!=='order'&&songs.map((song,index)=>{
        if(!song)return null
        const fret=mode==='chords'&&useCapo&&songKey(song.key)?cachedPreference(userId,listId,song.id,legacyListId).capo:0
        const chart=arrangedSong(song,fret)
        const sounding=setlistSoundingKey(song.key,song.setlist_key)
        return <section className="setlist-print-song" key={index}>
          <h2>{index+1}. {song.title}</h2>
          <p>Sounding key: {sounding||'Not set'}{fret>0&&<> · Capo {fret} · Chord shapes: {chart.key}</>}</p>
          {displaySong(chart.content,0,chart.key,true,mode==='chords')}
        </section>
      })}
    </article>,document.body)}
  </details>
}
