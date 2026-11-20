import { isChordToken, sectionHeading } from './chord/transpose'
export type PositionedChord={token:string;label:string;position:number;index:number}
export type ChordLine={lyrics:string;chords:PositionedChord[];ending:string;heading:boolean}
export function parseChordPositions(line:string):ChordLine{
 const ending=line.endsWith('\r')?'\r':'',body=ending?line.slice(0,-1):line
 const heading=sectionHeading(body)!==undefined
 if(heading)return{lyrics:body,chords:[],ending,heading:true}
 const chords:PositionedChord[]=[];let lyrics='',cursor=0
 for(const match of body.matchAll(/\{([^}\r\n]+)\}|\[([^\]\r\n]+)\]/g)){
  const label=match[1]??match[2];if(!isChordToken(label))continue
  lyrics+=body.slice(cursor,match.index);chords.push({token:match[0],label,position:lyrics.length,index:chords.length});cursor=match.index!+match[0].length
 }
 lyrics+=body.slice(cursor);return{lyrics,chords,ending,heading:false}
}
export function lyricBoundaries(lyrics:string){const positions=[0];let offset=0;for(const char of lyrics){offset+=char.length;positions.push(offset)}return positions}
function render(line:ChordLine,chords:PositionedChord[]){const ordered=[...chords].sort((a,b)=>a.position-b.position||a.index-b.index);let text='',cursor=0;for(const entry of ordered){text+=line.lyrics.slice(cursor,entry.position)+entry.token;cursor=entry.position}return{text:text+line.lyrics.slice(cursor)+line.ending,ordered}}
/** Move one token while preserving every lyric character, other tokens, and line endings. */
export function movePositionedChord(content:string,sourceLine:number,chordIndex:number,targetLine:number,position:number){
 const lines=content.split('\n');if(sourceLine<0||targetLine<0||sourceLine>=lines.length||targetLine>=lines.length)return null
 const source=parseChordPositions(lines[sourceLine]),target=sourceLine===targetLine?source:parseChordPositions(lines[targetLine]),entry=source.chords[chordIndex]
 if(!entry||target.heading||!Number.isFinite(position))return null
 const boundary=lyricBoundaries(target.lyrics).reduce((best,value)=>Math.abs(value-position)<Math.abs(best-position)?value:best,0)
 const moved={...entry,position:boundary,index:sourceLine===targetLine?entry.index:target.chords.length}
 if(sourceLine===targetLine){const rendered=render(source,source.chords.map(row=>row.index===chordIndex?moved:row));lines[sourceLine]=rendered.text;return{content:lines.join('\n'),line:targetLine,index:rendered.ordered.indexOf(moved)}}
 lines[sourceLine]=render(source,source.chords.filter(row=>row.index!==chordIndex)).text
 const rendered=render(target,[...target.chords,moved]);lines[targetLine]=rendered.text
 return{content:lines.join('\n'),line:targetLine,index:rendered.ordered.indexOf(moved)}
}
