import {appendFileSync, readFileSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const repository = 'dentarg/heroku-cli'
const tagPattern = /^dentarg-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))-([1-9]\d*)$/

function parts(tag) {
  const match = tagPattern.exec(tag)
  if (!match) throw new Error(`Invalid fork source tag: ${tag}`)
  const values = [...match[1].split('.'), match[2]].map(Number)
  if (!values.every(Number.isSafeInteger)) throw new Error('Source version is too large')
  return values
}

export function selectSource(releases, requested = '') {
  if (requested) parts(requested)
  const candidates = releases.filter(release => !release.draft && !release.prerelease && release.immutable === true && tagPattern.test(release.tag_name))
  if (requested) {
    const selected = candidates.find(release => release.tag_name === requested)
    if (!selected) throw new Error('Requested source must be a published immutable fork release')
    return selected
  }
  return candidates.sort((a, b) => {
    const left = parts(a.tag_name)
    const right = parts(b.tag_name)
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2] || right[3] - left[3]
  })[0]
}

export function validateSource(source, tag, commit) {
  const match = tagPattern.exec(tag)
  if (!match || source.schema !== 1 || source.repository !== repository || source.tag !== tag || source.version !== match[1] || source.commit !== commit || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('Source metadata does not match the published tag and commit')
  }
  if (source.upstream?.repository !== 'heroku/cli' || source.upstream.tag !== `v${source.version}` || !/^[a-f0-9]{40}$/.test(source.upstream.commit)) {
    throw new Error('Source metadata has an invalid upstream baseline')
  }
}

export function needsPackage(source, formula, rebuild = false) {
  const selected = parts(source.tag)
  const previousTag = /^# CLI source tag: (dentarg-v\S+)$/m.exec(formula)?.[1]
  const previousVersion = /\/heroku-(\d+\.\d+\.\d+)\.tgz"/.exec(formula)?.[1]
  const previous = previousTag ? parts(previousTag) : previousVersion?.split('.').map(Number)
  if (previous) {
    const comparison = selected[0] - previous[0] || selected[1] - previous[1] || selected[2] - previous[2] || (previousTag ? selected[3] - previous[3] : 0)
    if (comparison < 0) throw new Error('Refusing to downgrade the packaged source release')
  }
  const packaged = /^# CLI source commit: ([a-f0-9]{40})$/m.exec(formula)?.[1]
  return packaged !== source.commit || rebuild
}

async function api(path, accept = 'application/vnd.github+json') {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {accept, ...(token ? {authorization: `Bearer ${token}`} : {})},
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`GitHub API ${path}: ${response.status}`)
  return response.json()
}

function output(values) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''))
}

async function discover() {
  const [requested = ''] = process.argv.slice(2)
  const releases = []
  for (let page = 1; ; page++) {
    const batch = await api(`repos/${repository}/releases?per_page=100&page=${page}`)
    releases.push(...batch)
    if (batch.length < 100) break
  }
  const release = selectSource(releases, requested)
  if (!release) {
    output({changed: false})
    console.log('No immutable fork source release has been published yet')
    return
  }
  const tag = release.tag_name
  let object = (await api(`repos/${repository}/git/ref/tags/${tag}`)).object
  // Both lightweight and annotated source tags are supported.
  for (let depth = 0; object.type === 'tag' && depth < 5; depth++) {
    object = (await api(`repos/${repository}/git/tags/${object.sha}`)).object
  }
  if (object.type !== 'commit') throw new Error('Source tag does not resolve to a commit')
  const asset = release.assets.find(asset => asset.name === 'source.json')
  if (!asset || !Number.isSafeInteger(asset.id)) throw new Error('Source release is missing source.json')
  const source = await api(`repos/${repository}/releases/assets/${asset.id}`, 'application/octet-stream')
  validateSource(source, tag, object.sha)

  const formula = readFileSync(new URL('../Formula/heroku.rb', import.meta.url), 'utf8')
  const changed = needsPackage(source, formula, process.env.REBUILD === 'true')
  if (changed) writeFileSync('heroku-source.json', `${JSON.stringify(source, null, 2)}\n`)
  output({changed, commit: source.commit, source_tag: tag})
  console.log(`${changed ? 'Selected' : 'Already packaged'} ${tag} (${source.commit})`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await discover()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
