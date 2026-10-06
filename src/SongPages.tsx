import { Children, isValidElement, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type Block = { children?: ReactNode }
export default function SongPages({ children, fontSize, onNextSong, onPreviousSong, startOnLastPage=false }: { children: ReactNode; fontSize: number; onNextSong?: () => void; onPreviousSong?: () => void; startOnLastPage?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const navigation = useRef<HTMLElement>(null)
  const start = useRef<{x: number; y: number} | null>(null)
  const [page, setPage] = useState(0)
  const [layout, setLayout] = useState<{height:number; count:number; columns:ReactNode[][]}>({height:300,count:1,columns:[[]]})
  // Compare the rendered content, so account refreshes don't reset the reader.
  const contentText = (nodes: ReactNode): string => Children.toArray(nodes).map(node =>
    isValidElement<Block>(node) ? `${String(node.type)}(${contentText(node.props.children)})` : String(node)
  ).join('|')
  const signature = contentText(children)
  useLayoutEffect(() => {
    const element = viewport.current!
    let active = true
    const rebuild = () => {
      if (!active) return
      const count = window.innerWidth >= 700 ? 2 : 1
      const height = Math.max(80, window.innerHeight - element.getBoundingClientRect().top - (navigation.current?.offsetHeight || 44) - 24)
      const measuring = measure.current!
      measuring.style.width = `${(element.clientWidth - (count-1)*24)/count}px`
      const blocks = Children.toArray(children)
      const columns: ReactNode[][] = [[]]
      let used = 0
      const advance = () => { columns.push([]); used = 0 }
      blocks.forEach((block, index) => {
        const dom = measuring.children[index] as HTMLElement
        const blockHeight = dom.getBoundingClientRect().height
        if (blockHeight <= height) {
          if (used + blockHeight > height) advance()
          columns[columns.length-1].push(block)
          used += blockHeight
          return
        }
        // A section needing two columns begins on a fresh page when it can fit there.
        if (blockHeight <= height*count && used) advance()
        if (blockHeight <= height*count && (columns.length-1)%count !== 0) advance()
        const lines = isValidElement<Block>(block) ? Children.toArray(block.props.children) : [block]
        lines.forEach((line, lineIndex) => {
          const lineHeight = (dom.children[lineIndex] as HTMLElement)?.getBoundingClientRect().height || 0
          if (used && used + lineHeight > height) advance()
          columns[columns.length-1].push(line)
          used += lineHeight
        })
      })
      setLayout({height,count,columns})
      setPage(current => startOnLastPage ? Math.ceil(columns.length/count)-1 : Math.min(current,Math.ceil(columns.length/count)-1))
    }
    rebuild()
    const observer = new ResizeObserver(rebuild)
    observer.observe(element)
    window.addEventListener('resize', rebuild)
    document.fonts.ready.then(rebuild)
    return () => { active = false; observer.disconnect(); window.removeEventListener('resize',rebuild) }
  // The signature tracks actual song content without depending on fresh React element objects.
  }, [signature, fontSize, startOnLastPage])
  const pages = Math.max(1,Math.ceil(layout.columns.length/layout.count))
  const turn = (direction:number) => {
    if(direction<0 && page===0 && onPreviousSong) return onPreviousSong()
    if(direction>0 && page===pages-1 && onNextSong) return onNextSong()
    setPage(current=>Math.max(0,Math.min(pages-1,current+direction)))
  }
  return <section className="song-book" aria-label="Paged song reader">
    <div className="book-measure" ref={measure} style={{fontSize}} aria-hidden="true">{children}</div>
    <div ref={viewport} className="book-viewport" style={{height:layout.height,fontSize}} tabIndex={0}
      aria-label="Lyrics. Use left and right arrow keys or swipe to turn pages."
      onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();turn(event.key==='ArrowRight'?1:-1)}}}
      onTouchStart={event=>{const t=event.touches[0];start.current={x:t.clientX,y:t.clientY}}}
      onTouchEnd={event=>{const t=event.changedTouches[0],s=start.current;start.current=null;if(s&&Math.abs(t.clientX-s.x)>50&&Math.abs(t.clientX-s.x)>Math.abs(t.clientY-s.y))turn(t.clientX<s.x?1:-1)}}>
      <div className="book-spread" style={{gridTemplateColumns:`repeat(${layout.count}, minmax(0,1fr))`}}>
        {Array.from({length:layout.count},(_,i)=><div className="book-column" key={page+'-'+i}>{layout.columns[page*layout.count+i]?.map((node,j)=><div className="book-piece" key={j}>{node}</div>)}</div>)}
      </div>
    </div>
    <nav ref={navigation} className="book-navigation" aria-label="Song pages">
      <button disabled={page===0&&!onPreviousSong} onClick={()=>turn(-1)}>{page===0&&onPreviousSong?'← Previous song':'← Previous'}</button>
      <button disabled={page===pages-1&&!onNextSong} onClick={()=>turn(1)}>{page===pages-1&&onNextSong?'Next song →':'Next →'}</button>
      <span aria-live="polite">Page {page+1} of {pages}</span>
    </nav>
  </section>
}
