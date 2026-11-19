const notes=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
const roots:Record<string,number>={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11}
/** Estimate the pasted arrangement's key; relative major/minor can remain ambiguous. */
export function suggestKeys(content:string):string[] {
 const explicit=content.match(/(?:^|\n)\s*(?:original\s+)?key\s*:\s*([A-G](?:#|b)?(?:m|maj|min)?)\b/i)
 if(explicit)return [explicit[1][0].toUpperCase()+explicit[1].slice(1).replace(/min$/,'m').replace(/maj$/,'')]
 const chords=[...content.matchAll(/\{([A-G](?:#|b)?)([^}\s/]*)?(?:\/[A-G](?:#|b)?)?\/*\}|\[([A-G](?:#|b)?)([^\]\s/]*)?(?:\/[A-G](?:#|b)?)?\/*\]/g)].flatMap(match=>{
  const root=match[1]??match[3],quality=match[2]??match[4]??''
  if(!/^(?:(?:maj|min|dim|aug|sus|add|omit|no|m|M)|\d|[#b()+-])*$/.test(quality))return []
  return [{root:roots[root],minor:/^(?:m(?!aj)|min)/.test(quality),dim:quality.includes('dim')}]
 })
 if(!chords.length)return []
 const candidates:Array<{key:string;score:number}>=[]
 for(let tonic=0;tonic<12;tonic++)for(const minor of [false,true]){
  const majorRoot=minor?(tonic+3)%12:tonic
  const diatonic=[0,2,4,5,7,9,11]
  let score=0
  for(const chord of chords){
   const degree=diatonic.indexOf((chord.root-majorRoot+12)%12)
   score+=degree<0?-3:chord.dim?(degree===6?2:0):chord.minor?([1,2,5].includes(degree)?3:-1):([0,3,4].includes(degree)?3:0)
   if(chord.root===tonic&&chord.minor===minor)score+=.25
  }
  const last=chords.at(-1)!
  if(last.root===tonic&&last.minor===minor)score+=.6
  candidates.push({key:notes[tonic]+(minor?'m':''),score})
 }
 candidates.sort((a,b)=>b.score-a.score)
 return candidates.slice(0,2).map(candidate=>candidate.key)
}
