import type { Song } from '../App'

export function setlistText(songs: Song[]): string {
  return songs.map((song, index) => `${index + 1}. ${song.title}\nKey: ${song.key}\n${song.content}`)
    .join('\n\n──────────\n\n')
}
