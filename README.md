# dentarg's Homebrew tap

| Formula | What |
|---|---|
| `heroku` | the Heroku CLI with dentarg's local fixes (this README up to [Spinel](#spinel)) |
| `spinel` | [Spinel](https://github.com/matz/spinel), the Ruby AOT compiler, a daily snapshot of `master` |
| `sparoid` | the [sparoid.rb](https://github.com/dentarg/sparoid.rb) client compiled with Spinel, no Ruby needed |

Heroku CLI packages published immutable source releases from
[dentarg/heroku-cli](https://github.com/dentarg/heroku-cli). The fork owns upstream
synchronization and patch validation; this tap builds and tests the Homebrew
package. Each package contains compiled JavaScript and locked npm dependencies.

## Install

```sh
brew install dentarg/tap/heroku
```

Homebrew installs Node.js and the CLI's runtime dependencies. Installation needs
access to GitHub and the npm registry. The same release archive works on macOS
and Linux; dependencies are installed for the target machine.

If `heroku/brew/heroku` is already installed, uninstall that formula first:

```sh
brew uninstall heroku/brew/heroku
brew install dentarg/tap/heroku
```

Use `command -v heroku` to check that a previous npm installation is not taking
precedence. This tap uses the same Heroku login and plugin data as upstream.
To leave your global Git configuration untouched, add this to your shell:

```sh
export HEROKU_DISABLE_GIT_CONFIG=1
```

The wrapper sets `HEROKU_SKIP_NEW_VERSION_CHECK=true` to suppress npm version
notices and `HEROKU_DISABLE_AUTOUPDATE=true` to disable the separate background
self-updater. `heroku update` points back to Homebrew. Update with:

```sh
brew update
brew upgrade dentarg/tap/heroku
```

## Automatic Heroku releases

**Release Heroku** runs daily at 05:41 UTC on `main`. It selects the newest
published immutable release named `dentarg-vVERSION-REVISION` in the fork.
Drafts, prereleases, mutable releases, and unrelated upstream tags are ignored.
It verifies `source.json` against the tag's exact commit and upstream version,
then checks out that SHA. There is no release until the fork publishes its first
immutable source release. An already packaged source commit is a no-op.

The workflow:

1. Selects the next unused tap revision for the upstream version.
2. Builds the released source with `npm ci`, packages compiled JavaScript and
   the dependency lock, and renders the formula and checksum.
3. Installs the exact archive on macOS and Linux and runs the functional test,
   strict audit, and style checks.
4. Pushes a new tap release tag and publishes the archive, checksum, and source
   metadata before updating the formula on `main`.

The fork's unit suite, lint, and regression checks gate its source release.
The tap's tests check the installed package, including suppression of a cached
new-version warning and preservation of Git configuration with the opt-out.
Source tags and upstream SHAs are retained in package release metadata; the
formula records the exact source tag and commit.

Each repository uses its own built-in `GITHUB_TOKEN` for writes to that
repository. Public source discovery needs no cross-repository credentials or
workflow dispatch. Only the publishing job has `contents: write`. Keep both
repositories public, enable Actions, and allow the publishing job to create tags
and update the tap's `main`. The CLI fork must have release immutability enabled.

Release runs are serialized. Existing tags and drafts reserve their revision.
After an interrupted publication, start a new run; do not rerun only a publishing
job that already pushed its tag. A new run uses the next free revision and never
replaces existing assets. Changes to the tap during testing stop publication.

Source revisions and packaging revisions are independent: CLI `11.12.0` starts
at tap tag `v11.12.0-1`, and packaging changes use `v11.12.0-2`, etc. Homebrew
recognizes these upgrades even when `heroku --version` stays the same.

## Manual Heroku releases

Dispatch **Release Heroku** on `main` to check for a new source immediately:

```sh
gh workflow run release.yml --repo dentarg/homebrew-tap --ref main
```

To select a particular published immutable source release:

```sh
gh workflow run release.yml --repo dentarg/homebrew-tap --ref main \
  -f source_tag=dentarg-v11.12.0-1
```

Branches and arbitrary commits are not accepted by the publishing workflow.
Selecting an older source release cannot downgrade the packaged source.
For a formula/template-only change, commit `scripts/heroku.rb.template` and
request a new packaging revision of the selected source:

```sh
gh workflow run release.yml --repo dentarg/homebrew-tap --ref main \
  -f rebuild=true
```

The two schedules are independent: the next tap run picks up any completed
source release. GitHub can delay schedules or disable them after 60 days without
repository activity; manual dispatch remains available.

## Prepare and validate locally

Requirements: Git, tar, Node.js 22 or newer, and npm. Build a committed checkout
without changing it:

```sh
node scripts/prepare-release.mjs /path/to/heroku-cli 1
```

The final argument is the tap revision. Output goes under the ignored
`releases/vVERSION-REVISION/` directory, and the script refuses to overwrite an
existing release directory. Local preparation accepts a committed checkout for
inspection; the publishing workflow requires immutable source metadata.

```sh
node --test scripts/*.test.mjs
jactionlint .github/workflows/release.yml
node scripts/test-formula.mjs v11.12.0-1
```

The formula test installs the local archive before its public URL exists, runs
the Homebrew checks, then restores the formula and uninstalls the test copy.
Run it without an existing Heroku installation. Homebrew and the locally
prepared release archive are required.

## Spinel

```sh
brew install dentarg/tap/spinel
```

Spinel has dated releases (`2026.09.12`) but moves fast, so this formula builds
a snapshot of `master` from source. Its version is Spinel's own name for the
build with the commit count after a `-`: `2026.09.12-6411` is what
`spinel --version` calls `2026.09.12+6411`. It depends on `openssl@3`, and
`spinel` needs a C compiler at run time (Xcode's command line tools on macOS).

**Release Spinel** runs daily and can be dispatched with a `source_ref` in
matz/spinel:

```sh
gh workflow run release-spinel.yml --repo dentarg/homebrew-tap --ref main \
  -f source_ref=master
```

1. `scripts/prepare-spinel.mjs` names the snapshot. A run stops when the tag
   `spinel-VERSION` or its release exists, so an unchanged `master` publishes
   nothing.
2. It runs `make dist` in the checkout (the tree plus the vendored parsers, so
   Homebrew builds without network access) and renders `Formula/spinel.rb`
   from `scripts/spinel.rb.template`.
3. `scripts/brew-test.mjs` builds that archive with Homebrew on macOS and
   Linux, then runs the formula's test (it compiles a program using
   `require "openssl"` and runs it), a strict audit and the style checks.
4. The publishing job commits the formula, pushes the tag, creates the release
   with the archive, and then pushes `main`, as for Heroku.

Locally, from a clean matz/spinel checkout:

```sh
node scripts/prepare-spinel.mjs /path/to/spinel
node scripts/brew-test.mjs spinel releases/spinel-VERSION/spinel-VERSION.tar.xz
```

## sparoid

```sh
brew install dentarg/tap/sparoid
```

dentarg/sparoid.rb's `Binaries` workflow compiles sparoid with Spinel and
attaches `sparoid-VERSION-OS-ARCH.tar.gz` and `SHA256SUMS` to the GitHub release
of each `vX.Y.Z` tag: Linux (statically linked) and macOS, each for x86_64 and
arm64. The formula installs the executable for the machine; it has no
dependencies.

**Release sparoid** runs daily and can be dispatched with a `tag` (empty for
the latest release):

```sh
gh workflow run release-sparoid.yml --repo dentarg/homebrew-tap --ref main \
  -f tag=v2.2.1
```

`scripts/prepare-sparoid.mjs` renders `Formula/sparoid.rb` from
`scripts/sparoid.rb.template` and the release's `SHA256SUMS`. When it changed,
the formula is installed and tested on macOS and Linux for both architectures,
then committed to `main`. The executables stay on sparoid.rb's release; the tap
publishes no release of its own.

Validate the scripts with:

```sh
node --test scripts/*.test.mjs
actionlint .github/workflows/*.yml
```
