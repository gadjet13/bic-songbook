import StageReader, { useStageView } from './StageReader'
import { stageSearch } from './lib/stage-url'
import { appPath } from './lib/app-routes'
import { isSetlistPath, setlistLink } from './lib/setlist-links'
import SetlistPrint from './SetlistPrint'
import SetlistCopy from './SetlistCopy'
import ReadingColumns from './ReadingColumns'
import ReadingTextSize from './ReadingTextSize'
import type { ReaderColumns } from './lib/reader-lines'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Song } from './App'
import { CueAnchor, UnplacedCues } from './SetlistCues'
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
  requestedRaw?:string
  routeVersion:number
  onEditRaw?:(song:Song,occurrence:string,trigger:HTMLElement)=>void
  editing?:{occurrence:string;trigger:HTMLElement}
  editor?:ReactNode
}

export default function FullSetlistReader({title,songs,controls,shareToken,shareLink,shareOptions}:{
  title:string
  songs:(Song|undefined)[]
  controls:FullReaderControls
  shareToken?: string | null
  shareLink?:ReactNode
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
  const viewOptions=useRef<HTMLDetailsElement>(null)
  const reader=useRef<HTMLElement>(null)
  const [currentId,setCurrentId]=useState('')
  const commanded=useRef<{id:string;top:number}|null>(null)
  const returnToSong=useRef<FullReaderControls['editing']>(undefined)
  const currentIndex=Math.max(0,available.findIndex(row=>row.id===currentId))
  const stage=useStageView(!controls.editor)
  const stageIndex=Math.max(0,available.findIndex(row=>row.id===stage.view?.song))
  const stageSong=stage.view && available[stageIndex]?.id
  const lastStageSong=useRef<string | null>(null)
  useEffect(()=>{
    if(stageSong)lastStageSong.current=stageSong
    else if(lastStageSong.current){
      jumpTo(lastStageSong.current)
      lastStageSong.current=null
    }
  },[stageSong])


  useEffect(() => {
    const entry = history.state
    if (offline || shareToken === undefined || !entry?.bicFullSet || entry.bicRawChart ||
        (entry.bicShared ? entry.bicShared !== legacyId : entry.bicSetlist !== preferenceId)) return
    if (shareToken || isSetlistPath()) {
      const address = shareToken ? setlistLink(shareToken) : appPath(entry)
      history.replaceState({ ...entry, bicReaderUser: userId }, '', address + stageSearch())
    }
  }, [shareToken, offline, userId, legacyId, preferenceId, controls.routeVersion])

  useEffect(()=>{
    const occurrence=controls.requestedRaw
    if(!occurrence||controls.editing||!controls.onEditRaw)return
    const entry=entries.find(row=>row.id===occurrence)
    const trigger=reader.current?.querySelector<HTMLElement>(`[data-raw-occurrence="${CSS.escape(occurrence)}"]`)
    if(entry?.song&&trigger)controls.onEditRaw(entry.song,occurrence,trigger)
  },[controls.requestedRaw,controls.routeVersion,order,!!controls.onEditRaw])

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
      if(latestControls.current.editor||stageSearch())return
      if(event.key==='Escape'&&!event.defaultPrevented&&viewOptions.current?.open){
        event.preventDefault()
        viewOptions.current.open=false
        viewOptions.current.querySelector('summary')?.focus()
        return
      }
      if(event.key==='Escape'&&!event.defaultPrevented&&!event.repeat&&
        !(event.target instanceof HTMLElement&&event.target.matches('input, textarea, select'))){
        event.preventDefault()
        latestControls.current.exit()
      }
    }
    window.addEventListener('keydown',close)
    return ()=>window.removeEventListener('keydown',close)
  },[])
  const editing=controls.editing
  useEffect(()=>{
    if(editing){
      returnToSong.current=editing
      return
    }
    const target=returnToSong.current
    if(!target)return
    returnToSong.current=undefined
    const frame=requestAnimationFrame(()=>{
      if(!sections.current.has(target.occurrence))return
      jumpTo(target.occurrence)
      target.trigger.focus({preventScroll:true})
    })
    return ()=>cancelAnimationFrame(frame)
  },[editing])

  useEffect(()=>{
    const ids=order?order.split(','):[]
    let frame=0
    function update() {
      if(latestControls.current.editor)return
      const offset=(toolbar.current?.offsetHeight??0)+10
      const pinned=commanded.current
      if(pinned&&ids.includes(pinned.id)&&Math.abs(window.scrollY-pinned.top)<1)return
      commanded.current=null
      let current=ids[0]??''
      for(const id of ids){
        const target=sections.current.get(id)
        if(target&&target.getBoundingClientRect().top<=offset)current=id
      }
      const last=ids.at(-1)
      const atBottom=window.scrollY>0&&window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-1
      if(last&&atBottom&&(sections.current.get(last)?.getBoundingClientRect().top??Infinity)<window.innerHeight){
        current=last
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
      <label><span className="reader-jump-label">Jump to song</span><select value={available[currentIndex]?.id??''} disabled={!available.length} onChange={event=>jumpTo(event.target.value)}>
        <option value="" disabled>Choose a song</option>
        {entries.map(({song,index,id})=>song&&<option key={id} value={id}>{index+1}. {song.title}</option>)}
      </select></label>
      <details ref={viewOptions} className="reader-view-options">
        <summary>View options</summary>
        <div className="reader-option-controls">
          <div role="group" aria-label="Reading content">
            <button aria-pressed={content==='lyrics'} onClick={()=>changeContent('lyrics')}>Lyrics</button>
            <button aria-pressed={content==='chords'} onClick={()=>changeContent('chords')}>Chords</button>
          </div>
          <ReadingColumns value={readerColumns} onChange={changeColumns}/>
          <ReadingTextSize value={fontSize} onChange={changeFontSize}/>
        </div>
      </details>
      <button type="button" disabled={!!controls.editor||!available.length} onClick={()=>stage.open(available[currentIndex]?.id)}>One-page view</button>
      <button className="reader-exit" onClick={exit}>Exit reader</button>
    </nav>
    {shareLink}
    <div className="full-set-actions">
      {localId&&<SetlistPrint title={title} songs={songs} userId={userId} listId={localId} legacyListId={legacyId??undefined} cues={cues}/>}
      <SetlistCopy title={title} songs={songs.filter(song=>song!==undefined)}/>
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
      const titleId='full-set-song-'+id
      const cueControls=preferenceId?{
        songId:song.id,cues:songCues,canEditTeam:controls.canEditTeamCues,offline,save:saveCue
      }:null
      function songHeading(title:ReactNode) {
        return <h2 id={titleId} tabIndex={-1} ref={element=>{
          if(element)sections.current.set(id,element)
          else sections.current.delete(id)
        }}>{title}</h2>
      }
      return <article key={id} className="full-set-song" aria-labelledby={titleId}>
        <CueAnchor location={songCueLocation} title={`${index+1}. ${song.title}`}
          heading={songHeading} controls={cueControls}/>
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
        <div className="full-set-song-actions">
          {localId&&<SetlistSongNote userId={userId} listId={localId} songId={song.id}
            note={preference?.note??''} offline={offline||!preferenceId} label={preference?.note?'Edit my notes':'My notes'}/>}
          {cueControls&&<UnplacedCues content={song.content} controls={cueControls}/>}
          {controls.onEditRaw&&<button type="button" data-raw-occurrence={id}
            onClick={event=>controls.onEditRaw?.(song,id,event.currentTarget)}>Edit raw content</button>}
        </div>
        <div className="full-set-chart reader-chart" data-columns={readerColumns} style={{fontSize}}>
          {displaySong(chart.content,0,chart.key,true,content==='chords',(location,label)=>
            <CueAnchor key={location} location={location} title={label}
              heading={title=><div className="song-section">{title}</div>} controls={cueControls}/>)}
        </div>
      </article>
    })}
    {controls.editor}
    {stage.view&&<StageReader setlist index={stageIndex} exit={stage.close}
      select={index=>stage.open(available[index]?.id)}
      charts={available.map(({song,id})=>{
        const item=song!
        const preference=localId?cachedPreference(userId,localId,item.id,legacyId??localId):null
        const capo=preference?.capo??0
        const {content,key}=arrangedSong(item,capo)
        return {id,title:item.title,content,key,capo,
          soundingKey:setlistSoundingKey(item.key,item.setlist_key),note:preference?.note,
          cues:cues.filter(cue=>cue.song_id===item.id)}
      })}/>}
  </section>
}
