type Row = { width: number; height: number }
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

  return {
    add: (start: number, end: number, value: number) => update(start, end, value),
    set: (i: number, value: number) => update(i, i + 1, value, true),
    best: () => ({ width: min[1], start: index[1] }),
  }
}

export function fitStageColumns(rows: readonly Row[], width: number, height: number, gap: number, count: number | 'auto'): StageColumn[] | null {
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
      while (columnHeight > height) {
        costs.set(first, Infinity)
        columnHeight -= rows[first++].height
      }
      const best = costs.best()
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
