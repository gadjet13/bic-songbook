import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function SongPages({ children, fontSize, onNextSong, onPreviousSong, startOnLastPage=false }: { children: ReactNode; fontSize: number; onNextSong?: () => void; onPreviousSong?: () => void; startOnLastPage?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const start = useRef<{x: number; y: number} | null>(null)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)
  const [height, setHeight] = useState(300)
  useEffect(() => {
    const element = viewport.current!
    const layout = () => {
      setHeight(Math.max(120, window.innerHeight - element.getBoundingClientRect().top - 76))
      setPage(0)
    }
    layout()
    const observer = new ResizeObserver(layout)
    observer.observe(element)
    window.addEventListener('resize', layout)
    return () => { observer.disconnect(); window.removeEventListener('resize', layout) }
  }, [])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const element = viewport.current!
      const count = Math.max(1, Math.ceil((element.scrollWidth + 24) / (element.clientWidth + 24)))
      const initial = startOnLastPage ? count - 1 : 0
      setPages(count)
      setPage(initial)
      element.scrollLeft = initial * (element.clientWidth + 24)
    })
    return () => cancelAnimationFrame(frame)
  }, [children, fontSize, height, startOnLastPage])
  const turn = (direction: number) => {
    if (direction < 0 && page === 0 && onPreviousSong) {
      onPreviousSong()
      return
    }
    if (direction > 0 && page === pages - 1 && onNextSong) {
      onNextSong()
      return
    }
    const next = Math.max(0, Math.min(pages - 1, page + direction))
    setPage(next)
    const element = viewport.current!
    element.scrollLeft = next * (element.clientWidth + 24)
  }
  return <section className="song-book" aria-label="Paged song reader">
    <div ref={viewport} className="book-viewport" style={{height, fontSize}}
      tabIndex={0} aria-label="Lyrics. Use left and right arrow keys or swipe to turn pages."
      onKeyDown={event => { if(event.key === 'ArrowRight' || event.key === 'ArrowLeft') {event.preventDefault(); turn(event.key === 'ArrowRight' ? 1 : -1)} }}
      onTouchStart={event => { const touch=event.touches[0]; start.current={x:touch.clientX,y:touch.clientY} }}
      onTouchEnd={event => { const touch=event.changedTouches[0]; const previous=start.current; start.current=null; if(previous && Math.abs(touch.clientX-previous.x)>50 && Math.abs(touch.clientX-previous.x)>Math.abs(touch.clientY-previous.y)) turn(touch.clientX<previous.x ? 1 : -1) }}>
      <div className="book-columns" style={{height}}>{children}</div>
    </div>
    <nav className="book-navigation" aria-label="Song pages">
      <button disabled={page===0 && !onPreviousSong} onClick={()=>turn(-1)} aria-label={page===0 && onPreviousSong ? 'Previous song' : 'Previous page'}>{page===0 && onPreviousSong ? '← Previous song' : '← Previous'}</button>
      <span aria-live="polite">Page {page+1} of {pages}</span>
      <button disabled={page===pages-1 && !onNextSong} onClick={()=>turn(1)} aria-label={page===pages-1 && onNextSong ? 'Next song' : 'Next page'}>{page===pages-1 && onNextSong ? 'Next song →' : 'Next →'}</button>
    </nav>
  </section>
}
