import ReadingColumns from './ReadingColumns'
import type { ReaderColumns } from './lib/reader-lines'
import { useEffect, useRef } from 'react'
import type { Song } from './App'
import SetlistSongNote from './SetlistSongNote'
import { displaySong } from './SongChart'
import { arrangedSong, setlistSoundingKey, songKey } from './lib/setlist-arrangement'
import { cachedPreference, initializeSetlistCapo, legacyCapo } from './lib/setlist-preferences'

export type FullReaderControls = {
  userId:string
  preferenceId:string|null
  legacyId:string|null
  offline:boolean
  content:'lyrics'|'chords'
  changeContent:(content:'lyrics'|'chords')=>void
  changeCapo:(songId:number,fret:number)=>void
  exit:()=>void
  wakeStatus:string
  preferenceError:string
  fontSize:number
  readerColumns:ReaderColumns
  changeColumns:(columns:ReaderColumns)=>void
}

export default function FullSetlistReader({title,songs,controls}:{
  title:string
  songs:(Song|undefined)[]
  controls:FullReaderControls
}){
  const {userId,preferenceId,legacyId,offline,content,changeContent,changeCapo,exit,wakeStatus,preferenceError,fontSize,readerColumns,changeColumns}=controls
  const heading=useRef<HTMLHeadingElement>(null)
  const sections=useRef(new Map<string,HTMLHeadingElement>())
  const counts=new Map<number,number>()
  const entries=songs.map((song,index)=>{
    const occurrence=song?(counts.get(song.id)??0)+1:index
    if(song)counts.set(song.id,occurrence)
    return {song,index,id:song?`${song.id}-${occurrence}`:`missing-${index}`}
  })
  const localId=preferenceId??legacyId

  useEffect(()=>{
    window.scrollTo(0,0)
    heading.current?.focus({preventScroll:true})
    const close=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!event.defaultPrevented&&!event.repeat&&
        !(event.target instanceof HTMLElement&&event.target.matches('textarea, select'))){
        event.preventDefault()
        exit()
      }
    }
    window.addEventListener('keydown',close)
    return ()=>window.removeEventListener('keydown',close)
  },[])
  const songIds=[...counts.keys()].join(',')
  useEffect(()=>{
    if(!preferenceId||!legacyId||offline||!songIds)return
    for(const id of songIds.split(',').map(Number)){
      const cached=cachedPreference(userId,preferenceId,id,legacyId)
      const legacy=legacyCapo(userId,legacyId,id)
      if(legacy!==null&&cached.savedCapo===null&&!cached.pending){
        void initializeSetlistCapo(userId,preferenceId,id,legacy).catch(()=>{})
      }
    }
  },[preferenceId,legacyId,userId,offline,songIds])

  return <section className="full-set-reader" aria-label="Full set reader">
    <h1 ref={heading} tabIndex={-1}>{title}</h1>
    <nav className="full-set-toolbar" aria-label="Full set controls">
      <label>Jump to song<select value="" disabled={!entries.some(row=>row.song)} onChange={event=>{
        const target=sections.current.get(event.target.value)
        target?.scrollIntoView({block:'start'})
        target?.focus({preventScroll:true})
      }}>
        <option value="" disabled>Choose a song</option>
        {entries.map(({song,index,id})=>song&&<option key={id} value={id}>{index+1}. {song.title}</option>)}
      </select></label>
      <div role="group" aria-label="Reading content">
        <button aria-pressed={content==='lyrics'} onClick={()=>changeContent('lyrics')}>Lyrics</button>
        <button aria-pressed={content==='chords'} onClick={()=>changeContent('chords')}>Chords</button>
      </div>
      <ReadingColumns value={readerColumns} onChange={changeColumns}/>
      <button onClick={exit}>Exit reader</button>
    </nav>
    {offline&&<p>Offline · Reading a saved copy</p>}
    {wakeStatus&&<small role="status">{wakeStatus}</small>}
    {preferenceError&&<p role="status">{preferenceError}</p>}
    {!entries.length&&<p>No songs in this setlist yet.</p>}
    {entries.map(({song,index,id})=>{
      if(!song)return <p key={id}>{index+1}. Song unavailable</p>
      const preference=localId?cachedPreference(userId,localId,song.id,legacyId??localId):null
      const capo=preference?.capo??0
      const chart=arrangedSong(song,capo)
      const titleId='full-set-song-'+id
      return <article key={id} className="full-set-song" aria-labelledby={titleId}>
        <h2 id={titleId} tabIndex={-1} ref={element=>{
          if(element)sections.current.set(id,element)
          else sections.current.delete(id)
        }}>{index+1}. {song.title}</h2>
        <div className="full-set-song-settings">
          <span>Sounding key: {setlistSoundingKey(song.key,song.setlist_key)||'Not set'}</span>
          {localId&&songKey(song.key)&&<label>My capo<select value={capo}
            onChange={event=>changeCapo(song.id,Number(event.target.value))}>
            {Array.from({length:12},(_,fret)=><option key={fret} value={fret}>{fret===0?'No capo':fret}</option>)}
          </select></label>}
          {!!capo&&content==='chords'&&<span>Chord shapes: {chart.key}</span>}
          {preference?.pending&&<small role="status">Capo change waiting to sync.</small>}
        </div>
        {preference?.note&&<p className="full-set-note"><strong>My notes</strong> {preference.note}</p>}
        {localId&&<SetlistSongNote userId={userId} listId={localId} songId={song.id}
          note={preference?.note??''} offline={offline||!preferenceId} label={preference?.note?'Edit my notes':'My notes'}/>}
        <div className="full-set-chart" data-columns={readerColumns} style={{fontSize}}>
          {displaySong(chart.content,0,chart.key,true,content==='chords')}
        </div>
      </article>
    })}
  </section>
}
