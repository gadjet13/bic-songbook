const chord=/^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|omit|no|m|M)|\d|[#b()+-])*(?:\/[A-G](?:#|b)?)?\/*$/
export type PositionedChord={token:string;label:string;position:number;index:number}
export type ChordLine={lyrics:string;chords:PositionedChord[];ending:string;heading:boolean}
export function parseChordPositions(line:string):ChordLine{
 const ending=line.endsWith('\r')?'\r':'',body=ending?line.slice(0,-1):line,trimmed=body.trim()
 const bracket=trimmed.match(/^\[([^\]]+)\]$/)
 const heading=trimmed.startsWith('# ')||!!(bracket&&!chord.test(bracket[1]))
 if(heading)return{lyrics:body,chords:[],ending,heading:true}
 const chords:PositionedChord[]=[];let lyrics='',cursor=0
 for(const match of body.matchAll(/\{([^}\r\n]+)\}|\[([^\]\r\n]+)\]/g)){
  const label=match[1]??match[2];if(!chord.test(label))continue
  lyrics+=body.slice(cursor,match.index);chords.push({token:match[0],label,position:lyrics.length,index:chords.length});cursor=match.index!+match[0].length
 }
 lyrics+=body.slice(cursor);return{lyrics,chords,ending,heading:false}
}
export function lyricBoundaries(lyrics:string){const positions=[0];let offset=0;for(const char of lyrics){offset+=char.length;positions.push(offset)}return positions}
export function chordPlacementBoundaries(lyrics:string,trailing=0){
 const positions=lyricBoundaries(lyrics)
 const end=lyrics.trimEnd().length+trailing
 for(let position=lyrics.length+1;position<=end;position++)positions.push(position)
 return positions
}
function render(line:ChordLine,chords:PositionedChord[]){const ordered=[...chords].sort((a,b)=>a.position-b.position||a.index-b.index);let text='',cursor=0;for(const entry of ordered){text+=line.lyrics.slice(cursor,entry.position)+entry.token;cursor=entry.position}return{text:text+line.lyrics.slice(cursor)+line.ending,ordered}}
/** Move one token while preserving every lyric character, other tokens, and line endings. */
export function movePositionedChord(content:string,sourceLine:number,chordIndex:number,targetLine:number,position:number,trailing=0){
 const lines=content.split('\n');if(sourceLine<0||targetLine<0||sourceLine>=lines.length||targetLine>=lines.length)return null
 const source=parseChordPositions(lines[sourceLine]),target=sourceLine===targetLine?source:parseChordPositions(lines[targetLine]),entry=source.chords[chordIndex]
 if(!entry||target.heading||!Number.isFinite(position))return null
 const boundary=chordPlacementBoundaries(target.lyrics,trailing).reduce((best,value)=>Math.abs(value-position)<Math.abs(best-position)?value:best,0)
 if(boundary>target.lyrics.length)target.lyrics=target.lyrics.padEnd(boundary)
 const moved={...entry,position:boundary,index:sourceLine===targetLine?entry.index:target.chords.length}
 if(sourceLine===targetLine){const rendered=render(source,source.chords.map(row=>row.index===chordIndex?moved:row));lines[sourceLine]=rendered.text;return{content:lines.join('\n'),line:targetLine,index:rendered.ordered.indexOf(moved)}}
 lines[sourceLine]=render(source,source.chords.filter(row=>row.index!==chordIndex)).text
 const rendered=render(target,[...target.chords,moved]);lines[targetLine]=rendered.text
 return{content:lines.join('\n'),line:targetLine,index:rendered.ordered.indexOf(moved)}
}

export function putPositionedChord(content:string,line:number,position:number,label:string,index?:number,trailing=0){
 const lines=content.split('\n'),model=parseChordPositions(lines[line]??'')
 if(lines[line]===undefined||model.heading||!chord.test(label)||!chordPlacementBoundaries(model.lyrics,trailing).includes(position))return content
 if(position>model.lyrics.length)model.lyrics=model.lyrics.padEnd(position)
 const old=index===undefined?undefined:model.chords[index]
 const entry={token:old?.token.startsWith('[')?`[${label}]`:`{${label}}`,label,position,index:index??model.chords.length}
 lines[line]=render(model,[...model.chords.filter(item=>item.index!==index),entry]).text
 return lines.join('\n')
}

export function editPositionedLyrics(content:string,line:number,next:string,caret=next.length,joinPrevious=false){
 const lines=content.split('\n'),source=parseChordPositions(lines[line]??'')
 if(lines[line]===undefined||source.heading)return null
 let model=source
 if(joinPrevious){
  if(line===0)return null
  const previous=parseChordPositions(lines[line-1])
  if(previous.heading)return null
  model={...source,lyrics:previous.lyrics+source.lyrics,chords:[...previous.chords,
   ...source.chords.map((entry,index)=>({...entry,position:entry.position+previous.lyrics.length,index:index+previous.chords.length}))]}
  lines.splice(--line,2,'')
  next=model.lyrics;caret=previous.lyrics.length
 }
 next=next.replace(/\r\n?/g,'\n')
 // Locate the changed range, preferring the caret when text repeats.
 const before=Array.from(model.lyrics),after=Array.from(next)
 const caretIndex=Array.from(next.slice(0,caret)).length
 let suffix=0
 while(suffix<Math.min(before.length,after.length-caretIndex)&&before.at(-suffix-1)===after.at(-suffix-1))suffix++
 let prefix=0
 while(prefix<Math.min(before.length,after.length)-suffix&&before[prefix]===after[prefix])prefix++
 if(prefix+suffix<before.length&&prefix+suffix<after.length)
  while(suffix<Math.min(before.length,after.length)-prefix&&before.at(-suffix-1)===after.at(-suffix-1))suffix++
 const start=before.slice(0,prefix).join('').length
 const end=before.slice(0,before.length-suffix).join('').length
 const newEnd=after.slice(0,after.length-suffix).join('').length
 const rows=next.split('\n')
 if(rows.some(value=>{const plain=parseChordPositions(value);return plain.heading||plain.chords.length}))return null
 let offset=0
 const rowStarts=rows.map(value=>{const start=offset;offset+=value.length+1;return start})
 const rowAt=(position:number)=>{let row=0;while(row+1<rows.length&&rowStarts[row+1]<=position)row++;return row}
 const anchors:PositionedChord[][]=rows.map(()=>[])
 for(const entry of model.chords){
  const position=entry.position<start?entry.position:entry.position>=end?entry.position+newEnd-end:start
  const row=rowAt(position)
  anchors[row].push({...entry,position:position-rowStarts[row]})
 }
 const ending=content.includes('\r\n')?'\r':''
 lines.splice(line,1,...rows.map((lyrics,index)=>render({lyrics,chords:[],heading:false,
  ending:index===rows.length-1?model.ending:ending},anchors[index]).text))
 const row=rowAt(caret)
 return {content:lines.join('\n'),line:line+row,caret:caret-rowStarts[row]}
}
