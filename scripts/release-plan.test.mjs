import assert from 'node:assert/strict'
import {test} from 'node:test'

import {nextRevision} from './release-plan.mjs'

test('allocates revisions without reusing published or reserved tags', () => {
  assert.equal(nextRevision('11.11.0', []), 1)
  assert.equal(nextRevision('11.11.0', [
    'v11.11.0-2',
    'v11.11.0-10',
    'v11.11.0-10',
    'v11.10.0-99',
    'v11.11.0-11-draft',
    'v11.11.00-99',
  ]), 11)
  assert.equal(nextRevision('11.12.0', ['v11.11.0-10']), 1)
  assert.throws(() => nextRevision('11.11.0-beta', []), /stable/)
})
