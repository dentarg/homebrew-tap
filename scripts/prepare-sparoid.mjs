#!/usr/bin/env node

// Render Formula/sparoid.rb for a GitHub release of sparoid.rb's
// executables, by default the latest release of dentarg/sparoid.rb.
//
//   node scripts/prepare-sparoid.mjs [vX.Y.Z]
//
// Env: SPAROID_REPOSITORY (default dentarg/sparoid.rb), GITHUB_TOKEN (optional,
// for the API's rate limit), GITHUB_OUTPUT (gets version= and changed=).

import {appendFileSync, chmodSync, existsSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {sparoidFormula} from './sparoid-formula.mjs'

const tapRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repository = process.env.SPAROID_REPOSITORY || 'dentarg/sparoid.rb'

function headers() {
  return process.env.GITHUB_TOKEN ? {authorization: `Bearer ${process.env.GITHUB_TOKEN}`} : {}
}

async function get(url) {
  const response = await fetch(url, {headers: headers()})
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`)
  return response
}

async function prepareSparoid() {
  const args = process.argv.slice(2)
  if (args.length > 1) throw new Error('Usage: node scripts/prepare-sparoid.mjs [vX.Y.Z]')
  let tag = args[0]
  if (!tag) {
    const latest = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {headers: headers()})
    if (latest.status === 404) {
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'changed=false\n')
      console.log(`${repository} has no release yet`)
      return
    }
    if (!latest.ok) throw new Error(`${latest.url}: ${latest.status} ${latest.statusText}`)
    tag = (await latest.json()).tag_name
  }
  const sums = await (await get(`https://github.com/${repository}/releases/download/${tag}/SHA256SUMS`)).text()
  const formula = sparoidFormula(repository, tag, sums)

  const formulaPath = join(tapRoot, 'Formula', 'sparoid.rb')
  const changed = !existsSync(formulaPath) || readFileSync(formulaPath, 'utf8') !== formula
  writeFileSync(formulaPath, formula)
  chmodSync(formulaPath, 0o644)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${tag.slice(1)}\nchanged=${changed}\n`)
  }
  console.log(`${changed ? 'Rendered' : 'Unchanged:'} Formula/sparoid.rb for ${repository} ${tag}`)
}

try {
  await prepareSparoid()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
