export const minReadingTextSize = 6
export const maxReadingTextSize = 32

export default function ReadingTextSize({value,onChange}:{
  value:number
  onChange:(size:number)=>void
}){
  return <div className="reading-tools" role="group" aria-label="Song text size">
    <span>Text size</span>
    <button type="button" aria-label="Decrease song text size" disabled={value<=minReadingTextSize}
      onClick={()=>onChange(Math.max(minReadingTextSize,value-2))}>A−</button>
    <output>{value}px</output>
    <button type="button" aria-label="Increase song text size" disabled={value>=maxReadingTextSize}
      onClick={()=>onChange(Math.min(maxReadingTextSize,value+2))}>A+</button>
  </div>
}
