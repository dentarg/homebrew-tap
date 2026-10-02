import {createHash} from 'node:crypto'
import {execFileSync, spawnSync} from 'node:child_process'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [tag] = process.argv.slice(2)
if (!/^v\d+\.\d+\.\d+-[1-9]\d*$/.test(tag ?? '')) {
  throw new Error('Usage: node scripts/test-formula.mjs vVERSION-REVISION')
}

const formulaPath = join(root, 'Formula', 'heroku.rb')
const formula = readFileSync(formulaPath, 'utf8')
const release = JSON.parse(readFileSync(join(root, 'releases', tag, 'release.json'), 'utf8'))
const archive = join(root, 'releases', tag, `heroku-${release.version}.tgz`)
const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex')
if (checksum !== release.sha256 || !formula.includes(`sha256 "${checksum}"`)) {
  throw new Error('Release archive and formula checksums do not match')
}

const brewRepository = execFileSync('brew', ['--repository'], {encoding: 'utf8'}).trim()
const tapPath = join(brewRepository, 'Library', 'Taps', 'dentarg', 'homebrew-tap')
const createdLink = !existsSync(tapPath)
if (!createdLink && realpathSync(tapPath) !== realpathSync(root)) {
  throw new Error('A different dentarg/tap checkout is already tapped')
}

const temporary = mkdtempSync(join(tmpdir(), 'heroku-formula-test-'))
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
    brew(['trust', '--formula', 'dentarg/tap/heroku'])
  }

  if (spawnSync('brew', ['list', '--versions', 'heroku'], {env, stdio: 'ignore'}).status === 0) {
    throw new Error('Run this test in an environment without an existing Heroku installation')
  }

  // Test the exact release archive before its GitHub download URL exists.
  writeFileSync(formulaPath, formula.replace(/^  url "[^"]+"$/m, `  url "${pathToFileURL(archive).href}"`))
  brew(['install', '--formula', 'dentarg/tap/heroku'])
  installed = true
  writeFileSync(formulaPath, formula)
  brew(['test', 'dentarg/tap/heroku'])
  brew(['audit', '--strict', 'dentarg/tap/heroku'])
  brew(['style', formulaPath])
} finally {
  writeFileSync(formulaPath, formula)
  if (installed) spawnSync('brew', ['uninstall', '--formula', 'dentarg/tap/heroku'], {env, stdio: 'inherit'})
  if (createdLink && existsSync(tapPath)) unlinkSync(tapPath)
  rmSync(temporary, {recursive: true, force: true})
}
