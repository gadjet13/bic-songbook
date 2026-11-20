import type { ReactNode } from 'react'
import { chartCueLocations } from './lib/cue-locations'
import { readingWords } from './lib/reader-lines'
import { barChordParts, formatStoredChordRows, lyricsOnly, sectionHeading, transposeChord } from './lib/chord/transpose'

export function displaySong(
  content: string,
  transpose: number,
  currentKey: string,
  wrapWords=false,
  showChords=true,
  renderSection?: (location: string, heading: string) => ReactNode,
) {
  content = showChords ? formatStoredChordRows(content) : lyricsOnly(content)
  const useFlats = currentKey.includes('b')

  const cueIds = renderSection ? new Map(chartCueLocations(content).map(section => [section.lineIndex, section.id])) : null
  const groups: { heading?: string; cueId?: string; lines: string[] }[] = []
  for (const [lineIndex, line] of content.split('\n').entries()) {
    const heading = sectionHeading(line)
    if (heading !== undefined) groups.push({ heading, cueId: cueIds?.get(lineIndex), lines: [] })
    else {
      if (!groups.length) groups.push({ lines: [] })
      groups[groups.length - 1].lines.push(line)
    }
  }
  return groups.map((group, index) => <div className={showChords?'song-block':'song-block lyrics-only-block'} key={index}>
    {group.heading && (group.cueId && renderSection
      ? renderSection(group.cueId, group.heading)
      : <div className="song-section">{group.heading}</div>)}
    {group.lines.map((line, lineIndex) => {
      const barParts = showChords ? barChordParts(line) : null
      if (barParts) return <div className="song-line song-bar-row" key={lineIndex}>
        {barParts.map(({text, chord}, index) => chord
          ? <span className="chord" key={index}>{transposeChord(text, transpose, useFlats)}</span>
          : text)}
      </div>
      return <div className="song-line" data-reader-spacer={wrapWords && !line.trim() || undefined} key={lineIndex}>
      {wrapWords?readingWords(parseLine(line,transpose,useFlats)).map((word,wordIndex)=>word.kind==='space'?word.text:<span className="song-word" key={wordIndex}>{word.parts.map((segment,segmentIndex)=><span key={segmentIndex} style={segment.chord?{minWidth:`${(segment.chord.length+.7)*.65}em`}:undefined} className={segment.chord&&!segment.lyrics.trim()?'song-segment chord-only':'song-segment'}><span className="chord">{segment.chord}</span><span className="lyrics">{segment.lyrics}</span></span>)}</span>):parseLine(line, transpose, useFlats).map((segment, segmentIndex) => <span style={segment.chord ? {minWidth: `${(segment.chord.length + 0.7) * 0.65}em`} : undefined} className={segment.chord && !segment.lyrics.trim() ? "song-segment chord-only" : "song-segment"} key={segmentIndex}>
        <span className="chord">{segment.chord}</span><span className="lyrics">{segment.lyrics}</span>
      </span>)}
      </div>
    })}
  </div>)
}

function parseLine(
  line: string,
  transpose: number,
  useFlats: boolean,
) {
  const chordRegex =
    /\[([A-G](?:#|b)?[^/\]\s]*(?:\/[A-G](?:#|b)?)?\/*)\]|\{([A-G](?:#|b)?[^/}\s]*(?:\/[A-G](?:#|b)?)?\/*)\}/g

  const matches = [
    ...line.matchAll(chordRegex),
  ]

  if (!matches.length) {
    return [
      {
        chord: '',
        lyrics: line,
      },
    ]
  }

  const segments: {
    chord: string
    lyrics: string
  }[] = []

  if (matches[0].index! > 0) {
    segments.push({
      chord: '',
      lyrics: line.slice(
        0,
        matches[0].index,
      ),
    })
  }

  matches.forEach((match, index) => {
    const chord = match[1] || match[2]

    const start =
      match.index! + match[0].length

    const end =
      index + 1 < matches.length
        ? matches[index + 1].index!
        : line.length

    let lyrics = line.slice(
      start,
      end,
    )


    segments.push({
      chord: transposeChord(
        chord,
        transpose,
        useFlats,
      ),
      lyrics,
    })
  })

  return segments
}
