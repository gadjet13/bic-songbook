const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const api = {}
vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/stage-layout.ts', 'utf8'), {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}), { exports: api })

const { fitStageColumns } = api

test('stage layout fits uneven columns without reordering or splitting rows', () => {
  const rows = [210, 172, 75, 55, 90, 83].map(width => ({ width, height: 20 }))
  const fitted = fitStageColumns(rows, 395, 40, 8, 'auto')
  assert.deepEqual(Array.from(fitted, row => [row.start, row.end, row.width]), [
    [0, 2, 210], [2, 4, 75], [4, 6, 90],
  ])
  assert.equal(fitStageColumns(rows, 390, 40, 8, 'auto'), null)
})

test('stage layout keeps the requested count and Auto prefers fewer columns', () => {
  const rows = Array.from({ length: 7 }, () => ({ width: 40, height: 10 }))
  assert.equal(fitStageColumns(rows, 290, 100, 8, 'auto').length, 1)
  assert.equal(fitStageColumns(rows, 290, 100, 8, 6).length, 6)
  assert.equal(fitStageColumns(rows.slice(0, 2), 290, 100, 8, 6).length, 2)
})

test('stage fit agrees with exhaustive partitions for small charts', () => {
  function exhaustive(rows, height, count, start = 0) {
    if (!count) return start === rows.length ? 0 : Infinity
    let best = Infinity
    let used = 0
    let width = 0
    for (let i = start; i < rows.length; i++) {
      used += rows[i].height
      if (used > height) break
      width = Math.max(width, rows[i].width)
      best = Math.min(best, width + exhaustive(rows, height, count - 1, i + 1))
    }
    return best
  }
  let seed = 35
  const next = (limit) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % limit + 1
  }
  for (let trial = 0; trial < 200; trial++) {
    const rows = Array.from({ length: next(9) }, () => ({ width: next(12), height: next(7) }))
    const height = next(20)
    const count = Math.min(rows.length, next(6))
    const expected = exhaustive(rows, height, count) + 2 * (count - 1)
    const result = fitStageColumns(rows, 100, height, 2, count)
    assert.equal(result ? result.reduce((sum, row) => sum + row.width, 0) + 2 * (count - 1) : Infinity, expected)
  }
})

const { balanceStageColumns } = api
const counts = columns => Array.from(columns, ({ start, end }) => end - start)

test('balances a width-optimal singleton column when there is room to move rows', () => {
  const rows = [100, 40, 40, 40, 40, 40, 40, 40].map(width => ({ width, height: 10 }))
  const fitted = fitStageColumns(rows, 148, 100, 8, 2)
  assert.deepEqual(counts(fitted), [1, 7])
  assert.deepEqual(counts(balanceStageColumns(rows, 148, 100, 8, fitted)), [4, 4])
})

test('allows uneven columns if spreading wide rows would exceed the page width', () => {
  const rows = [100, 100, 100, 100, 100, 100, 40, 40].map(width => ({ width, height: 10 }))
  const fitted = fitStageColumns(rows, 148, 100, 8, 2)
  assert.deepEqual(counts(balanceStageColumns(rows, 148, 100, 8, fitted)), [6, 2])
})

test('counts grouped headings and rows together when looking for an even split', () => {
  const rows = [3, 1, 1, 1, 1, 1].map(lines => ({ width: 40, height: 10 * lines, lines }))
  const fitted = fitStageColumns(rows, 88, 50, 8, 2)
  assert.deepEqual(counts(balanceStageColumns(rows, 88, 50, 8, fitted)), [2, 4])
})

test('uses the closest feasible balance when widths rule out the ideal split', () => {
  const rows = [100, 100, 100, 100, 100, 80, 60, 40, 40, 40].map(width => ({ width, height: 10 }))
  const fitted = fitStageColumns(rows, 168, 100, 8, 2)
  assert.deepEqual(counts(fitted), [7, 3])
  assert.deepEqual(counts(balanceStageColumns(rows, 168, 100, 8, fitted)), [6, 4])
  assert.deepEqual(counts(balanceStageColumns(rows, 148, 100, 8, fitted)), [7, 3])
})
