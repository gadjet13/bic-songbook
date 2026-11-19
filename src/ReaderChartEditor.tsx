import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FormEvent, PointerEvent } from 'react'
import { chordPlacementBoundaries, editPositionedLyrics, movePositionedChord, parseChordPositions, putPositionedChord } from './lib/chord-position'
import { changeBarChord, editableBar, legacyChordRows, performanceChord, storedChord } from './lib/reader-chart-edit'
import type { ChartPitch } from './lib/reader-chart-edit'
import { isChordToken } from './lib/chord/transpose'
import { hasFlowConflicts, mapFlowCursor, syncLinkedSections } from './lib/song-flow'

type Slot={line:number;offset:number;bar?:boolean;index?:number}
const trailingChordPositions=10
type DragPreview={label:string;x:number;y:number;target:HTMLElement|null;origin:Slot}
type ChordChoice={slot:Slot;value:string;original?:string}
type Props={
 content:string; onChange:(value:string)=>void; pitch:ChartPitch; baseKey:string; busy:boolean; canSave:boolean
 error:string; onSave:()=>void; onCancel:()=>void; dirty:boolean
}

export default function ReaderChartEditor({content,onChange,pitch,baseKey,busy,canSave,error,onSave,onCancel,dirty}:Props){
 const [raw,setRaw]=useState(false),[choice,setChoice]=useState<ChordChoice|null>(null),[notice,setNotice]=useState(''),[moving,setMoving]=useState<Slot|null>(null)
 const root=useRef<HTMLFieldSetElement>(null),drag=useRef<{slot:Slot;x:number;y:number;content:string}|null>(null)
 const [dragPreview,setDragPreview]=useState<DragPreview|null>(null)
 const suppressClick=useRef(false),returnFocus=useRef<HTMLElement|null>(null)
 const rows=content.split('\n'),legacy=legacyChordRows(rows),conflict=hasFlowConflicts(content)
 function commit(next:string){
  const synced=syncLinkedSections(content,next)
  onChange(synced)
  return synced
 }
 function toggleRaw(next:boolean){
  setChoice(null);setMoving(null);setNotice('');setRaw(next)
  if(next)requestAnimationFrame(()=>root.current?.querySelector<HTMLTextAreaElement>('.reader-raw-chart')?.focus())
 }
 function choose(slot:Slot,label:string|undefined,trigger:HTMLElement){
  if(suppressClick.current){suppressClick.current=false;return}
  if(moving&&!label){move(moving,slot);setMoving(null);setNotice('');return}
  setMoving(null)
  returnFocus.current=trigger
  setChoice({slot,original:label,value:label?performanceChord(label,pitch):''})
  setNotice('')
 }
 function applyChord(event:FormEvent){
  event.preventDefault()
  if(!choice)return
  const {slot,original}=choice,label=choice.value.trim()
  if(!isChordToken(label)){setNotice('Enter a chord such as C, F#m, or D/F#.');return}
  const next=original&&label===performanceChord(original,pitch)?original:storedChord(label,pitch,baseKey)
  commit(slot.bar?changeBarChord(content,slot.line,slot.offset,next):putPositionedChord(content,slot.line,slot.offset,next,slot.index,trailingChordPositions))
  closeChoice()
 }
 function closeChoice(){
  setChoice(null);setNotice('')
  requestAnimationFrame(()=>{returnFocus.current?.scrollIntoView({block:'nearest',inline:'nearest'});returnFocus.current?.focus({preventScroll:true})})
 }
 function move(from:Slot,to:Slot){
  if(!!from.bar!==!!to.bar){setNotice('Choose a destination in the same kind of chord row.');return}
  if(from.bar){
   const cell=editableBar(rows[from.line])?.find(part=>part.offset===from.offset&&part.chord)
   if(cell)commit(changeBarChord(content,to.line,to.offset,cell.text,from))
  }else if(from.index!==undefined){
   const next=movePositionedChord(content,from.line,from.index,to.line,to.offset,trailingChordPositions)
   if(next)commit(next.content)
  }
 }
 function startDrag(event:PointerEvent<HTMLButtonElement>,slot:Slot){
  if(event.button!==0||choice)return
  suppressClick.current=false
  drag.current={slot,x:event.clientX,y:event.clientY,content}
  event.currentTarget.setPointerCapture(event.pointerId)
 }
 function destination(x:number,y:number,from:Slot){
  const hit=document.elementFromPoint(x,y)
  if(!hit||!root.current?.contains(hit))return null
  const exact=hit.closest<HTMLElement>('[data-reader-slot]')
  if(exact&&(exact.dataset.bar==='true')===!!from.bar)return exact
  if(from.bar)return null
  const line=hit.closest('.reader-lyric-edit')
  if(!line)return null
  let nearest:HTMLElement|null=null,distance=Infinity
  for(const slot of line.querySelectorAll<HTMLElement>('[data-reader-slot]')){
   const box=slot.getBoundingClientRect()
   const delta=Math.abs(x-(box.left+box.width/2))
   if(box.width&&delta<distance){nearest=slot;distance=delta}
  }
  return nearest
 }
 function previewDrag(event:PointerEvent<HTMLButtonElement>){
  const active=drag.current
  if(!active||active.content!==content||Math.hypot(active.x-event.clientX,active.y-event.clientY)<6)return
  setDragPreview({label:event.currentTarget.textContent??'',origin:active.slot,x:event.clientX,y:event.clientY,
   target:destination(event.clientX,event.clientY,active.slot)})
 }
 function cancelDrag(){
  drag.current=null
  setDragPreview(null)
 }
 function drop(event:PointerEvent<HTMLButtonElement>){
  const active=drag.current
  cancelDrag()
  if(!active||active.content!==content||Math.hypot(active.x-event.clientX,active.y-event.clientY)<6)return
  suppressClick.current=true
  setTimeout(()=>{suppressClick.current=false},0)
  const at=destination(event.clientX,event.clientY,active.slot)
  if(at)move(active.slot,{line:Number(at.dataset.line),offset:Number(at.dataset.readerSlot),bar:at.dataset.bar==='true'})
 }
 function lyrics(line:number,next:string,caret:number,joinPrevious=false){
  const result=editPositionedLyrics(content,line,next,caret,joinPrevious)
  if(!result){setNotice('Use raw content to enter chord markers or section headings.');return}
  setNotice('')
  const synced=commit(result.content)
  if(result.line!==line||next.includes('\n')||joinPrevious||synced!==result.content)requestAnimationFrame(()=>{
   const start=result.content.split('\n').slice(0,result.line).reduce((offset,row)=>offset+row.length+1,0)
   const mapped=mapFlowCursor(result.content,synced,start)
   const targetLine=synced.slice(0,mapped).split('\n').length-1
   const input=root.current?.querySelector<HTMLTextAreaElement>(`[data-lyric-line="${targetLine}"]`)
   input?.focus();input?.setSelectionRange(result.caret,result.caret)
  })
 }
 return <fieldset ref={root} className="reader-chart-editor" disabled={busy}>
  {dragPreview&&createPortal(<span aria-hidden="true" className="reader-drag-chord" style={{left:dragPreview.x,top:dragPreview.y}}>{dragPreview.label}</span>,document.body)}
  <legend tabIndex={-1} data-reader-edit-heading>Edit chart</legend>
  <p>{raw?`Saved key ${baseKey||'unspecified'}`:`Playing chords in ${pitch.key||'the saved key'} · Saved key ${baseKey||'unspecified'}`}. Saving updates your personal chart wherever it’s used.</p>
  <div className="reader-edit-actions">
   <button type="button" onClick={()=>toggleRaw(!raw)}>{raw?'Show visual editor':'Show raw content'}</button>
   <button type="button" disabled={!canSave||conflict} onClick={()=>choice||moving?setNotice('Apply or cancel the chord change before saving.'):onSave()}>{busy?'Saving…':dirty?'Save and lock':'Lock editing'}</button>
   <button type="button" onClick={onCancel}>Cancel editing</button>
  </div>
  {conflict&&<p role="alert">Repeated section names have different content. Give each variation a unique heading in raw content before saving.</p>}
  {error&&<p role="alert">{error}</p>}
  {raw?<label>Raw chart content<textarea className="reader-raw-chart" value={content.replace(/\r\n/g,'\n')}
   onChange={event=>{
    const input=event.currentTarget,crlf=content.includes('\r\n'),encode=(value:string)=>crlf?value.replace(/\n/g,'\r\n'):value
    const next=encode(input.value),start=encode(input.value.slice(0,input.selectionStart)).length
    const synced=commit(next)
    if(synced!==next)requestAnimationFrame(()=>{
     if(!input.isConnected)return
     const caret=synced.slice(0,mapFlowCursor(next,synced,start)).replace(/\r\n/g,'\n').length
     input.setSelectionRange(caret,caret)
    })
   }}/></label>:<>
   <p>Tap the chord row to add a chord. Tap a chord to change it, or drag it to a new position. Use the arrow keys on a chord to move it.</p>
   {moving&&<p role="status">Tap a new position for the chord. <button type="button" onClick={()=>setMoving(null)}>Cancel move</button></p>}
   {choice&&<form className="reader-edit-actions reader-chord-picker" onSubmit={applyChord} onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();closeChoice()}
   }}><label>Chord<input autoFocus value={choice.value} onChange={event=>setChoice({...choice,value:event.target.value})}/></label>
    <button type="submit">Apply chord</button>{choice.original&&<button type="button" onClick={()=>{setMoving(choice.slot);closeChoice()}}>Move chord</button>}<button type="button" onClick={closeChoice}>Cancel chord</button></form>}
   {rows.map((row,line)=>{
    const model=parseChordPositions(row),bar=editableBar(row)
    if(model.heading)return <p className="position-heading" key={line}>{row.trim().startsWith('# ')?row.trim().slice(2):row.trim().slice(1,-1)}</p>
    if(legacy.has(line))return <p className="reader-legacy-line" key={line}>{row} <button type="button" onClick={()=>toggleRaw(true)}>Edit legacy line in raw content</button></p>
    const chordButton=(slot:Slot,label:string,nudge:(direction:number)=>void,style?:React.CSSProperties)=><button type="button"
     className="reader-edit-chord" style={style}
     data-drag-origin={dragPreview?.origin.line===slot.line&&dragPreview.origin.offset===slot.offset&&dragPreview.origin.index===slot.index||undefined} key={slot.index??slot.offset}
     aria-label={`Edit chord ${performanceChord(label,pitch)}, line ${line+1}`}
     onClick={event=>choose(slot,label,event.currentTarget)} onPointerDown={event=>startDrag(event,slot)} onPointerMove={previewDrag} onPointerUp={drop}
     onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} onKeyDown={event=>{
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();nudge(event.key==='ArrowLeft'?-1:1)}
     }}>{performanceChord(label,pitch)}</button>
    if(bar)return <div className="reader-bar-edit" key={line}>{bar.map(cell=>{
     const slot={line,offset:cell.offset,bar:true}
     if(cell.chord)return chordButton(slot,cell.text,direction=>{
      const open=bar.filter(part=>part.text==='/'&&Math.sign(part.offset-cell.offset)===direction)
      const destination=direction<0?open.at(-1):open[0]
      if(destination)move(slot,{line,offset:destination.offset,bar:true})
     })
     if(cell.text==='/')return <button type="button" key={cell.offset} data-line={line} data-bar="true" data-reader-slot={cell.offset}
      data-drag-target={dragPreview?.target?.dataset.line===String(line)&&dragPreview?.target?.dataset.readerSlot===String(cell.offset)||undefined}
      aria-label={`Add chord at open beat, line ${line+1}`} onClick={event=>choose(slot,undefined,event.currentTarget)}>/</button>
     return <span key={cell.offset}>{cell.text}</span>
    })}</div>
    const positions=chordPlacementBoundaries(model.lyrics,trailingChordPositions),characters=Array.from(model.lyrics),ends:number[]=[]
    const chordButtons=model.chords.map(entry=>{
     const column=positions.indexOf(entry.position),width=performanceChord(entry.label,pitch).length+3
     let lane=ends.findIndex(end=>end<=column)
     if(lane<0)lane=ends.length
     ends[lane]=column+width
     const slot={line,offset:entry.position,index:entry.index}
     return {column,button:chordButton(slot,entry.label,direction=>move(slot,{line,offset:positions[Math.max(0,Math.min(positions.length-1,column+direction))]}),
      {left:0,bottom:`${30+lane*36}px`})}
    })
    return <div className="reader-lyric-edit" key={line}><div className="reader-lyric-track" style={{minWidth:`${Math.max(16,positions.length+3,...ends)}ch`}}>
     <div className="reader-edit-chord-row" style={{paddingTop:ends.length*36}}>
      <div className="reader-edit-slots">{positions.map((offset,column)=><div className="reader-lyric-slot" key={offset}>
       <span aria-hidden="true">{characters[column]??' '}</span>
       <button type="button" tabIndex={column===0?0:-1} data-line={line} data-reader-slot={offset}
        data-drag-target={dragPreview?.target?.dataset.line===String(line)&&dragPreview?.target?.dataset.readerSlot===String(offset)||undefined}
        aria-label={`Add chord at character ${column+1}, line ${line+1}`} onClick={event=>choose({line,offset},undefined,event.currentTarget)}>+</button>
       {chordButtons.filter(chord=>chord.column===column).map(chord=>chord.button)}
      </div>)}</div>
     </div>
     <textarea rows={1} wrap="off" data-lyric-line={line} aria-label={`Lyrics line ${line+1}`} value={model.lyrics}
      onChange={event=>lyrics(line,event.target.value,event.target.selectionStart)}
      onKeyDown={event=>{
       const input=event.currentTarget
       if((event.altKey&&event.key==='Enter')){
        event.preventDefault();choose({line,offset:input.selectionStart},undefined,input)
       }else if(line>0&&!legacy.has(line-1)&&!editableBar(rows[line-1])&&!parseChordPositions(rows[line-1]).heading&&
        event.key==='Backspace'&&input.selectionStart===0&&input.selectionEnd===0){
        event.preventDefault();lyrics(line,model.lyrics,0,true)
       }
      }}/>
    </div></div>
   })}
   <small>Keyboard: press Alt+Enter in a lyric line to add a chord at the cursor.</small>
  </>}
  <p role="status">{notice}</p>
 </fieldset>
}
