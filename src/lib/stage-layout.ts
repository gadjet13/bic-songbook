export type StageRow = { width: number; height: number; lines?: number }
type LineBounds = { totals: number[]; minimum: number; maximum: number }
export type StageColumn = { start: number; end: number; width: number }

// Each possible column start has a cost equal to the previous columns' width
// plus the widest row in the new column. Maintain that cost as rows are added.
function columnCosts(length: number) {
  const size = 2 ** Math.ceil(Math.log2(length))
  const min = new Float64Array(size * 2).fill(Infinity)
  const offset = new Float64Array(size * 2)
  const index = new Int32Array(size * 2)
  for (let i = 0; i < size; i++) index[size + i] = i

  function update(start: number, end: number, value: number, replace = false, node = 1, left = 0, right = size) {
    if (start <= left && right <= end) {
      if (replace) min[node] = value
      else {
        min[node] += value
        offset[node] += value
      }
      return
    }

    const middle = (left + right) / 2
    if (offset[node]) {
      for (const child of [node * 2, node * 2 + 1]) {
        min[child] += offset[node]
        offset[child] += offset[node]
      }
      offset[node] = 0
    }
    if (start < middle) update(start, end, value, replace, node * 2, left, middle)
    if (end > middle) update(start, end, value, replace, node * 2 + 1, middle, right)
    const child = min[node * 2] <= min[node * 2 + 1] ? node * 2 : node * 2 + 1
    min[node] = min[child]
    index[node] = index[child]
  }

  // Starts before this boundary are tall enough to meet the minimum line count.
  function bestBefore(end: number, node = 1, left = 0, right = size): {width: number; start: number} {
    if (right <= end) return { width: min[node], start: index[node] }
    if (left >= end) return { width: Infinity, start: left }
    const middle = (left + right) / 2
    const earlier = bestBefore(end, node * 2, left, middle)
    const later = bestBefore(end, node * 2 + 1, middle, right)
    const best = earlier.width <= later.width ? earlier : later
    return { width: best.width + offset[node], start: best.start }
  }

  return {
    add: (start: number, end: number, value: number) => update(start, end, value),
    set: (i: number, value: number) => update(i, i + 1, value, true),
    best: (end = size) => bestBefore(end),
  }
}

export function fitStageColumns(rows: readonly StageRow[], width: number, height: number, gap: number, count: number | 'auto', bounds?: LineBounds): StageColumn[] | null {
  if (!rows.length) return []
  const limit = Math.min(rows.length, count === 'auto' ? 6 : count)
  if (rows.some(row => row.height > height || row.width > width) ||
      rows.reduce((total, row) => total + row.height, 0) > height * limit) return null

  const parents: Int32Array[] = []
  let previous = new Float64Array(rows.length + 1).fill(Infinity)
  previous[0] = 0

  for (let used = 1; used <= limit; used++) {
    const costs = columnCosts(rows.length)
    const current = new Float64Array(rows.length + 1).fill(Infinity)
    const from = new Int32Array(rows.length + 1)
    const stack: { start: number; width: number }[] = []
    let first = 0
    let last = 0
    let columnHeight = 0
    for (const [end, row] of rows.entries()) {
      let start = end
      while (stack.length && stack[stack.length - 1].width <= row.width) {
        const group = stack.pop()!
        costs.add(group.start, start, row.width - group.width)
        start = group.start
      }
      stack.push({ start, width: row.width })
      costs.set(end, previous[end] + row.width)
      columnHeight += row.height
      const totalLines = bounds?.totals[end + 1] ?? 0
      while (columnHeight > height || (bounds && totalLines - bounds.totals[first] > bounds.maximum)) {
        costs.set(first, Infinity)
        columnHeight -= rows[first++].height
      }
      if (bounds) {
        while (last <= end && totalLines - bounds.totals[last] >= bounds.minimum) last++
      }
      const best = costs.best(bounds ? last : undefined)
      current[end + 1] = best.width
      from[end + 1] = best.start
    }
    parents.push(from)
    if ((count === 'auto' || used === limit) && current[rows.length] + gap * (used - 1) <= width) {
      const columns: StageColumn[] = []
      let end = rows.length
      for (let i = used - 1; i >= 0; i--) {
        const start = parents[i][end]
        const columnWidth = rows.slice(start, end).reduce((max, row) => Math.max(max, row.width), 0)
        columns.unshift({ start, end, width: columnWidth })
        end = start
      }
      return columns
    }
    previous = current
  }
  return null
}

export function balanceStageColumns(rows: readonly StageRow[], width: number, height: number, gap: number, fitted: StageColumn[]): StageColumn[] {
  if (fitted.length < 2) return fitted

  const totals = [0]
  for (const row of rows) totals.push(totals[totals.length - 1] + (row.lines ?? 1))
  const target = totals[rows.length] / fitted.length
  const minimum = Math.floor(target)
  const maximum = Math.ceil(target)
  const ideal = fitStageColumns(rows, width, height, gap, fitted.length, {totals, minimum, maximum})
  if (ideal) return ideal

  // Find the smallest deviation from an even split that fits the same page.
  let balanced = fitted
  let low = 1
  let high = Math.max(...fitted.map(({start, end}) => {
    const lines = totals[end] - totals[start]
    return Math.max(minimum - lines, lines - maximum)
  })) - 1
  while (low <= high) {
    const deviation = Math.floor((low + high) / 2)
    const candidate = fitStageColumns(rows, width, height, gap, fitted.length, {
      totals, minimum: Math.max(1, minimum - deviation), maximum: maximum + deviation,
    })
    if (candidate) {
      balanced = candidate
      high = deviation - 1
    } else low = deviation + 1
  }
  return balanced
}
