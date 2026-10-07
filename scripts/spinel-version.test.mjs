import assert from 'node:assert/strict'
import {test} from 'node:test'

import {spinelVersion} from './spinel-version.mjs'

test('names a snapshot after the release it follows', () => {
  assert.deepEqual(spinelVersion('2026.09.12-6411-ga2bd89005\n'), {release: '2026.09.12+6411', version: '2026.09.12-6411'})
  assert.deepEqual(spinelVersion('2026.09.12'), {release: '2026.09.12', version: '2026.09.12'})
  assert.deepEqual(spinelVersion('2026.10.07.1-3-gabc1234'), {release: '2026.10.07.1+3', version: '2026.10.07.1-3'})
  assert.throws(() => spinelVersion(''), /Not a Spinel release/)
  assert.throws(() => spinelVersion('v1.0-3-gabc'), /Not a Spinel release/)
})
