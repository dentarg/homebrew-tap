import {execFileSync} from 'node:child_process'
import {appendFileSync, readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

export function nextRevision(version, tags) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable x.y.z CLI version')
  const prefix = `v${version}-`
  let revision = 0
  for (const tag of tags) {
    if (!tag.startsWith(prefix)) continue
    const suffix = tag.slice(prefix.length)
    if (/^[1-9]\d*$/.test(suffix)) revision = Math.max(revision, Number(suffix))
  }

  if (!Number.isSafeInteger(revision + 1)) throw new Error('Release revision is too large')
  return revision + 1
}

function planRelease() {
  const [checkout] = process.argv.slice(2)
  const repository = process.env.GITHUB_REPOSITORY
  if (!checkout || !repository || !process.env.GITHUB_OUTPUT) {
    throw new Error('Expected a CLI checkout, GITHUB_REPOSITORY, and GITHUB_OUTPUT')
  }

  const {name, version} = JSON.parse(readFileSync(join(checkout, 'package.json'), 'utf8'))
  if (name !== 'heroku') throw new Error('Expected a Heroku CLI checkout')
  // Include drafts and tags without a release, including interrupted publishes.
  const tags = []
  for (const [endpoint, field] of [['releases', 'tag_name'], ['tags', 'name']]) {
    const output = execFileSync('gh', [
      'api', '--paginate', `repos/${repository}/${endpoint}?per_page=100`, '--jq', `.[].${field}`,
    ], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']})
    tags.push(...output.trim().split('\n'))
  }

  const revision = nextRevision(version, tags)
  const tag = `v${version}-${revision}`
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nrevision=${revision}\ntag=${tag}\n`)
  console.log(`Preparing ${tag}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    planRelease()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
