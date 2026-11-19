import type { ReaderColumns } from './lib/reader-lines'
import {fitReaderFont,readerColumnCount} from './lib/reader-lines'
import { Children, cloneElement, isValidElement, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type Block = { children?: ReactNode; className?: string }
type Row = { nodes: ReactNode[]; height: number; wide: boolean; line: number; heading?: boolean; className?: string }

function splitLongLine(node: ReactNode, element: HTMLElement, size: number) {
  if (!isValidElement<Block>(node) || !element.querySelector('.song-word')) return []
  const rows: { nodes: ReactNode[]; top: number; height: number }[] = []
  let domIndex = 0
  for (const word of Children.toArray(node.props.children)) {
    if (isValidElement(word)) {
      const rect = element.children[domIndex++].getBoundingClientRect()
      const previous = rows[rows.length - 1]
      if (previous && rect.top <= previous.top + 1) {
        previous.height = Math.max(previous.height, rect.height)
      } else {
        rows.push({nodes: [], top: rect.top, height: Math.max(size * 3, rect.height)})
      }
    }
    rows[rows.length - 1]?.nodes.push(word)
  }
  return rows.map(row => ({
    height: row.height,
    node: cloneElement(node, {}, row.nodes.filter((part, index) =>
      index !== row.nodes.length - 1 || typeof part !== 'string' || part.trim())),
  }))
}
export default function SongPages({ children, fontSize, onFitFontSize, onNextSong, onPreviousSong, startOnLastPage=false, columnPreference }: { children: ReactNode; fontSize: number; onFitFontSize?:(size:number)=>void; onNextSong?: () => void; onPreviousSong?: () => void; startOnLastPage?: boolean; columnPreference:ReaderColumns }) {
  const viewport = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const navigation = useRef<HTMLElement>(null)
  const start = useRef<{x: number; y: number} | null>(null)
  const fittedWidth=useRef<number|null>(null)
  const [page, setPage] = useState(0)
  const [layout, setLayout] = useState<{height:number; count:number; size:number; pages:Row[][]}>({height:300,count:1,size:fontSize,pages:[[]]})
  const measuredPages = useRef<Row[][]>([[]])
  // Compare the rendered content, so account refreshes don't reset the reader.
  const contentText = (nodes: ReactNode): string => Children.toArray(nodes).map(node =>
    isValidElement<Block>(node) ? `${String(node.type)}(${contentText(node.props.children)})` : String(node)
  ).join('|')
  const signature = contentText(children)
  useLayoutEffect(() => {
    const element = viewport.current!
    let active = true
    const rebuild = () => {
      if (!active || !element.clientWidth) return
      const count = readerColumnCount(columnPreference,window.innerWidth)
      const height = Math.max(80, window.innerHeight - element.getBoundingClientRect().top - (navigation.current?.offsetHeight || 44) - 24)
      const measuring = measure.current!
      measuring.style.width = `${element.clientWidth}px`
      measuring.dataset.columns = count === 2 ? 'two' : 'one'
      const width = Math.max(1, (element.clientWidth - (count - 1) * 24) / count)
      let size=Math.min(fontSize,Math.max(12,Math.floor(height/3)))
      // Auto-fit once on opening and after a width change. Manual A+ may wrap at spaces.
      if(fittedWidth.current!==width){
        fittedWidth.current=width
        if(size>12){
          measuring.dataset.nowrap='true'
          size=fitReaderFont(size,width+1,value=>{measuring.style.fontSize=`${value}px`;return Math.max(0,...Array.from(measuring.querySelectorAll<HTMLElement>('.song-line:not([data-reader-spacer])')).map(line=>line.scrollWidth))})
        }
      }
      delete measuring.dataset.nowrap
      measuring.style.fontSize=`${size}px`
      if(size!==fontSize)onFitFontSize?.(size)
      const pages: Row[][] = [[]]
      let used = 0
      let line = 0
      const advance = () => { if (used) { pages.push([]); used = 0 } }
      Children.toArray(children).forEach((block, index) => {
        if (!isValidElement<Block>(block)) return
        const dom = measuring.children[index] as HTMLElement
        const rows: Row[] = []
        // Measure the same grid as the full set reader so wrapped lines share the taller cell’s row height.
        let rowTop = -Infinity
        Children.toArray(block.props.children).forEach((node, index) => {
          const element = dom.children[index] as HTMLElement
          const rect = element.getBoundingClientRect()
          const heading = element.classList.contains('song-section')
          const wide = heading || element.hasAttribute('data-reader-spacer')
          const previous = rows[rows.length - 1]
          const fragments = rect.height > height ? splitLongLine(node, element, size) : []
          if (fragments.length > 1) {
            // Finish the entire line before its neighbor if it needs more than a page.
            fragments.forEach(fragment => rows.push({
              nodes: [fragment.node], height: fragment.height, wide: false, line, className: block.props.className,
            }))
            rowTop = -Infinity
          } else if (rect.top > rowTop + 1 || wide || previous?.wide) {
            rows.push({nodes: [node], height: rect.height, wide, heading, line, className: block.props.className})
            rowTop = rect.top
          } else {
            previous.nodes.push(node)
            previous.height = Math.max(previous.height, rect.height)
          }
          line++
        })
        const sectionHeight = rows.reduce((total, row) => total + row.height, 0)
        if (sectionHeight <= height && used + sectionHeight > height) advance()
        rows.forEach((row, index) => {
          const next = rows[index + 1]
          const heightToKeep = row.height + (row.heading ? next?.height ?? 0 : 0)
          if (used + (heightToKeep <= height ? heightToKeep : row.height) > height) advance()
          pages[pages.length - 1].push(row)
          used += row.height
        })
      })
      const previousPages = measuredPages.current
      measuredPages.current = pages
      setLayout({height,count,size,pages})
      setPage(current => {
        if (startOnLastPage) return pages.length - 1
        if (previousPages.length === pages.length &&
          previousPages[current]?.[0]?.line === pages[current]?.[0]?.line) return current
        const firstLine = previousPages[current]?.[0]?.line ?? 0
        const nextPage = pages.findIndex(rows => rows.some(row => row.line === firstLine))
        // A wider row can begin one line before the line that used to start this page.
        if (nextPage >= 0) return nextPage
        const pageAfterLine = pages.findIndex(rows => (rows[0]?.line ?? 0) > firstLine)
        return pageAfterLine < 0 ? pages.length - 1 : Math.max(0, pageAfterLine - 1)
      })
    }
    rebuild()
    const observer = new ResizeObserver(rebuild)
    observer.observe(element)
    window.addEventListener('resize', rebuild)
    document.fonts.ready.then(rebuild)
    return () => { active = false; observer.disconnect(); window.removeEventListener('resize',rebuild) }
  // The signature tracks actual song content without depending on fresh React element objects.
  }, [signature, fontSize, startOnLastPage, columnPreference])
  const pages = layout.pages.length
  const turn = (direction:number) => {
    if(direction<0 && page===0 && onPreviousSong) return onPreviousSong()
    if(direction>0 && page===pages-1 && onNextSong) return onNextSong()
    setPage(current=>Math.max(0,Math.min(pages-1,current+direction)))
  }
  return <section className="song-book" aria-label="Paged song reader">
    <div className="book-measure reader-chart" ref={measure} style={{fontSize}} aria-hidden="true">{children}</div>
    <div ref={viewport} className="book-viewport" style={{height:layout.height+2,fontSize:layout.size}} tabIndex={0}
      aria-label="Lyrics. Use left and right arrow keys or swipe to turn pages."
      onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();turn(event.key==='ArrowRight'?1:-1)}}}
      onTouchStart={event=>{const t=event.touches[0];start.current={x:t.clientX,y:t.clientY}}}
      onTouchEnd={event=>{const line=(event.target as Element).closest('.song-line');if(line&&line.scrollWidth>line.clientWidth+1){start.current=null;return}const t=event.changedTouches[0],s=start.current;start.current=null;if(s&&Math.abs(t.clientX-s.x)>50&&Math.abs(t.clientX-s.x)>Math.abs(t.clientY-s.y))turn(t.clientX<s.x?1:-1)}}>
      <div className="book-spread reader-chart" data-columns={layout.count === 2 ? 'two' : 'one'}>
        {layout.pages[page]?.map((row, index) =>
          <div className={`book-row ${row.className ?? ''}`} data-wide={row.wide || undefined} key={`${page}-${index}`}>
            {row.nodes}
          </div>
        )}
      </div>
    </div>
    <nav ref={navigation} className="book-navigation" aria-label="Song pages">
      <button disabled={page===0&&!onPreviousSong} onClick={()=>turn(-1)}>{page===0&&onPreviousSong?'← Previous song':'← Previous'}</button>
      <button disabled={page===pages-1&&!onNextSong} onClick={()=>turn(1)}>{page===pages-1&&onNextSong?'Next song →':'Next →'}</button>
      <span aria-live="polite">Page {page+1} of {pages}</span>
    </nav>
  </section>
}

