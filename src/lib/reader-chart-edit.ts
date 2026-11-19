import { barChordParts, chordRowPositions, formatStoredChordRows, isChordToken, transposeChord } from './chord/transpose'

export type ChartPitch={semitones:number;key:string;flats:boolean}
export type BarCell={text:string;chord:boolean;offset:number}

export function performanceChord(label:string,pitch:ChartPitch){
 return transposeChord(label,pitch.semitones,pitch.flats)
}

export function storedChord(label:string,pitch:ChartPitch,key:string){
 return pitch.semitones%12===0?label:transposeChord(label,-pitch.semitones,key.includes('b'))
}

export function editableBar(line:string){
 const parts=barChordParts(line)
 if(!parts)return null
 let offset=0
 return parts.filter(part=>part.text.length).map(part=>{const cell={...part,offset};offset+=part.text.length;return cell})
}

export function changeBarChord(content:string,line:number,offset:number,label:string,from?:{line:number;offset:number}){
 const rows=content.split('\n')
 const target=editableBar(rows[line]??'')?.find(cell=>cell.offset===offset&&(cell.chord||cell.text==='/'))
 if(!target||!isChordToken(label))return content
 const edits=[{line,cell:target,text:label}]
 if(from){
  const source=editableBar(rows[from.line]??'')?.find(cell=>cell.offset===from.offset&&cell.chord)
  if(!source||target.text!=='/')return content
  edits.push({line:from.line,cell:source,text:'/'})
 }
 for(const edit of edits.sort((a,b)=>b.cell.offset-a.cell.offset)){
  const row=rows[edit.line]
  rows[edit.line]=row.slice(0,edit.cell.offset)+edit.text+row.slice(edit.cell.offset+edit.cell.text.length)
 }
 return rows.join('\n')
}

export function legacyChordRows(lines:string[]){
 const raw=new Set<number>()
 lines.forEach((line,index)=>{
  const row=chordRowPositions(line)
  if(!row||!(row.length>1||row[0].chord.endsWith('/')))return
  raw.add(index)
  const next=lines[index+1]
  if(next&&formatStoredChordRows(line+'\n'+next).split('\n').length===1)raw.add(index+1)
 })
 return raw
}
