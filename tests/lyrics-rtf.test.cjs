const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(path, imports = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpile(fs.readFileSync(path, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }),
    { exports, require: name => imports[name] })
  return exports
}

const chord = load('src/lib/chord/transpose.ts')
const flow = load('src/lib/song-flow.ts', { './chord/transpose.ts': chord })
const lyrics = load('src/lib/lyrics-document.ts', { './chord/transpose': chord, './song-flow': flow })
const { exportLyricsRtf } = load('src/lib/lyrics-rtf.ts', { './lyrics-document': lyrics })

test('lyrics RTF formats headings, preserves order and omits chart directions and empty sections', () => {
  const chart = [
    'I – V1V2 – C – B1B1B2 – C - C',
    '# Intro', '(|D / G / | D / / / |)',
    '# Verse1 [slight soft]', '  {D}First lyric ', '  Next lyric',
    '# Chorus', '{G}Sing', 'REPEAT', 'Repeat Chorus [piano, soft]',
    '# Verse1', '(until Risen King)',
    '# Bridge', '(x2)', 'Bridge lyric',
    '# Chorus',
  ].join('\r\n')
  const rtf = exportLyricsRtf([{ title: 'Song A', content: chart }, { title: 'Song B', content: 'Opening lyric' }])
  assert.match(rtf, /^\{\\rtf1/)
  assert.match(rtf, /\\fs40\\b Song A\\b0/)
  assert.match(rtf, /\\fs28\\b Verse 1\\b0/)
  assert.match(rtf, /First lyric\\line Next lyric/)
  assert.match(rtf, /\\pagebb[^\n]*Song B/)
  assert.match(rtf, /Opening lyric/)
  assert.equal((rtf.match(/\\b Chorus\\b0/g) ?? []).length, 1)
  assert.doesNotMatch(rtf, /Intro|REPEAT|Repeat Chorus|Risen King|B1B1B2|\(x2\)|slight soft|# Verse|\|D|\{G\}/)
})

test('lyrics RTF escapes braces and backslashes and encodes multilingual lyrics', () => {
  const rtf = exportLyricsRtf([{ title: 'A {song} \\ test', content: '# Verse\n하나님 🎵\nYou’re here' }])
  assert.ok(rtf.includes(String.raw`A \{song\} \\ test`))
  assert.ok(rtf.includes(String.raw`\u-10920?\u-20328?\u-19752? \u-10180?\u-8267?`))
  assert.ok(rtf.includes(String.raw`You\u8217?re here`))
})

test('clipboard lyrics provide bold headings, escaped HTML and clean plain text', () => {
  const { html, text } = lyrics.lyricsClipboardContent([
    { title: 'Sing & Rejoice <together>', content: '# Intro\n(|D / |)\n# Verse1 [soft]\n{D}You’re here\nSecond line\nRepeat Verse 1' },
    { title: 'Another song', content: '[Chorus]\n{C}We sing' },
  ])
  assert.equal(html, '<p><strong>Sing &amp; Rejoice &lt;together&gt;</strong></p><p><strong>Verse 1</strong><br>You’re here<br>Second line</p><p><strong>Another song</strong></p><p><strong>Chorus</strong><br>We sing</p>')
  assert.equal(text, 'Sing & Rejoice <together>\n\nVerse 1\nYou’re here\nSecond line\n\nAnother song\n\nChorus\nWe sing')
})
