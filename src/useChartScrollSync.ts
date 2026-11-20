import { useLayoutEffect, useRef } from 'react'

function rowAtOrBefore(rows: readonly number[], value: number) {
  let start = 0
  let end = rows.length
  while (start < end) {
    const index = Math.floor((start + end) / 2)
    if (rows[index] <= value) start = index + 1
    else end = index
  }
  return Math.max(0, start - 1)
}

// Textareas do not expose line positions, so measure the same wrapping in a hidden element.
function editorLineOffsets(editor: HTMLTextAreaElement, mirror: HTMLDivElement, chart: string) {
  const style = getComputedStyle(editor)
  Object.assign(mirror.style, {
    width: `${editor.clientWidth}px`,
    paddingInlineStart: style.paddingInlineStart,
    paddingInlineEnd: style.paddingInlineEnd,
    font: style.font,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
    tabSize: style.tabSize,
    whiteSpace: style.whiteSpace,
    overflowWrap: style.overflowWrap,
    wordBreak: style.wordBreak,
  })
  const fragment = document.createDocumentFragment()
  const rows = chart.split(/\r?\n/).map(line => {
    const row = document.createElement('div')
    row.textContent = line || '\u00a0'
    fragment.append(row)
    return row
  })
  mirror.replaceChildren(fragment)
  const top = mirror.getBoundingClientRect().top
  const paddingTop = parseFloat(style.paddingTop)
  return rows.map(row => row.getBoundingClientRect().top - top + paddingTop)
}

export default function useChartScrollSync(chart: string, enabled: boolean) {
  const editor = useRef<HTMLTextAreaElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  const positions = useRef({raw: [] as number[], rendered: [] as number[], sourceLines: [] as number[]})
  const expected = useRef(new WeakMap<HTMLElement, number>())

  function scroll(from: HTMLElement, to: HTMLElement | null) {
    const position = expected.current.get(from)
    expected.current.delete(from)
    if (position !== undefined && Math.abs(from.scrollTop - position) < 1) return
    const {raw, rendered, sourceLines} = positions.current
    if (!to || !raw.length || !rendered.length) return

    let next: number
    if (from.scrollTop <= 0) next = 0
    else if (from === editor.current) {
      const sourceLine = rowAtOrBefore(raw, from.scrollTop + 0.75)
      const index = rowAtOrBefore(sourceLines, sourceLine)
      const following = sourceLines[index + 1] ?? Infinity
      const nearest = following - sourceLine < sourceLine - sourceLines[index] ? index + 1 : index
      next = rendered[nearest]
    } else {
      const index = rowAtOrBefore(rendered, from.scrollTop + 0.75)
      next = raw[sourceLines[index]] ?? 0
    }

    const clamped = Math.max(0, Math.min(next, to.scrollHeight - to.clientHeight))
    if (Math.abs(clamped - to.scrollTop) < 1) return
    to.scrollTop = clamped
    // Ignore the scroll event caused by updating the other pane.
    expected.current.set(to, to.scrollTop)
  }

  useLayoutEffect(() => {
    const input = editor.current
    const pane = preview.current
    const measuringPane = mirror.current
    if (!enabled || !input || !pane || !measuringPane) {
      positions.current = {raw: [], rendered: [], sourceLines: []}
      return
    }

    const measure = () => {
      const top = pane.getBoundingClientRect().top + pane.clientTop
      const rows = Array.from(pane.querySelectorAll<HTMLElement>('[data-source-line]:not([data-reader-spacer])'))
      positions.current = {
        raw: editorLineOffsets(input, measuringPane, chart),
        rendered: rows.map(row => row.getBoundingClientRect().top - top + pane.scrollTop),
        sourceLines: rows.map(row => Number(row.dataset.sourceLine)),
      }
      expected.current.delete(input)
      scroll(input, pane)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(input)
    observer.observe(pane)
    return () => observer.disconnect()
  }, [chart, enabled])

  return {
    editor, preview, mirror,
    scrollEditor: (element: HTMLTextAreaElement) => scroll(element, preview.current),
    scrollPreview: (element: HTMLDivElement) => scroll(element, editor.current),
  }
}
