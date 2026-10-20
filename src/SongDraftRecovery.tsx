import type { SongDraft } from './lib/song-drafts'
export default function SongDraftRecovery({drafts,canRestore,onRestore,onDiscard}:{drafts:SongDraft[];canRestore:boolean;onRestore:(draft:SongDraft)=>void;onDiscard:(draft:SongDraft)=>void}){
 if(!drafts.length)return null
 return <section className="draft-recovery" aria-label="Recover unsaved songs"><h2>Unsaved song drafts</h2><p>These drafts are on this browser only. Recover one to review it; your saved songs have not changed.</p>{drafts.map(draft=><div className="draft-row" key={draft.id}><span><strong>{draft.title||'Untitled song'}</strong> · {draft.songId===null?'New song':'Edited song'}<small> · {new Date(draft.updatedAt).toLocaleString()}</small></span><button disabled={!canRestore} onClick={()=>onRestore(draft)}>Recover draft</button><button onClick={()=>onDiscard(draft)}>Discard draft</button></div>)}{!canRestore&&<p>Wait for the library to load, or reconnect with edit access to recover a draft.</p>}</section>
}
