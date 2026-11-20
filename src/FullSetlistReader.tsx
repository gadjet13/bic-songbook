import SetlistPrint from './SetlistPrint'
import SetlistCopy from './SetlistCopy'
import ReadingColumns from './ReadingColumns'
import ReadingTextSize from './ReadingTextSize'
import type { ReaderColumns } from './lib/reader-lines'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Song } from './App'
import SetlistCues, { CueText } from './SetlistCues'
import { songCueLocation } from './lib/cue-locations'
import { useSetlistCues } from './lib/setlist-cues'
import SetlistSongNote from './SetlistSongNote'
import { displaySong } from './SongChart'
import { arrangedSong, setlistSoundingKey, songKey } from './lib/setlist-arrangement'
import { cachedPreference, initializeSetlistCapo, legacyCapo } from './lib/setlist-preferences'

export type FullReaderControls = {
  userId:string
  preferenceId:string|null
  canEditTeamCues:boolean
  legacyId:string|null
  offline:boolean
  content:'lyrics'|'chords'
  changeContent:(content:'lyrics'|'chords')=>void
  changeCapo:(songId:number,fret:number)=>void
  exit:()=>void
  wakeStatus:string
  preferenceError:string
  fontSize:number
  changeFontSize:(size:number)=>void
  readerColumns:ReaderColumns
  changeColumns:(columns:ReaderColumns)=>void
  onEditRaw?:(song:Song,occurrence:string,trigger:HTMLElement)=>void
  editingOccurrence?:string
  editor?:ReactNode
  cancelEditing:()=>void
}

export default function FullSetlistReader({title,songs,controls,shareOptions}:{
  title:string
  songs:(Song|undefined)[]
  controls:FullReaderControls
  shareOptions?:ReactNode
}){
  const {userId,preferenceId,legacyId,offline,content,changeContent,changeCapo,exit,wakeStatus,preferenceError,fontSize,changeFontSize,readerColumns,changeColumns}=controls
  const latestControls=useRef(controls)
  latestControls.current=controls
  const heading=useRef<HTMLHeadingElement>(null)
  const sections=useRef(new Map<string,HTMLHeadingElement>())
  const counts=new Map<number,number>()
  const entries=songs.map((song,index)=>{
    const occurrence=song?(counts.get(song.id)??0)+1:index
    if(song)counts.set(song.id,occurrence)
    return {song,index,id:song?`${song.id}-${occurrence}`:`missing-${index}`}
  })
  const localId=preferenceId??legacyId
  const {cues,failure:cueError,save:saveCue}=useSetlistCues(userId,preferenceId,offline)
  const available=entries.filter(row=>row.song)
  const order=available.map(row=>row.id).join(',')
  const toolbar=useRef<HTMLElement>(null)
  const reader=useRef<HTMLElement>(null)
  const [currentId,setCurrentId]=useState('')
  const commanded=useRef<{id:string;top:number}|null>(null)
  const currentIndex=Math.max(0,available.findIndex(row=>row.id===currentId))

  function jumpTo(id:string) {
    const target=sections.current.get(id)
    if(!target)return
    const offset=(toolbar.current?.offsetHeight??0)+8
    window.scrollTo({top:target.getBoundingClientRect().top+window.scrollY-offset,behavior:'instant'})
    commanded.current={id,top:window.scrollY}
    setCurrentId(id)
    target.focus({preventScroll:true})
  }

  useEffect(()=>{
    window.scrollTo(0,0)
    heading.current?.focus({preventScroll:true})
    const close=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!event.defaultPrevented&&!event.repeat&&
        !(event.target instanceof HTMLElement&&event.target.matches('input, textarea, select'))){
        event.preventDefault()
        const current=latestControls.current
        if(current.editingOccurrence)current.cancelEditing()
        else current.exit()
      }
    }
    window.addEventListener('keydown',close)
    return ()=>window.removeEventListener('keydown',close)
  },[])
  useEffect(()=>{
    const ids=order?order.split(','):[]
    let frame=0
    function update() {
      const offset=(toolbar.current?.offsetHeight??0)+10
      const pinned=commanded.current
      if(pinned&&ids.includes(pinned.id)&&Math.abs(window.scrollY-pinned.top)<1)return
      commanded.current=null
      let current=ids[0]??''
      for(const id of ids){
        const target=sections.current.get(id)
        if(target&&target.getBoundingClientRect().top<=offset)current=id
      }
      setCurrentId(current)
    }
    function schedule() {
      if(frame)return
      frame=requestAnimationFrame(()=>{frame=0;update()})
    }
    window.addEventListener('scroll',schedule,{passive:true})
    const observer=new ResizeObserver(schedule)
    if(reader.current)observer.observe(reader.current)
    if(toolbar.current)observer.observe(toolbar.current)
    update()
    return ()=>{
      window.removeEventListener('scroll',schedule)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  },[order])
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

  return <section ref={reader} className="full-set-reader" aria-label="Full set reader">
    <h1 ref={heading} tabIndex={-1}>{title}</h1>
    <nav ref={toolbar} className="full-set-toolbar" aria-label="Full set controls">
      <div className="full-set-navigation" role="group" aria-label="Song navigation">
        <button type="button" disabled={currentIndex===0} onClick={()=>jumpTo(available[currentIndex-1].id)}>Previous song</button>
        <span aria-label={available.length?`Song ${currentIndex+1} of ${available.length}`:'No songs available'}>
          {available.length?`${currentIndex+1} / ${available.length}`:'—'}
        </span>
        <button type="button" disabled={currentIndex+1>=available.length} onClick={()=>jumpTo(available[currentIndex+1].id)}>Next song</button>
      </div>
      <label>Jump to song<select value={available[currentIndex]?.id??''} disabled={!available.length} onChange={event=>jumpTo(event.target.value)}>
        <option value="" disabled>Choose a song</option>
        {entries.map(({song,index,id})=>song&&<option key={id} value={id}>{index+1}. {song.title}</option>)}
      </select></label>
      <div role="group" aria-label="Reading content">
        <button aria-pressed={content==='lyrics'} onClick={()=>changeContent('lyrics')}>Lyrics</button>
        <button aria-pressed={content==='chords'} onClick={()=>changeContent('chords')}>Chords</button>
      </div>
      <ReadingColumns value={readerColumns} onChange={changeColumns}/>
      <ReadingTextSize value={fontSize} onChange={changeFontSize}/>
      <button onClick={exit}>Exit reader</button>
    </nav>
    <div className="full-set-actions">
      {localId&&<SetlistPrint title={title} songs={songs} userId={userId} listId={localId} legacyListId={legacyId??undefined} cues={cues}/>}
      <SetlistCopy songs={songs.filter(song=>song!==undefined)}/>
      {shareOptions}
    </div>
    {offline&&<p>Offline · Reading a saved copy</p>}
    {wakeStatus&&<small role="status">{wakeStatus}</small>}
    {cueError&&<p role="status">{cueError}</p>}
    {preferenceError&&<p role="status">{preferenceError}</p>}
    {!entries.length&&<p>No songs in this setlist yet.</p>}
    {entries.map(({song,index,id})=>{
      if(!song)return <p key={id}>{index+1}. Song unavailable</p>
      const preference=localId?cachedPreference(userId,localId,song.id,legacyId??localId):null
      const capo=preference?.capo??0
      const chart=arrangedSong(song,capo)
      const songCues=cues.filter(cue=>cue.song_id===song.id)
      const editing=controls.editingOccurrence===id
      const titleId='full-set-song-'+id
      return <article key={id} className="full-set-song" aria-labelledby={titleId}>
        <h2 id={titleId} tabIndex={-1} ref={element=>{
          if(element)sections.current.set(id,element)
          else sections.current.delete(id)
        }}>{index+1}. {song.title}</h2>
        <CueText cues={songCues} location={songCueLocation}/>
        <div className="full-set-song-settings">
          <span>Sounding key: {setlistSoundingKey(song.key,song.setlist_key)||'Not set'}</span>
          {localId&&songKey(song.key)&&<label>My capo<select disabled={editing} value={capo}
            onChange={event=>changeCapo(song.id,Number(event.target.value))}>
            {Array.from({length:12},(_,fret)=><option key={fret} value={fret}>{fret===0?'No capo':fret}</option>)}
          </select></label>}
          {!!capo&&content==='chords'&&<span>Chord shapes: {chart.key}</span>}
          {preference?.pending&&<small role="status">Capo change waiting to sync.</small>}
        </div>
        {preference?.note&&<p className="full-set-note"><strong>My notes</strong> {preference.note}</p>}
        {localId&&<SetlistSongNote userId={userId} listId={localId} songId={song.id}
          note={preference?.note??''} offline={offline||!preferenceId} label={preference?.note?'Edit my notes':'My notes'}/>}
        {preferenceId&&!editing&&<SetlistCues key={preferenceId+':'+id}
          songId={song.id} content={song.content} cues={songCues} canEditTeam={controls.canEditTeamCues} offline={offline} save={saveCue}/>}
        {controls.onEditRaw&&<button type="button" hidden={editing}
          onClick={event=>controls.onEditRaw?.(song,id,event.currentTarget)}>Edit raw content</button>}
        {editing&&controls.editor}
        <div hidden={editing} className="full-set-chart reader-chart" data-columns={readerColumns} style={{fontSize}}>
          {displaySong(chart.content,0,chart.key,true,content==='chords',location=><CueText cues={songCues} location={location}/>)}
        </div>
      </article>
    })}
  </section>
}
