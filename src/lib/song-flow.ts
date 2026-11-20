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
type SectionRepeat = { label: string; bodyIndex: number }

export function resolveSectionRepeats(sections: readonly FlowSection[]): SectionRepeat[] {
  const used = new Set(sections.map(section => sectionKey(section.label)))
  const bodies = sections.map(section => sectionBodyKey(section.body))
  const groups = new Map<string, { first: number; previous?: number; names: Map<string, string> }>()

  sections.forEach((section, index) => {
    if (!bodies[index].trim()) return
    const key = sectionKey(section.label)
    const group = groups.get(key) ?? { first: index, names: new Map<string, string>() }
    group.names.set(bodies[index], '')
    groups.set(key, group)
  })

  for (const group of groups.values()) {
    if (group.names.size < 2) continue
    const base = sections[group.first].label
    let number = 1
    for (const body of group.names.keys()) {
      let label
      do { label = `${base} ${number++}` } while (used.has(sectionKey(label)))
      used.add(sectionKey(label))
      group.names.set(body, label)
    }
  }

  return sections.map((section, index) => {
    const group = groups.get(sectionKey(section.label))
    if (!group) return { label: section.label, bodyIndex: index }
    if (bodies[index].trim()) group.previous = index
    // A heading-only repeat uses the closest earlier written section.
    // A repeat before the first written section uses that first section.
    const bodyIndex = group.previous ?? group.first
    return { label: group.names.get(bodies[bodyIndex]) || section.label, bodyIndex }
  })
}

export function hasFlowConflicts(content: string) {
  const { sections } = parseSongFlow(content)
  return resolveSectionRepeats(sections).some(({ label }, index) => label !== sections[index].label)
}

export function namePastedSectionVariants(content: string) {
  const doc = parseSongFlow(content)
  const repeats = resolveSectionRepeats(doc.sections)
  if (repeats.every(({ label }, index) => label === doc.sections[index].label)) return content
  doc.sections = doc.sections.map((section, index) => {
    const { label } = repeats[index]
    if (label === section.label) return section
    const indent = section.heading.match(/^[ \t]*/)?.[0] ?? ''
    const ending = section.heading.match(/\r?\n$/)?.[0] ?? ''
    return { ...section, label, heading: indent + '# ' + label + ending }
  })
  return serializeSongFlow(doc)
}
