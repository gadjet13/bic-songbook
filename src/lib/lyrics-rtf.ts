import { lyricsOnly } from './chord/transpose'
import { parseSongFlow } from './song-flow'

type LyricsChart = { title: string; content: string }

const arrangementOrder = /^(?:[IVCBPATOS]\d*)+(?:\s*[-–—→]\s*(?:[IVCBPATOS]\d*)+)+$/
const repeatDirection = /^(?:repeat(?:\s+(?:the\s+)?(?:intro|verse|pre[- ]?chorus|chorus|bridge|tag|ending|outro)\s*\d*)?|x\s*\d+)(?:\s+\[[^\]]*\])?$/i
const repeatCount = /^\(\s*x\s*\d+\s*\)$/i
const sectionCutoff = /^\(\s*until\s+[^()]+\s*\)$/i

function lyricLines(body: string, preamble = false) {
  if (sectionCutoff.test(body.trim())) return ''
  return body.split('\n').map(line => line.trim()).filter(line =>
    !repeatDirection.test(line) && !repeatCount.test(line) &&
    !(preamble && arrangementOrder.test(line))
  ).join('\n').trim().replace(/\n{3,}/g, '\n\n')
}

function lyricSections(content: string) {
  const { preamble, sections } = parseSongFlow(lyricsOnly(content))
  return [
    { title: '', lyrics: lyricLines(preamble, true) },
    ...sections.map(section => ({
      title: section.label.replace(/(?:\s*\[[^\[\]]*\])+\s*$/, '')
        .replace(/([a-z])(\d+)$/i, '$1 $2').trim(),
      lyrics: lyricLines(section.body),
    })),
  ].filter(section => section.lyrics)
}

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
  songs.forEach((song, index) => {
    const pageBreak = index > 0 ? String.raw`\pagebb` : ''
    rtf.push(String.raw`\pard${pageBreak}\keepn\sa240\f0\fs40\b ${rtfText(song.title.trim())}\b0\par`)
    for (const section of lyricSections(song.content)) {
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
