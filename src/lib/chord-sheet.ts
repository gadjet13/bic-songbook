import { alignChordRow, barChordParts, chordRowPositions, isChordToken, normalizeSectionHeadings, sectionHeading } from './chord/transpose'

const repeatPattern = /^x[1-9]\d*$/i
const pageMarker = /^Page\s+\d+\s*\/\s*\d+$/i

type ChordSheetWarning = { line: number; kind: 'past-lyrics' | 'unrecognized-row' }

function chordRow(line: string) {
  const repeatMatch = /\s+(x[1-9]\d*)\s*$/i.exec(line)
  const chords = chordRowPositions(repeatMatch ? line.slice(0, repeatMatch.index) : line)
  return chords ? { chords, repeat: repeatMatch?.[1] } : null
}

function looksLikeChordRow(line: string) {
  const tokens = line.trim().split(/\s+/)
  return tokens.length > 1 && tokens.some(isChordToken) &&
    tokens.every(token => isChordToken(token) || repeatPattern.test(token) ||
      /^[A-G][#b]?[^\s]*[\d/?#][^\s]*$/.test(token) || /^\|+$/.test(token))
}

export function convertChordSheet(raw: string): { title: string; content: string; warnings: ChordSheetWarning[] } {
  const lines = raw.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\t/g, '    ')
    .split('\n').map((text, index) => ({ text, number: index + 1 }))
    .filter(({ text }) => !pageMarker.test(text.trim()))
  let title = ''
  const first = lines.findIndex(({ text }) => !!text.trim())
  if (first >= 0) {
    const candidate = lines[first].text.trim()
    const next = lines.slice(first + 1).find(({ text }) => !!text.trim())?.text
    if (/^\*\*.+\*\*$/.test(candidate)) title = candidate.slice(2, -2)
    else if (next && (chordRow(next) || barChordParts(next) || sectionHeading(next)) && candidate.length <= 100 &&
      !/[{}\[\]#]/.test(candidate) && !chordRow(candidate) && !barChordParts(candidate) && !looksLikeChordRow(candidate)) title = candidate
    if (title) lines.splice(first, 1)
  }

  const output: string[] = []
  const warnings: ChordSheetWarning[] = []
  for (let index = 0; index < lines.length; index++) {
    const { text, number } = lines[index]
    const row = chordRow(text)
    if (!row) {
      if (!barChordParts(text) && looksLikeChordRow(text)) warnings.push({ line: number, kind: 'unrecognized-row' })
      output.push(text)
      continue
    }
    const next = lines[index + 1]?.text
    if (row.repeat || !next?.trim() || sectionHeading(next) || /^\[[^\]]+\]$/.test(next.trim()) || chordRow(next) || barChordParts(next) || looksLikeChordRow(next)) {
      const chords = row.chords.map(({chord}) => `{${chord}}`).join(' ')
      output.push(row.repeat ? `${chords}  ${row.repeat}` : chords)
      continue
    }
    if (row.chords.some(({column}) => column >= next.trimEnd().length)) {
      warnings.push({ line: number, kind: 'past-lyrics' })
    }
    output.push(alignChordRow(row.chords, next))
    index++
  }
  return { title, content: normalizeSectionHeadings(output.join('\n').trim()), warnings }
}
