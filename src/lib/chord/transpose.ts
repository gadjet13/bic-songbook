const SHARP_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const FLAT_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
const ENHARMONIC: Record<string, string> = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#' }

const chordPattern = /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|omit|no|m|M)|\d|[#b()+-])*(?:\/[A-G](?:#|b)?)?\/*$/


export function chordRowPositions(line: string) {
  const tokens = Array.from(line.matchAll(/\S+/g))
  if (!tokens.length || tokens.some(token => !isChordToken(token[0]))) return null
  return tokens.map(token => ({ chord: token[0], column: token.index! }))
}

export function isChordToken(token: string) { return chordPattern.test(token) }

const trimSection = (text: string) => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '')
const sectionName = '(?:intro|verse|pre[ -]?chorus|chorus|post[ -]?chorus|bridge|refrain|tag|instrumental|interlude|solo|breakdown|vamp|turnaround|outro|ending)[ \\t]*[0-9]*'
const sectionNotes = '(\\[[^\\[\\]\\r\\n]+\\](?:[ \\t]+\\[[^\\[\\]\\r\\n]+\\])*)'
const bareAnnotated = new RegExp('^(' + sectionName + ')[ \\t]+' + sectionNotes + '$', 'i')
const separateAnnotated = new RegExp('^\\[(' + sectionName + ')\\][ \\t]+' + sectionNotes + '$', 'i')
const nestedAnnotated = new RegExp('^\\[(' + sectionName + ')[ \\t]+' + sectionNotes + '\\]$', 'i')

export function sectionHeading(line: string): string | undefined {
  const text = trimSection(line)
  if (text.startsWith('# ')) return trimSection(text.slice(2)) || undefined
  const standalone = /^\[([^\[\]\r\n]+)\]$/.exec(text)
  if (standalone) {
    const label = trimSection(standalone[1])
    return label && !isChordToken(label) ? label : undefined
  }
  const annotated = bareAnnotated.exec(text) ?? separateAnnotated.exec(text) ?? nestedAnnotated.exec(text)
  if (!annotated) return undefined
  const notes = [...annotated[2].matchAll(/\[([^\]]+)\]/g)]
  if (notes.some(note => !trimSection(note[1]) || isChordToken(trimSection(note[1])))) return undefined
  return trimSection(annotated[1]) + ' ' + annotated[2]
}

export function normalizeSectionHeadings(content: string): string {
  return content.split('\n').map(line => {
    if (/^[ \t]*# /.test(line)) return line
    const label = sectionHeading(line)
    return label ? line.replace(/^([ \t]*).*?([ \t]*\r?)$/, (_, indent, ending) => indent + '# ' + label + ending) : line
  }).join('\n')
}

function storedChordRow(line: string) {
  const row = chordRowPositions(line)
  // A lyric consisting of just “A” (or another note name) is still a lyric.
  return row && (row.length > 1 || row[0].chord.endsWith('/')) ? row : null
}

export function alignChordRow(row: NonNullable<ReturnType<typeof chordRowPositions>>, lyric: string) {
  let content = lyric
  for (const {chord, column} of [...row].reverse()) {
    const position = Math.min(column, lyric.length)
    content = content.slice(0, position) + `{${chord}}` + content.slice(position)
  }
  return content.trimEnd()
}

/** Compose older chord rows and retain the first source line for each rendered row. */
export function storedChartLines(content: string) {
  const lines = content.split('\n')
  const output: {text: string; sourceLine: number}[] = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const row = storedChordRow(line)
    const next = lines[index + 1]
    let text = line
    const sourceLine = index
    if (row) {
      if (!next?.trim() || /[{}\[\]]/.test(next) || sectionHeading(next) ||
          storedChordRow(next) || barChordParts(next)) {
        text = row.map(({chord}) => `{${chord}}`).join(' ') + (line.endsWith('\r') ? '\r' : '')
      } else {
        text = alignChordRow(row, next.replace(/\r$/, '')) + (next.endsWith('\r') ? '\r' : '')
        index++
      }
    }
    output.push({ text, sourceLine })
  }
  return output
}

export function formatStoredChordRows(content: string) {
  return storedChartLines(content).map(({text}) => text).join('\n')
}

/** Read a standalone bar chart while retaining its rhythmic notation verbatim. */
export function barChordParts(line: string) {
  const row = /^(\s*\(?\s*)(\|[^\r\n]*\|)(\s*\)?\s*)$/.exec(line)
  if (!row || row[1].includes('(') !== row[3].includes(')')) return null

  const tokens = row[2].match(/\s+|\|+|[^\s|]+/g) ?? []
  const parts = tokens.map(text => ({ text, chord: chordPattern.test(text) }))
  if (!parts.some(part => part.chord) ||
      parts.some(part => !part.chord && !/^(?:\s+|\|+|\/+)$/.test(part.text))) return null

  return [{ text: row[1], chord: false }, ...parts, { text: row[3], chord: false }]
}

function transposeNote(note: string, semitones: number, useFlats: boolean): string {
  const normalizedNote = ENHARMONIC[note] ?? note
  const index = SHARP_NOTES.indexOf(normalizedNote)
  if (index === -1) return note
  const newIndex = ((index + semitones) % 12 + 12) % 12
  return useFlats ? FLAT_NOTES[newIndex] : SHARP_NOTES[newIndex]
}

export function transposeChord(chord: string, semitones: number, useFlats = false): string {
  const match = chord.match(/^([A-G](?:#|b)?)([^/]*?)(?:\/([A-G](?:#|b)?))?(\/+)?$/)
  if (!match) return chord
  const [, root, quality, bass, beats = ''] = match
  const newRoot = transposeNote(root, semitones, useFlats)
  const newBass = bass ? transposeNote(bass, semitones, useFlats) : null
  return `${newRoot}${quality}${newBass ? `/${newBass}` : ''}${beats}`
}

/** Bake a displayed transposition into song text without changing section labels or lyrics. */
export function transposeSongContent(content: string, semitones: number, useFlats = false): string {
  return formatStoredChordRows(content).split('\n').map(line => {
    if (sectionHeading(line)) return line
    const barParts = barChordParts(line)
    if (barParts) {
      return barParts.map(({text, chord}) => chord ? transposeChord(text, semitones, useFlats) : text).join('')
    }
    return line.replace(/\[([^\]\r\n]+)\]|\{([^}\r\n]+)\}/g, (token, legacy: string | undefined, modern: string | undefined) => {
      const chord = legacy ?? modern!
      // Bracketed section names such as [Chorus], [Bridge] and [Ending] aren't chords.
      if (!chordPattern.test(chord)) return token
      const transposed = transposeChord(chord, semitones, useFlats)
      return legacy !== undefined ? `[${transposed}]` : `{${transposed}}`
    })
  }).join('\n')
}

/** Remove chord tokens while preserving section labels, lyric spacing and line endings. */
export function lyricsOnly(content: string): string {
  return content.split('\n').map(line => {
    if (sectionHeading(line)) return line
    if (barChordParts(line) || storedChordRow(line)) return line.endsWith('\r') ? '\r' : ''
    return line.replace(/\[([^\]\r\n]+)\]|\{([^}\r\n]+)\}/g, (token, legacy: string | undefined, modern: string | undefined) => {
      const chord = legacy ?? modern!
      return chordPattern.test(chord) ? '' : token
    })
  }).join('\n')
}
