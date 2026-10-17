import assert from 'node:assert/strict'
import {test} from 'node:test'

import {needsPackage, selectSource, validateSource} from './heroku-source.mjs'

test('selects the newest immutable fork revision and ignores unrelated or unfinished releases', () => {
  const release = (tag_name, extra = {}) => ({tag_name, draft: false, prerelease: false, immutable: true, ...extra})
  const releases = [
    release('v99.0.0'),
    release('dentarg-v11.12.0-2'),
    release('dentarg-v11.12.0-10'),
    release('dentarg-v11.11.0-99'),
    release('dentarg-v11.13.0-1', {draft: true}),
    release('dentarg-v11.14.0-1', {prerelease: true}),
    release('dentarg-v11.15.0-1', {immutable: false}),
  ]
  assert.equal(selectSource(releases).tag_name, 'dentarg-v11.12.0-10')
  assert.equal(selectSource(releases, 'dentarg-v11.11.0-99').tag_name, 'dentarg-v11.11.0-99')
  assert.equal(selectSource([]), undefined)
  assert.throws(() => selectSource(releases, 'local-fixes'), /Invalid/)
  assert.throws(() => selectSource(releases, 'dentarg-v11.15.0-1'), /immutable/)
})

test('rejects release metadata that does not identify the exact tagged source', () => {
  const commit = 'a'.repeat(40)
  const tag = 'dentarg-v11.12.0-1'
  const source = {
    schema: 1, repository: 'dentarg/heroku-cli', tag, version: '11.12.0', commit,
    upstream: {repository: 'heroku/cli', tag: 'v11.12.0', commit: 'b'.repeat(40)},
  }
  assert.doesNotThrow(() => validateSource(source, tag, commit))
  assert.throws(() => validateSource(source, tag, 'c'.repeat(40)), /does not match/)
  assert.throws(() => validateSource({...source, version: '11.11.0'}, tag, commit), /does not match/)
  assert.throws(() => validateSource({...source, upstream: {...source.upstream, tag: 'main'}}, tag, commit), /upstream baseline/)
})

test('skips packaged commits, allows explicit rebuilds, and rejects source downgrades', () => {
  const commit = 'a'.repeat(40)
  const source = {tag: 'dentarg-v11.12.0-2', commit}
  const formula = `# CLI source commit: ${commit}\n# CLI source tag: dentarg-v11.12.0-2\n`
  assert.equal(needsPackage(source, formula), false)
  assert.equal(needsPackage(source, formula, true), true)
  assert.equal(needsPackage({...source, commit: 'b'.repeat(40), tag: 'dentarg-v11.12.0-3'}, formula), true)
  assert.throws(() => needsPackage({...source, tag: 'dentarg-v11.12.0-1'}, formula), /downgrade/)
  assert.throws(() => needsPackage({...source, tag: 'dentarg-v11.11.0-9'}, formula), /downgrade/)
  const legacyFormula = `# CLI source commit: ${commit}\n  url "https://example.com/heroku-11.12.0.tgz"\n`
  assert.equal(needsPackage(source, legacyFormula), false)
  assert.throws(() => needsPackage({...source, tag: 'dentarg-v11.11.0-9'}, legacyFormula), /downgrade/)
})
