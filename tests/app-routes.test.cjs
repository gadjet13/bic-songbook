const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, require) {
  const exports = {}
  vm.runInNewContext(ts.transpile(fs.readFileSync(file, 'utf8'), {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }), { exports, require, URLSearchParams })
  return exports
}
const stage = load('src/lib/stage-url.ts')
const exportsObject = load('src/lib/app-routes.ts', () => stage)
const { appPath, parseAppPath } = exportsObject
const id = '84ec8ca0-7f90-4622-9b16-bcdf193d0d23'

test('screen and editor URLs round trip', () => {
  const paths = [
    '/', '/my', '/church', '/members', '/my/setlists', '/my/setlists/new',
    `/my/setlists/${id}/edit`, `/my/setlists/${id}/read`, `/my/setlists/${id}/read/edit/42-2`,
    '/my/setlists/new/songs/new', `/my/setlists/${id}/songs/42/edit`, `/my/setlists/${id}/songs/42/edit/full`,
    '/my/songs/new', '/church/songs/42', '/my/songs/42/edit/full', '/my/songs/42/read/edit',
    `/my/folders/${id}`, `/members/${id}/songs/42`, `/shared/${id}`, `/shared/${id}/read`, `/shared/${id}/songs/42/read`,
  ]
  for (const path of paths) assert.equal(appPath(parseAppPath(path)), path)
})

test('malformed addresses and shared link capabilities are kept out of ordinary routes', () => {
  for (const path of ['/my/songs/Infinity', '/my/songs/9007199254740993', '/my/songs/4/delete',
    '/church/setlists/new', `/members/${id}/songs/42/edit`, `/setlists/${id}`, '/oauth/consent']) {
    assert.equal(parseAppPath(path), null, path)
  }
})

test('stage reader query accepts only chart occurrence keys', () => {
  assert.equal(stage.stageView('?view=stage&song=42-2').song, '42-2')
  assert.equal(stage.stageView('?view=stage&song=42').song, null)
  assert.equal(stage.stageSearch('?view=reader'), '')
})
