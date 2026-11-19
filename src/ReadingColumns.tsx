import type { ReaderColumns } from './lib/reader-lines'

export default function ReadingColumns({value,onChange}:{
  value:ReaderColumns
  onChange:(value:ReaderColumns)=>void
}){
  return <label className="reading-columns">
    Columns
    <select value={value} onChange={event=>onChange(event.target.value as ReaderColumns)}>
      <option value="auto">Auto</option>
      <option value="one">One</option>
      <option value="two">Two</option>
    </select>
  </label>
}
