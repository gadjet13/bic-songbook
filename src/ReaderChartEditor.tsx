import { useId, useLayoutEffect, useRef } from 'react'

type Props={
 content:string; onChange:(value:string)=>void; baseKey:string; busy:boolean; canSave:boolean
 error:string; onSave:()=>void; onCancel:()=>void; dirty:boolean
 songTitle?:string
}

export default function ReaderChartEditor({content,onChange,baseKey,busy,canSave,error,onSave,onCancel,dirty,songTitle}:Props){
 const dialog=useRef<HTMLDialogElement>(null)
 const heading=useRef<HTMLLegendElement>(null)
 const headingId=useId()

 useLayoutEffect(()=>{
  const modal=dialog.current
  if(!modal)return
  modal.showModal()
  heading.current?.focus({preventScroll:true})
  return ()=>modal.close()
 },[])

 const editor=<fieldset className="reader-chart-editor" disabled={busy}>
  <legend id={headingId} ref={heading} tabIndex={-1} data-reader-edit-heading>
   {songTitle?`Edit raw chart · ${songTitle}`:'Edit raw chart'}
  </legend>
  <p>Chords are in the saved key {baseKey||'(unspecified)'}. Saving updates your personal chart wherever it’s used.</p>
  <p>Start section headings with <code># </code>, for example <code># Verse 1 [slight soft]</code>.</p>
  <label>Raw chart content<textarea className="reader-raw-chart" spellCheck={false} value={content.replace(/\r\n/g,'\n')}
    onChange={event=>{
      const text=event.currentTarget.value
      onChange(content.includes('\r\n')?text.replace(/\n/g,'\r\n'):text)
    }}/></label>
  {error&&<p role="alert">{error}</p>}
  <div className="reader-edit-actions">
   {songTitle?<>
    <button type="button" className="worship-primary" disabled={!dirty||!canSave} onClick={onSave}>
     {busy?'Saving…':'Save and return to setlist'}
    </button>
    <button type="button" onClick={onCancel}>Back to setlist</button>
   </>:<>
    <button type="button" disabled={dirty&&!canSave} onClick={onSave}>{busy?'Saving…':dirty?'Save and return to reading':'Return to reading'}</button>
    <button type="button" onClick={onCancel}>Cancel</button>
   </>}
  </div>
 </fieldset>
 return songTitle?<dialog ref={dialog} className="setlist-chart-dialog" aria-labelledby={headingId}
  onCancel={event=>{event.preventDefault();onCancel()}}>
  {editor}
 </dialog>:editor
}
