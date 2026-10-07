// Install a formula of this tap with Homebrew, then run its test, a strict
// audit and the style checks, and uninstall it again.
//
//   node scripts/brew-test.mjs NAME [ARCHIVE]
//
// With ARCHIVE, the formula's url points at that local file during the
// install, to test a release archive before its GitHub download exists.

import {execFileSync, spawnSync} from 'node:child_process'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [name, archive] = process.argv.slice(2)
if (!/^[a-z0-9-]+$/.test(name ?? '') || process.argv.length > 4) {
  throw new Error('Usage: node scripts/brew-test.mjs NAME [ARCHIVE]')
}

const formulaPath = join(root, 'Formula', `${name}.rb`)
const formula = readFileSync(formulaPath, 'utf8')
const full = `dentarg/tap/${name}`
const brewRepository = execFileSync('brew', ['--repository'], {encoding: 'utf8'}).trim()
const tapPath = join(brewRepository, 'Library', 'Taps', 'dentarg', 'homebrew-tap')
const createdLink = !existsSync(tapPath)
if (!createdLink && realpathSync(tapPath) !== realpathSync(root)) {
  throw new Error('A different dentarg/tap checkout is already tapped')
}

const temporary = mkdtempSync(join(tmpdir(), `${name}-formula-test-`))
const env = {
  ...process.env,
  HOMEBREW_NO_AUTO_UPDATE: '1',
  HOMEBREW_NO_INSTALL_CLEANUP: '1',
  HOMEBREW_NO_AUTOREMOVE: '1',
  XDG_CONFIG_HOME: temporary,
}
const brew = args => execFileSync('brew', args, {env, stdio: 'inherit'})
let installed = false
try {
  if (createdLink) {
    mkdirSync(dirname(tapPath), {recursive: true})
    symlinkSync(root, tapPath, 'dir')
  }

  if (spawnSync('brew', ['help', 'trust'], {env, stdio: 'ignore'}).status === 0) {
    brew(['trust', '--formula', full])
  }

  if (spawnSync('brew', ['list', '--versions', name], {env, stdio: 'ignore'}).status === 0) {
    throw new Error(`Run this test in an environment without an existing ${name} installation`)
  }

  if (archive) {
    const local = formula.replace(/^  url "[^"]+"$/m, `  url "${pathToFileURL(resolve(archive)).href}"`)
    if (local === formula) throw new Error(`No top-level url in ${formulaPath} to point at ${archive}`)
    writeFileSync(formulaPath, local)
  }
  brew(['install', '--formula', full])
  installed = true
  writeFileSync(formulaPath, formula)
  brew(['test', full])
  brew(['audit', '--strict', full])
  brew(['style', formulaPath])
} finally {
  writeFileSync(formulaPath, formula)
  if (installed) spawnSync('brew', ['uninstall', '--formula', full], {env, stdio: 'inherit'})
  if (createdLink && existsSync(tapPath)) unlinkSync(tapPath)
  rmSync(temporary, {recursive: true, force: true})
}
