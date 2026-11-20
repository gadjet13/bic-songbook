import { downloadLyricsRtf } from './lib/lyrics-rtf'
import { arrangedSong } from './lib/setlist-arrangement'
import { useState } from 'react'
import type { Song } from './App'
import { setlistText } from './lib/setlist-copy'
export default function SetlistCopy({title,songs}:{title:string;songs:Song[]}) {
 const [notice,setNotice]=useState('')
 async function copy(lyrics:boolean){try{await navigator.clipboard.writeText(setlistText(songs.map(song=>arrangedSong(song)),lyrics));setNotice(lyrics?'All setlist lyrics copied.':'All setlist songs copied with chords in their sounding keys.')}catch{setNotice('Could not copy. Allow clipboard access and try again.')}}
 return <details className="copy-options"><summary>Copy entire setlist</summary><button disabled={!songs.length} onClick={()=>void copy(false)}>Copy with chords</button><button disabled={!songs.length} onClick={()=>void copy(true)}>Copy lyrics</button><button disabled={!songs.length} onClick={()=>downloadLyricsRtf(songs,title)}>Download lyrics (RTF)</button><p role="status">{notice}</p></details>
}
