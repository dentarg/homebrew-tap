import {readFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const tapRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const platforms = ['darwin-arm64', 'darwin-x86_64', 'linux-arm64', 'linux-x86_64']

// Formula/sparoid.rb for a release of sparoid.rb's executables (its
// Binaries workflow): the tag, vVERSION, and the release's SHA256SUMS.
export function sparoidFormula(repository, tag, sums) {
  const match = /^v(\d+\.\d+\.\d+)$/.exec(tag)
  if (!match) throw new Error(`Expected a vX.Y.Z tag, not ${tag}`)
  const version = match[1]
  const replacements = {REPOSITORY: repository, TAG: tag, VERSION: version}
  for (const platform of platforms) {
    const archive = `sparoid-${version}-${platform}.tar.gz`
    const line = sums.split('\n').find(l => l.trim().endsWith(`  ${archive}`))
    const sha256 = line?.trim().split(/\s+/)[0]
    if (!/^[0-9a-f]{64}$/.test(sha256 ?? '')) throw new Error(`No checksum for ${archive} in SHA256SUMS`)
    replacements[`SHA256_${platform.toUpperCase().replace('-', '_')}`] = sha256
  }

  const template = readFileSync(join(tapRoot, 'scripts', 'sparoid.rb.template'), 'utf8')
  return template.replace(/__(\w+)__/g, (_, key) => {
    if (!(key in replacements)) throw new Error(`Unknown template field: ${key}`)
    return replacements[key]
  })
}
