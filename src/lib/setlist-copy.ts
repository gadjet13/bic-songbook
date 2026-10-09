import { lyricsOnly } from './chord/transpose'
import type { Song } from '../App'
export function setlistText(songs:Song[],withoutChords:boolean):string {
 return songs.map((song,index)=>`${index+1}. ${song.title}\n${withoutChords?'':`Key: ${song.key}\n`}${withoutChords?lyricsOnly(song.content):song.content}`).join('\n\n──────────\n\n')
}
