import { hasFlowConflicts, mapFlowCursor, syncLinkedSections } from './lib/song-flow'

type Props={
 content:string; onChange:(value:string)=>void; baseKey:string; busy:boolean; canSave:boolean
 error:string; onSave:()=>void; onCancel:()=>void; dirty:boolean
}

export default function ReaderChartEditor({content,onChange,baseKey,busy,canSave,error,onSave,onCancel,dirty}:Props){
 const conflict=hasFlowConflicts(content)
 return <fieldset className="reader-chart-editor" disabled={busy}>
  <legend tabIndex={-1} data-reader-edit-heading>Edit raw chart</legend>
  <p>Chords are in the saved key {baseKey||'(unspecified)'}. Saving updates your personal chart wherever it’s used.</p>
  <label>Raw chart content<textarea className="reader-raw-chart" spellCheck={false} value={content.replace(/\r\n/g,'\n')}
    onChange={event=>{
     const input=event.currentTarget
     const encode=(text:string)=>content.includes('\r\n')?text.replace(/\n/g,'\r\n'):text
     const next=encode(input.value),start=encode(input.value.slice(0,input.selectionStart)).length
     const end=encode(input.value.slice(0,input.selectionEnd)).length
     const synced=syncLinkedSections(content,next)
     onChange(synced)
     if(synced!==next)requestAnimationFrame(()=>{
      if(!input.isConnected||input.value!==synced.replace(/\r\n/g,'\n'))return
      const caret=(offset:number)=>synced.slice(0,mapFlowCursor(next,synced,offset)).replace(/\r\n/g,'\n').length
      input.setSelectionRange(caret(start),caret(end))
     })
    }}/></label>
  {conflict&&<p role="alert">Repeated section names have different content. Give each variation a unique heading before saving.</p>}
  {error&&<p role="alert">{error}</p>}
  <div className="reader-edit-actions">
   <button type="button" disabled={dirty&&(!canSave||conflict)} onClick={onSave}>{busy?'Saving…':dirty?'Save and return to reading':'Return to reading'}</button>
   <button type="button" onClick={onCancel}>Cancel</button>
  </div>
 </fieldset>
}
