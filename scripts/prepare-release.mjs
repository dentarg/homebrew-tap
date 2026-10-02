#!/usr/bin/env node

import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const tapRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function run(command, args, cwd, capture = false) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {...process.env, HUSKY: '0'},
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
}

function prepareRelease() {
  const [checkout, revision] = process.argv.slice(2)
  if (!checkout || !/^[1-9]\d*$/.test(revision ?? '') || process.argv.length !== 4) {
    throw new Error('Usage: node scripts/prepare-release.mjs /path/to/heroku-cli REVISION')
  }

  const source = resolve(checkout)
  if (run('git', ['status', '--porcelain', '--untracked-files=no'], source, true).trim()) {
    throw new Error('Commit tracked CLI changes first; releases are built from HEAD.')
  }

  const commit = run('git', ['rev-parse', 'HEAD'], source, true).trim()
  const packageJson = JSON.parse(run('git', ['show', `${commit}:package.json`], source, true))
  const {version} = packageJson
  if (packageJson.name !== 'heroku' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Expected a Heroku CLI checkout with a stable x.y.z version.')
  }

  const tag = `v${version}-${revision}`
  const releaseDirectory = join(tapRoot, 'releases', tag)
  if (existsSync(releaseDirectory)) {
    throw new Error(`${releaseDirectory} already exists; use a new revision.`)
  }

  const temporary = mkdtempSync(join(tmpdir(), 'heroku-tap-'))
  try {
    const buildDirectory = join(temporary, 'source')
    mkdirSync(buildDirectory)
    const sourceArchive = join(temporary, 'source.tar')
    run('git', ['archive', '--format=tar', `--output=${sourceArchive}`, commit], source)
    run('tar', ['-xf', sourceArchive, '-C', buildDirectory], source)
    run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], buildDirectory)
    run('npm', ['run', 'build'], buildDirectory)

    // npm includes shrinkwrap in published packages, unlike package-lock.json.
    run('npm', ['shrinkwrap'], buildDirectory)
    const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json'], buildDirectory, true))
    const archive = join(buildDirectory, packed.filename)
    const sha256 = createHash('sha256').update(readFileSync(archive)).digest('hex')
    const replacements = {COMMIT: commit, REVISION: revision, SHA256: sha256, TAG: tag, VERSION: version}
    const template = readFileSync(join(tapRoot, 'scripts', 'heroku.rb.template'), 'utf8')
    const formula = template.replace(/__(\w+)__/g, (_, key) => {
      if (!(key in replacements)) throw new Error(`Unknown template field: ${key}`)
      return replacements[key]
    })

    mkdirSync(releaseDirectory, {recursive: true})
    copyFileSync(archive, join(releaseDirectory, packed.filename))
    writeFileSync(join(releaseDirectory, 'SHA256SUMS'), `${sha256}  ${packed.filename}\n`)
    writeFileSync(join(releaseDirectory, 'release.json'), `${JSON.stringify({
      source: 'https://github.com/dentarg/heroku-cli',
      commit,
      version,
      revision: Number(revision),
      tag,
      archive: packed.filename,
      sha256,
    }, null, 2)}\n`)
    writeFileSync(join(releaseDirectory, 'notes.md'), [
      `Heroku CLI ${version}, dentarg revision ${revision}.`,
      '',
      `Built from dentarg/heroku-cli commit \`${commit}\`.`,
      'Includes compiled CLI files and npm-shrinkwrap.json from the committed dependency lock.',
      '',
      'Install: `brew install dentarg/tap/heroku`',
      'Upgrade: `brew upgrade dentarg/tap/heroku`',
      '',
    ].join('\n'))
    writeFileSync(join(tapRoot, 'Formula', 'heroku.rb'), formula)
    console.log(`Prepared ${tag} in ${releaseDirectory}`)
    console.log('Review Formula/heroku.rb, then follow README.md to publish the release.')
  } finally {
    rmSync(temporary, {recursive: true, force: true})
  }
}

try {
  prepareRelease()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
