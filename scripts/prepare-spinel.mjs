#!/usr/bin/env node

// Snapshot a Spinel checkout's HEAD with `make dist` (the tree plus the
// vendored parsers, so it builds with no network) and render
// Formula/spinel.rb for it in releases/spinel-VERSION/.
//
//   node scripts/prepare-spinel.mjs /path/to/spinel
//   node scripts/prepare-spinel.mjs --version /path/to/spinel   (prints VERSION)

import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {spinelVersion} from './spinel-version.mjs'

const tapRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(command, args, cwd, capture = false) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
}

function describe(source) {
  return spinelVersion(run('git', [
    'describe', '--tags',
    '--match', '[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9]',
    '--match', '[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9].[0-9]*',
  ], source, true))
}

function prepareSpinel() {
  const args = process.argv.slice(2)
  const versionOnly = args[0] === '--version'
  if (versionOnly) args.shift()
  if (args.length !== 1) {
    throw new Error('Usage: node scripts/prepare-spinel.mjs [--version] /path/to/spinel')
  }

  const source = resolve(args[0])
  const {release, version} = describe(source)
  if (versionOnly) {
    console.log(version)
    return
  }
  if (run('git', ['status', '--porcelain', '--untracked-files=no'], source, true).trim()) {
    throw new Error('Commit tracked Spinel changes first; snapshots are built from HEAD.')
  }

  const commit = run('git', ['rev-parse', 'HEAD'], source, true).trim()
  const tag = `spinel-${version}`
  const releaseDirectory = join(tapRoot, 'releases', tag)
  if (existsSync(releaseDirectory)) throw new Error(`${releaseDirectory} already exists.`)

  run('make', ['dist'], source)
  // Asset names avoid the "+" of Spinel's own archive name
  const archive = `spinel-${version}.tar.xz`
  const built = join(source, 'build', 'dist', `spinel-${release}.tar.xz`)
  const sha256 = createHash('sha256').update(readFileSync(built)).digest('hex')
  const replacements = {ARCHIVE: archive, COMMIT: commit, SHA256: sha256, TAG: tag, VERSION: version}
  const template = readFileSync(join(tapRoot, 'scripts', 'spinel.rb.template'), 'utf8')
  const formula = template.replace(/__(\w+)__/g, (_, key) => {
    if (!(key in replacements)) throw new Error(`Unknown template field: ${key}`)
    return replacements[key]
  })

  mkdirSync(releaseDirectory, {recursive: true})
  copyFileSync(built, join(releaseDirectory, archive))
  writeFileSync(join(releaseDirectory, 'SHA256SUMS'), `${sha256}  ${archive}\n`)
  writeFileSync(join(releaseDirectory, 'release.json'), `${JSON.stringify({
    source: 'https://github.com/matz/spinel',
    commit,
    release,
    version,
    tag,
    archive,
    sha256,
  }, null, 2)}\n`)
  writeFileSync(join(releaseDirectory, 'notes.md'), [
    `Spinel ${release}, a snapshot of matz/spinel.`,
    '',
    `Built from commit [\`${commit.slice(0, 9)}\`](https://github.com/matz/spinel/commit/${commit}).`,
    'The archive is `make dist`: the source tree with the vendored parsers.',
    '',
    'Install: `brew install dentarg/tap/spinel`',
    'Upgrade: `brew upgrade dentarg/tap/spinel`',
    '',
  ].join('\n'))
  writeFileSync(join(tapRoot, 'Formula', 'spinel.rb'), formula)
  chmodSync(join(tapRoot, 'Formula', 'spinel.rb'), 0o644)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\nversion=${version}\narchive=${archive}\n`)
  }
  console.log(`Prepared ${tag} in ${releaseDirectory}`)
}

try {
  prepareSpinel()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
