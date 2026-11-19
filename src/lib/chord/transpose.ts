const SHARP_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const FLAT_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
const ENHARMONIC: Record<string, string> = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#' }

const chordPattern = /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|omit|no|m|M)|\d|[#b()+-])*(?:\/[A-G](?:#|b)?)?$/

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
  const match = chord.match(/^([A-G](?:#|b)?)([^/]*?)(?:\/([A-G](?:#|b)?))?$/)
  if (!match) return chord
  const [, root, quality, bass] = match
  const newRoot = transposeNote(root, semitones, useFlats)
  const newBass = bass ? transposeNote(bass, semitones, useFlats) : null
  return newBass ? `${newRoot}${quality}/${newBass}` : `${newRoot}${quality}`
}

/** Bake a displayed transposition into song text without changing section labels or lyrics. */
export function transposeSongContent(content: string, semitones: number, useFlats = false): string {
  return content.split('\n').map(line => {
    if (line.trim().startsWith('# ')) return line
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
    if (line.trim().startsWith('# ')) return line
    if (barChordParts(line)) return line.endsWith('\r') ? '\r' : ''
    return line.replace(/\[([^\]\r\n]+)\]|\{([^}\r\n]+)\}/g, (token, legacy: string | undefined, modern: string | undefined) => {
      const chord = legacy ?? modern!
      return chordPattern.test(chord) ? '' : token
    })
  }).join('\n')
}
