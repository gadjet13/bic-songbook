export type ChordSegment={chord:string;lyrics:string}
export type ReadingWord={kind:'word';parts:ChordSegment[]}|{kind:'space';text:string}
/** A chord marker is not a word boundary: hel{G}lo must remain one word. */
export function readingWords(segments:ChordSegment[]):ReadingWord[]{
 const result:ReadingWord[]=[];let parts:ChordSegment[]=[]
 const flush=()=>{if(parts.length){result.push({kind:'word',parts});parts=[]}}
 for(const segment of segments){let chord=segment.chord;const tokens=segment.lyrics.match(/\s+|\S+/g)??[]
  if(!tokens.length&&chord)parts.push({chord,lyrics:''})
  for(const token of tokens){if(/^\s+$/.test(token)){if(chord){parts.push({chord,lyrics:''});chord=''}flush();result.push({kind:'space',text:token})}else{parts.push({chord,lyrics:token});chord=''}}
 }
 flush();return result
}
/** Check the current size first, then descend 1px at a time; never auto-shrink below 12px. */
export function fitReaderFont(requested:number,width:number,measure:(size:number)=>number){
 for(let size=Math.max(12,Math.floor(requested));;size--){if(measure(size)<=width||size===12)return size}
}

export type ReaderColumns = 'auto' | 'one' | 'two'

export function readerColumnCount(columns: ReaderColumns, viewportWidth: number) {
  if (columns === 'one') return 1
  if (columns === 'two') return 2
  return viewportWidth >= 700 ? 2 : 1
}
