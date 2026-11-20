import { lyricsOnly } from './chord/transpose'
import { parseSongFlow } from './song-flow'

export type LyricsChart = { title: string; content: string }

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

export function lyricsDocument(songs: readonly LyricsChart[]) {
  return songs.map(song => ({ title: song.title.trim(), sections: lyricSections(song.content) }))
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function lyricsClipboardContent(songs: readonly LyricsChart[]) {
  const document = lyricsDocument(songs)
  const text = document.map(song => [song.title, ...song.sections.map(section =>
    [section.title, section.lyrics].filter(Boolean).join('\n')
  )].join('\n\n')).join('\n\n')
  const html = document.map(song => [
    `<p><strong>${escapeHtml(song.title)}</strong></p>`,
    ...song.sections.map(section => {
      const heading = section.title ? `<strong>${escapeHtml(section.title)}</strong><br>` : ''
      return `<p>${heading}${escapeHtml(section.lyrics).replace(/\n/g, '<br>')}</p>`
    }),
  ].join('')).join('')
  return { text, html }
}

export async function copyFormattedLyrics(songs: readonly LyricsChart[]) {
  const { text, html } = lyricsClipboardContent(songs)
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })])
      return 'formatted'
    } catch {
      // Some browsers accept plain clipboard text but block HTML.
    }
  }
  await navigator.clipboard.writeText(text)
  return 'plain'
}
