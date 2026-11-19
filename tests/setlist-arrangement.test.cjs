const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependency) {
  const exports = {}
  vm.runInNewContext(ts.transpile(fs.readFileSync(file, 'utf8'), { module: ts.ModuleKind.CommonJS }),
    { exports, require: () => dependency })
  return exports
}
const helpers = load('src/lib/setlist-arrangement.ts', load('src/lib/chord/transpose.ts'))

test('legacy lists and repeated entries keep their order', () => {
  const legacy = { song_ids: [4, 2, 4] }
  assert.deepEqual(Array.from(helpers.setlistEntries(legacy), entry => entry.song_id), legacy.song_ids)
  const entries = [{song_id:4,key_override:'G'}, {song_id:4,key_override:'Bb'}]
  assert.equal(helpers.setlistEntries({song_ids:[4,4],song_entries:entries}), entries)
})

test('capo shapes transpose both slash chord notes and leave the original chart alone', () => {
  const original = { key: 'Am', setlist_key: 'Bb', content: '[Verse]\n{Am/E}Words' }
  const sounding = helpers.arrangedSong(original)
  const withCapo = helpers.arrangedSong(original, 3)
  assert.equal(sounding.key, 'Bbm')
  assert.equal(sounding.content, '[Verse]\n{Bbm/F}Words')
  assert.equal(withCapo.key, 'Gm')
  assert.equal(withCapo.content, '[Verse]\n{Gm/D}Words')
  assert.equal(original.key, 'Am')
  assert.equal(original.content, '[Verse]\n{Am/E}Words')
  const unknown = { ...original, key: 'Unknown' }
  assert.equal(helpers.arrangedSong(unknown, 4), unknown)
})
