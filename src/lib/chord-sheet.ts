import { alignChordRow, barChordParts, chordRowPositions } from './chord/transpose'

export function convertChordSheet(raw:string):{title:string;content:string;warnings:string[]} {
 const lines=raw.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/\t/g,'    ').split('\n')
 const isChordLine=(line:string)=>chordRowPositions(line)!==null
 let title=''
 const first=lines.findIndex(line=>!!line.trim())
 if(first>=0&&/^\*\*.+\*\*$/.test(lines[first].trim())){title=lines[first].trim().slice(2,-2);lines.splice(first,1)}
 else if(first>=0){const next=lines.slice(first+1).find(line=>!!line.trim());const candidate=lines[first].trim();if(next&&(isChordLine(next)||barChordParts(next)||/^\[.+\]$/.test(next.trim())||next.trim().startsWith('# '))&&candidate.length<=100&&!/[{}\[\]#]/.test(candidate)&&!isChordLine(candidate)&&!barChordParts(candidate)){title=candidate;lines.splice(first,1)}}
 const output:string[]=[];let combined=0
 const isSection=(line:string)=>/^\[.+\]$/.test(line.trim())||line.trim().startsWith('# ')
 for(let i=0;i<lines.length;i++){
  const line=lines[i]
  const chords=chordRowPositions(line)
  if(!chords){output.push(line);continue}
  const next=lines[i+1]
  if(next===undefined||!next.trim()||isSection(next)||isChordLine(next)||barChordParts(next)){output.push(chords.map(({chord})=>`{${chord}}`).join(' '));continue}
  output.push(alignChordRow(chords,next));i++;combined++
 }
 return {title,content:output.join('\n').trim(),warnings:combined?['Chord positions are estimated from spaces. Check the preview before applying.']:[]}
}
