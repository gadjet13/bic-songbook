const chordPattern = /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|omit|no|m|M)|\d|[#b()+-])*(?:\/[A-G](?:#|b)?)?$/
const repeatPattern = /^x[1-9]\d*$/i
const pageMarker = /^Page\s+\d+\s*\/\s*\d+$/i

type ChordSheetWarning = { line: number; kind: 'past-lyrics' | 'unrecognized-row' }

function chordRow(line: string) {
  const chords = [...line.matchAll(/\S+/g)]
  const repeat = repeatPattern.test(chords.at(-1)?.[0] ?? '') ? chords.pop()?.[0] : undefined
  return chords.length && chords.every(match => chordPattern.test(match[0])) ? { chords, repeat } : null
}

function isSection(line: string) {
  return /^\[.+\]$/.test(line.trim()) || line.trim().startsWith('# ')
}

function looksLikeChordRow(line: string) {
  const tokens = line.trim().split(/\s+/)
  return tokens.length > 1 && tokens.some(token => chordPattern.test(token)) &&
    tokens.every(token => chordPattern.test(token) || repeatPattern.test(token) ||
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
    else if (next && (chordRow(next) || isSection(next)) && candidate.length <= 100 &&
      !/[{}\[\]#]/.test(candidate) && !chordRow(candidate) && !looksLikeChordRow(candidate)) title = candidate
    if (title) lines.splice(first, 1)
  }

  const output: string[] = []
  const warnings: ChordSheetWarning[] = []
  for (let index = 0; index < lines.length; index++) {
    const { text, number } = lines[index]
    const row = chordRow(text)
    if (!row) {
      if (looksLikeChordRow(text)) warnings.push({ line: number, kind: 'unrecognized-row' })
      output.push(text)
      continue
    }
    const next = lines[index + 1]?.text
    if (row.repeat || !next?.trim() || isSection(next) || chordRow(next) || looksLikeChordRow(next)) {
      const chords = row.chords.map(match => `{${match[0]}}`).join(' ')
      output.push(row.repeat ? `${chords}  ${row.repeat}` : chords)
      continue
    }
    if (row.chords.some(match => match.index! >= next.trimEnd().length)) {
      warnings.push({ line: number, kind: 'past-lyrics' })
    }
    let converted = next
    for (const match of row.chords.reverse()) {
      const position = Math.min(match.index!, next.length)
      converted = converted.slice(0, position) + `{${match[0]}}` + converted.slice(position)
    }
    output.push(converted.trimEnd())
    index++
  }
  return { title, content: output.join('\n').trim(), warnings }
}
