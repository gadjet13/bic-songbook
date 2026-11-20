import { sectionHeading } from './chord/transpose.ts'
export type FlowSection={label:string;heading:string;body:string;start:number;bodyStart:number}
export type FlowDocument={preamble:string;sections:FlowSection[];newline:string}
export const sectionKey=(label:string)=>label.trim().replace(/\s+/g,' ').toLowerCase()
export const sectionBodyKey=(body:string)=>body.replace(/\r\n/g,'\n').replace(/(?:\n[ \t]*)+$/,'')
export function parseSongFlow(content:string):FlowDocument{
 const sections:FlowSection[]=[]
 for(const match of content.matchAll(/[^\n]*(?:\n|$)/g)){if(!match[0])continue;const label=sectionHeading(match[0]);if(label)sections.push({label,heading:match[0],body:'',start:match.index!,bodyStart:match.index!+match[0].length})}
 for(let index=0;index<sections.length;index++)sections[index].body=content.slice(sections[index].bodyStart,sections[index+1]?.start??content.length)
 return {preamble:content.slice(0,sections[0]?.start??content.length),sections,newline:content.match(/\r?\n/)?.[0]??'\n'}
}
export function serializeSongFlow(doc:FlowDocument){let result=doc.preamble;for(const section of doc.sections){if(result&&!result.endsWith('\n'))result+=doc.newline;result+=section.heading;if(section.body&&!result.endsWith('\n'))result+=doc.newline;result+=section.body}return result}
export function flowConflicts(doc:FlowDocument){const groups=new Map<string,FlowSection[]>();for(const section of doc.sections){const key=sectionKey(section.label);groups.set(key,[...(groups.get(key)??[]),section])}return [...groups.values()].filter(rows=>new Set(rows.map(row=>sectionBodyKey(row.body))).size>1)}
export const hasFlowConflicts=(content:string)=>flowConflicts(parseSongFlow(content)).length>0
function renamed(section:FlowSection,label:string,newline:string){const prefix=section.heading.match(/^[ \t]*/)?.[0]??'',ending=section.heading.match(/\r?\n$/)?.[0]??'';return {...section,label,heading:prefix+'# '+label+(ending||newline)}}
function separateVariants(doc:FlowDocument,groups:FlowSection[][]){
 const used=new Set(doc.sections.map(row=>sectionKey(row.label)))
 const replacements=new Map<FlowSection,string>()
 for(const group of groups){
  const names=new Map<string,string>()
  let number=1
  for(const section of group){
   const body=sectionBodyKey(section.body)
   let label=names.get(body)
   if(!label){
    do{label=group[0].label+' '+number++}while(used.has(sectionKey(label)))
    used.add(sectionKey(label));names.set(body,label)
   }
   replacements.set(section,label)
  }
 }
 doc.sections=doc.sections.map(row=>{
  const label=replacements.get(row)
  return label?renamed(row,label,doc.newline):row
 })
 return serializeSongFlow(doc)
}

export function namePastedSectionVariants(content:string){
 const doc=parseSongFlow(content),conflicts=flowConflicts(doc)
 return conflicts.length?separateVariants(doc,conflicts):content
}
