import assert from 'node:assert/strict'
import {test} from 'node:test'

import {platforms, sparoidFormula} from './sparoid-formula.mjs'

const sums = platforms.map((p, i) => `${String(i).repeat(64)}  sparoid-2.2.1-${p}.tar.gz`).join('\n')

test('renders each platform with its archive and checksum', () => {
  const formula = sparoidFormula('dentarg/sparoid.rb', 'v2.2.1', `${sums}\n`)
  assert.match(formula, /download\/v2\.2\.1\/sparoid-2\.2\.1-linux-x86_64\.tar\.gz"\n\s+sha256 "3{64}"/)
  assert.match(formula, /download\/v2\.2\.1\/sparoid-2\.2\.1-darwin-arm64\.tar\.gz"\n\s+sha256 "0{64}"/)
  assert.doesNotMatch(formula, /__\w+__/)
})

test('refuses an incomplete release or another tag', () => {
  assert.throws(() => sparoidFormula('dentarg/sparoid.rb', 'v2.2.1', sums.split('\n').slice(1).join('\n')),
    /No checksum for sparoid-2\.2\.1-darwin-arm64/)
  assert.throws(() => sparoidFormula('dentarg/sparoid.rb', '2.2.1', sums), /vX\.Y\.Z/)
})
