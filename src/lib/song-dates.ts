export type SongDateField='created_at'|'updated_at'
export type SongDateSort='title'|'added-newest'|'added-oldest'|'edited-newest'|'edited-oldest'
type DatedSong={title:string;id:number;created_at?:string|null;updated_at?:string|null}
export function localSongDate(value:string|null|undefined){if(!value)return '';const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function matchesSongDate(song:DatedSong,field:SongDateField,from:string,to:string){if(!from&&!to)return true;const date=localSongDate(song[field]);return !!date&&(!from||date>=from)&&(!to||date<=to)}
export function sortSongsByDate<T extends DatedSong>(songs:T[],sort:SongDateSort):T[]{return [...songs].sort((a,b)=>{if(sort!=='title'){const field=sort.startsWith('added')?'created_at':'updated_at',av=Date.parse(a[field]??''),bv=Date.parse(b[field]??'');if(Number.isFinite(av)!==Number.isFinite(bv))return Number.isFinite(av)?-1:1;if(Number.isFinite(av)&&av!==bv)return (av-bv)*(sort.endsWith('newest')?-1:1)}return a.title.localeCompare(b.title)||a.id-b.id})}
