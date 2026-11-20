import { lyricsDocument, type LyricsChart } from './lyrics-document'

// RTF Unicode escapes encode one signed UTF-16 code unit followed by its fallback.
function rtfText(value: string) {
  return value.replace(/[\x00-\x1f\\{}\x7f-\uffff]/g, character => {
    if ('\\{}'.includes(character)) return '\\' + character
    if (character === '\n') return String.raw`\line `
    if (character === '\t') return String.raw`\tab `
    const code = character.charCodeAt(0)
    if (code < 32 || code === 127) return ''
    return String.raw`\u${code > 32767 ? code - 65536 : code}?`
  })
}

export function exportLyricsRtf(songs: readonly LyricsChart[]) {
  const rtf = [String.raw`{\rtf1\ansi\ansicpg1252\deff0\uc1{\fonttbl{\f0\fswiss Arial;}}`]
  lyricsDocument(songs).forEach((song, index) => {
    const pageBreak = index > 0 ? String.raw`\pagebb` : ''
    rtf.push(String.raw`\pard${pageBreak}\keepn\sa240\f0\fs40\b ${rtfText(song.title)}\b0\par`)
    for (const section of song.sections) {
      if (section.title) {
        rtf.push(String.raw`\pard\keepn\sb200\sa80\f0\fs28\b ${rtfText(section.title)}\b0\par`)
      }
      rtf.push(String.raw`\pard\sa160\f0\fs28 ${rtfText(section.lyrics)}\par`)
    }
  })
  return [...rtf, '}'].join('\n')
}

export function downloadLyricsRtf(songs: readonly LyricsChart[], title: string) {
  const filename = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'lyrics'
  const url = URL.createObjectURL(new Blob([exportLyricsRtf(songs)], { type: 'application/rtf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename + ' - lyrics.rtf'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
