import { barChordParts, formatStoredChordRows, isChordToken, sectionHeading } from './chord/transpose'

const sections: Record<string,string> = {
  sov:'Verse', start_of_verse:'Verse',
  soc:'Chorus', start_of_chorus:'Chorus',
  sob:'Bridge', start_of_bridge:'Bridge',
}
const sectionEnds = new Set(['eov','end_of_verse','eoc','end_of_chorus','eob','end_of_bridge'])
const commentNames = new Set(['comment','c','comment_italic','ci','comment_box','cb','highlight'])
const chorusStarts = new Set(['soc','start_of_chorus'])
const chorusEnds = new Set(['eoc','end_of_chorus'])

function directiveLabel(value:string) {
  const named=/^label\s*=\s*(.*)$/i.exec(value)?.[1]??value
  const quoted=/^(?:"(.*)"|'(.*)')$/.exec(named)
  return (quoted?.[1]??quoted?.[2]??named).trim().replace(/\\n/g,' ')
}

export function importChordPro(source:string) {
  let title='',artist='',key=''
  const output:string[]=[]
  const unsupported:string[]=[]
  type Chorus={lines:string[];size:number}
  const choruses=new Map<string,Chorus>()
  let activeChorus:{label:string;start:number;offset:number}|null=null
  let previousChorus:Chorus|undefined
  let size=0
  function append(text:string){output.push(text);size+=text.length+1}

  for(const line of source.replace(/^\uFEFF/,'').split(/\r?\n/)){
    if(line.trimStart().startsWith('#'))continue
    const directive=/^\s*\{([a-z_][\w-]*)(?:\s*:\s*|\s+)?(.*?)\}\s*$/i.exec(line)
    if(!directive||isChordToken(line.trim().slice(1,-1))){
      const barSource=line.replace(/\[([^\]\r\n]+)\]/g,(token,chord:string)=>isChordToken(chord)?chord:token)
      if(barChordParts(barSource)){append(barSource);continue}
      append(line.replace(/\[([^\]\r\n]+)\]/g,(token,chord:string)=>{
        if(isChordToken(chord))return '{'+chord+'}'
        if(chord.startsWith('*'))unsupported.push('inline annotation')
        else unsupported.push('chord '+chord)
        return token
      }))
      continue
    }
    const name=directive[1].toLowerCase(),value=directive[2].trim()
    if(name==='title'||name==='t'){if(!title)title=value;continue}
    if(name==='artist'){if(!artist)artist=value;continue}
    if(name==='key'){
      if(key)unsupported.push('key change')
      else key=value
      continue
    }
    if(Object.hasOwn(sections,name)){
      const label=directiveLabel(value)||sections[name]
      if(chorusStarts.has(name))activeChorus={label,start:output.length,offset:size}
      append('# '+label)
      continue
    }
    if(sectionEnds.has(name)){
      if(chorusEnds.has(name)&&activeChorus){
        previousChorus={lines:output.slice(activeChorus.start),size:size-activeChorus.offset}
        choruses.set(activeChorus.label,previousChorus)
        activeChorus=null
      }
      continue
    }
    if(name==='chorus'){
      const label=directiveLabel(value)
      const repeat=label?choruses.get(label):previousChorus
      if(!repeat)unsupported.push('chorus reference'+(label?' '+label:''))
      else if(size+repeat.size>200000)unsupported.push('chorus repeat larger than the chart limit')
      else for(const text of repeat.lines)append(text)
      continue
    }
    if(commentNames.has(name)&&value){append('# '+value);continue}
    unsupported.push(name)
  }
  return {title,artist,key,content:output.join('\n').trim(),unsupported:[...new Set(unsupported)]}
}

type ExportChart={title:string;artist:string;key:string;content:string}

export function exportChordPro(chart:ExportChart) {
  const metadata=(name:string,value:string)=>'{'+name+': '+value.replace(/[\r\n]+/g,' ').trim()+'}'
  const lines=[metadata('title',chart.title)]
  if(chart.artist.trim())lines.push(metadata('artist',chart.artist))
  if(chart.key.trim())lines.push(metadata('key',chart.key))
  const content=formatStoredChordRows(chart.content).split(/\r?\n/).map(line=>{
    const heading=sectionHeading(line)
    if(heading)return metadata('comment',heading)
    const bar=barChordParts(line)
    if(bar)return bar.map(({text,chord})=>chord?'['+text+']':text).join('')
    return line.replace(/\{([^}\r\n]+)\}/g,(token,chord:string)=>isChordToken(chord)?'['+chord+']':token)
  })
  return [...lines,'',...content].join('\n').trimEnd()+'\n'
}

export function downloadChordPro(chart:ExportChart) {
  const filename=chart.title.replace(/[<>:"/\\|?*\u0000-\u001F]/g,'_').trim()||'song'
  const url=URL.createObjectURL(new Blob([exportChordPro(chart)],{type:'text/plain;charset=utf-8'}))
  const link=document.createElement('a')
  link.href=url
  link.download=filename+'.cho'
  link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
