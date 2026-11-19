import { setlistSoundingKey } from './lib/setlist-arrangement'
import type {Song} from './App'
export default function SetlistKeyOverview({songs,onOpen,label='Setlist keys'}:{songs:(Song|undefined)[];onOpen?:(index:number)=>void;label?:string}){
 return <section className="key-overview"><h3>{label}</h3><p>Sounding keys for this setlist.</p><div className="key-table-scroll"><table><thead><tr><th scope="col">Order</th><th scope="col">Song</th><th scope="col">Sounding key</th></tr></thead><tbody>{songs.map((song,index)=><tr key={index}><td>{index+1}</td><td>{song&&onOpen?<button onClick={()=>onOpen(index)}>{song.title}</button>:song?.title??'Song unavailable'}</td><td><strong className="key-badge">{(song&&setlistSoundingKey(song.key,song.setlist_key).trim())||'Not set'}</strong></td></tr>)}</tbody></table></div>{!songs.length&&<p>No songs in this setlist yet.</p>}</section>
}
