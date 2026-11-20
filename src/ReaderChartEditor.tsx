type Props={
 content:string; onChange:(value:string)=>void; baseKey:string; busy:boolean; canSave:boolean
 error:string; onSave:()=>void; onCancel:()=>void; dirty:boolean
}

export default function ReaderChartEditor({content,onChange,baseKey,busy,canSave,error,onSave,onCancel,dirty}:Props){
 return <fieldset className="reader-chart-editor" disabled={busy}>
  <legend tabIndex={-1} data-reader-edit-heading>Edit raw chart</legend>
  <p>Chords are in the saved key {baseKey||'(unspecified)'}. Saving updates your personal chart wherever it’s used.</p>
  <p>Start section headings with <code># </code>, for example <code># Verse 1 [slight soft]</code>.</p>
  <label>Raw chart content<textarea className="reader-raw-chart" spellCheck={false} value={content.replace(/\r\n/g,'\n')}
    onChange={event=>{
      const text=event.currentTarget.value
      onChange(content.includes('\r\n')?text.replace(/\n/g,'\r\n'):text)
    }}/></label>
  {error&&<p role="alert">{error}</p>}
  <div className="reader-edit-actions">
   <button type="button" disabled={dirty&&!canSave} onClick={onSave}>{busy?'Saving…':dirty?'Save and return to reading':'Return to reading'}</button>
   <button type="button" onClick={onCancel}>Cancel</button>
  </div>
 </fieldset>
}
