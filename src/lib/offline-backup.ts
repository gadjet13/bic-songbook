import type {OfflineBundle} from './offline'
export function offlineBackupPayload(bundle:OfflineBundle|undefined,userId:string,church:boolean){
 if(!bundle||bundle.userId!==userId)throw new Error('No saved offline copy for this account on this device.')
 if(!Number.isFinite(Date.parse(bundle.savedAt)))throw new Error('The saved offline copy has no valid timestamp. Download a complete backup instead.')
 const songs=church?bundle.church:bundle.personal,folders=church?[]:bundle.folders,setlists=church?[]:bundle.setlists
 if(!Array.isArray(songs)||!Array.isArray(folders)||!Array.isArray(setlists)||!Array.isArray(bundle.favorites))throw new Error('This offline save is incomplete. Choose a complete backup file instead.')
 if(songs.length>2000||folders.length>500||setlists.length>500)throw new Error('The offline save exceeds complete-restore limits.')
 const ids=new Set(songs.map(song=>song.id));if(ids.size!==songs.length)throw new Error('The offline save contains duplicate song IDs.')
 let missingEntries=0
 for(const list of setlists){if(!Array.isArray(list.song_ids)||list.song_ids.length>100)throw new Error('The offline save contains an invalid setlist.');missingEntries+=list.song_ids.filter(id=>!ids.has(id)).length}
 const payload={format:'bic-worship-db',version:2,scope:church?'church':'personal',exported_at:bundle.savedAt,songs,folders,setlists,favorites:bundle.favorites.filter(id=>ids.has(id)),friends:[]}
 const encoded=JSON.stringify(payload);if(new TextEncoder().encode(encoded).length>25000000)throw new Error('The offline save is too large (maximum 25 MB).')
 return {payload:JSON.parse(encoded) as typeof payload,missingEntries}
}
