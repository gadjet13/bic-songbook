import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { Song } from './App'
import type { NewSongInput, prepareNewSong } from './lib/new-song'
import { songVersionDetails } from './lib/song-dates'
import { displaySong } from './SongChart'

export default function AddSongForm({input,onChange,chart,matches,personal,inSet,offline,busy,error,onSave,onCancel,onUseExisting,onOpenExisting}:{
  input:NewSongInput
  onChange:(value:NewSongInput)=>void
  chart:ReturnType<typeof prepareNewSong>
  matches:Song[]
  personal:boolean
  inSet:boolean
  offline:boolean
  busy:boolean
  error:string
  onSave:()=>void
  onCancel:()=>void
  onUseExisting:(song:Song)=>void
  onOpenExisting:(song:Song)=>void
}){
  const update=(value:Partial<NewSongInput>)=>onChange({...input,...value})
  const duplicate=matches.length>0
  const keyHint=useId()
  const chartId=useId()
  const [previewOpen,setPreviewOpen]=useState(false)
  const showSuggestedKey=!input.key&&!!chart.suggestedKey
  function submit(event:FormEvent){
    event.preventDefault()
    if(!offline&&!busy&&(!duplicate||personal))onSave()
  }
  return <form className="add-song-form song-form" onSubmit={submit}>
    <h2 tabIndex={-1} data-setlist-song-heading>Add song</h2>
    <fieldset className="new-song-fields" disabled={busy}>
      <label>Title<input required maxLength={300} value={input.title||chart.suggestedTitle}
        onChange={event=>update({title:event.target.value})}/></label>
      <label>Key<input required maxLength={20} value={input.key||chart.suggestedKey} placeholder="e.g. D or F#m"
        aria-describedby={showSuggestedKey?keyHint:undefined} onChange={event=>update({key:event.target.value})}/></label>
      {showSuggestedKey&&<small id={keyHint}>Suggested from the chart</small>}
      <label>Artist (optional)<input maxLength={300} value={input.artistEntered?input.artist:input.artist||chart.suggestedArtist}
        onChange={event=>update({artist:event.target.value,artistEntered:true})}/></label>
      <fieldset className="chart-input-formats">
        <legend>Chart format</legend>
        <label><input type="radio" name="chart-format" checked={input.mode==='chord-sheet'}
          onChange={()=>update({mode:'chord-sheet'})}/> Chords above lyrics</label>
        <label><input type="radio" name="chart-format" checked={input.mode==='formatted'}
          onChange={()=>update({mode:'formatted'})}/> Formatted chart</label>
        <label><input type="radio" name="chart-format" checked={input.mode==='chordpro'}
          onChange={()=>update({mode:'chordpro'})}/> ChordPro</label>
      </fieldset>
      <label htmlFor={chartId}>Chart</label>
      <textarea id={chartId} className="song-editor" required value={input.text}
        placeholder={input.mode==='chordpro'?'{title: My Song}\n{key: D}\n[D]Lyrics with [G]chords':input.mode==='formatted'?'# Verse 1\n{D}Lyrics with {G}chords':'D            G\nLyrics with chords'}
        onChange={event=>update({text:event.target.value})}/>
      {input.alternate&&<button type="button" onClick={()=>{
        const {mode,text}=input.alternate!
        update({mode,text,alternate:{mode:input.mode,text:input.text}})
      }}>Switch to the other recovered chart text</button>}
      {chart.sectionsRenamed&&<p role="status">Section variations were numbered so each keeps its own lyrics and chords.</p>}
      {!!chart.warnings.length&&<p role="status">
        Check chord placement on {chart.warnings.length===1?'line':'lines'} {chart.warnings.map(warning=>warning.line).join(', ')}.
      </p>}
      {!!chart.unsupportedDirectives.length&&<p role="status">Check the preview. ChordPro features without a BIC equivalent: {chart.unsupportedDirectives.join(', ')}.</p>}
      {chart.content.trim()&&<details className="new-song-preview" onToggle={event=>setPreviewOpen(event.currentTarget.open)}>
        <summary>Preview chart</summary>
        {previewOpen&&<div className="chord-paste-chart song-display" role="region" aria-label="Chart preview">
          {displaySong(chart.content,0,chart.key,true)}
        </div>}
      </details>}
      {duplicate&&<div className="duplicate-song-notice">
        <p>{personal?'This title already exists. Saving creates a separate personal arrangement.':'This title already exists in the church library. Open the match or use a different title.'}</p>
        {inSet&&matches.map(song=><button type="button" key={song.id} disabled={offline}
          onClick={()=>onUseExisting(song)}>Use existing chart{matches.length>1?` · ${songVersionDetails(song,matches)}`:''}</button>)}
        {!personal&&<button type="button" onClick={()=>onOpenExisting(matches[0])}>Open existing chart</button>}
      </div>}
      {personal&&!duplicate&&<p className="storage-note">The first chart for this title also goes to the church songbook.</p>}
      {offline&&<p role="status">Reconnect to save this song.</p>}
      {error&&<p role="alert">{error}</p>}
    </fieldset>
    <div className="edit-buttons">
      <button type="submit" className="save-button" disabled={busy||offline||(duplicate&&!personal)}>
        {busy?'Saving…':inSet?'Save and add to setlist':'Save song'}
      </button>
      <button type="button" className="cancel-button" disabled={busy} onClick={onCancel}>Cancel</button>
    </div>
  </form>
}
