// A Spinel snapshot's version, from `git describe` in the Spinel checkout
// as its Makefile runs it: "2026.09.12" at a release tag, "2026.09.12+6411"
// 6411 commits past it. Homebrew versions and Git tags take the commit
// count after a "-" instead: 2026.09.12-6411.
export function spinelVersion(describe) {
  const match = /^(\d{4}\.\d{2}\.\d{2}(?:\.\d+)?)(?:-(\d+)-g[0-9a-f]+)?$/.exec(describe.trim())
  if (!match) throw new Error(`Not a Spinel release description: ${describe.trim() || '(none)'}`)
  const [, release, commits] = match
  return {release: commits ? `${release}+${commits}` : release, version: commits ? `${release}-${commits}` : release}
}
