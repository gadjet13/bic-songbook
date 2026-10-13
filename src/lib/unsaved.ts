const drafts=new Set<symbol>()
let accepted=false
export function registerDraft(token:symbol,dirty:boolean){if(dirty)drafts.add(token);else drafts.delete(token)}
export function hasUnsavedChanges(){return drafts.size>0&&!accepted}
export function allowNavigation(){if(!hasUnsavedChanges())return true;if(!window.confirm('You have unsaved changes. Discard them and leave this editor?'))return false;accepted=true;setTimeout(()=>{accepted=false},0);return true}
