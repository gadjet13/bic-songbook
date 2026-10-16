import type { Song } from '../App'
/** Don't let an older refresh replace a successfully saved revision. */
export function freshestSong(current:Song,rows:Song[]):Song {
 const latest=rows.find(song=>song.id===current.id)
 if(!latest)return current
 return (latest.revision??0)>=(current.revision??0)?latest:current
}
