# dentarg's Homebrew tap

| Formula | What |
|---|---|
| `heroku` | the Heroku CLI with dentarg's local fixes (this README up to [Spinel](#spinel)) |
| `spinel` | [Spinel](https://github.com/matz/spinel), the Ruby AOT compiler, a daily snapshot of `master` |

Heroku CLI builds from the `local-fixes` branch of
[dentarg/heroku-cli](https://github.com/dentarg/heroku-cli), rebased on upstream
`main`. Each release contains a committed snapshot, compiled JavaScript, and
locked npm dependencies. Rebasing the source branch does not change existing
release archives.

## Install

After the repository and first release are published:

```sh
brew install dentarg/tap/heroku
```

Homebrew installs Node.js and the CLI's runtime dependencies. Installation needs
access to GitHub and the npm registry. The same release package works on macOS
and Linux; dependencies are installed for the target machine.

If `heroku/brew/heroku` is already installed, uninstall that formula first:

```sh
brew uninstall heroku/brew/heroku
brew install dentarg/tap/heroku
```

Use `command -v heroku` to check that a previous npm installation is not taking
precedence over Homebrew. This tap uses the same Heroku login and plugin data as
the upstream CLI.

To prevent changes to your global Git credential helper, add this to your shell
configuration:

```sh
export HEROKU_DISABLE_GIT_CONFIG=1
```

The wrapper disables npm update notices and the CLI's background self-updater,
so upstream releases cannot replace this build. `heroku update` points back to
Homebrew. Update with:

```sh
brew update
brew upgrade dentarg/tap/heroku
```

## Publish with GitHub Actions

Create the public repository `dentarg/homebrew-tap` on GitHub without an initial
README, license, or Gitignore. This directory is already initialized with a
`main` branch and the appropriate `origin` remote. Commit changes and push:

```sh
git push -u origin main
```

Push the CLI's `local-fixes` branch to `dentarg/heroku-cli` as well. The CLI
repository must be public for the workflow's default cross-repository checkout.
Keep the tap public so Homebrew can download releases without authentication.
Enable GitHub Actions in the tap. The publishing job requests
`contents: write` on its built-in `GITHUB_TOKEN`; repository rules must allow it
to push release tags and update `main`. No personal access token is needed.

Open **Actions → Release Heroku → Run workflow** on the tap's `main` branch.
Leave `source_ref` as `local-fixes`, or enter a specific CLI commit or tag.
You can also dispatch it with the GitHub CLI:

```sh
gh workflow run release.yml --repo dentarg/homebrew-tap --ref main \
  -f source_ref=local-fixes
```

The workflow automatically:

1. Checks out the requested CLI snapshot and selects the next unused tap
   revision for its upstream version.
2. Builds with `npm ci`, packages the compiled CLI and dependency lock, and
   generates the formula and checksum.
3. Installs the exact archive with Homebrew on macOS and Linux, then runs the
   formula's functional test, strict audit, and style checks.
4. Commits the formula, pushes an immutable release tag, and uploads the archive,
   checksum, and source metadata to a GitHub release.
5. Publishes the release before pushing the formula to `main`, so the download
   is available when users see the update.

Release runs are serialized. Builds and tests have read-only repository access;
only the publishing job can write. Existing tags and draft releases reserve
their revision, so a new workflow run never replaces their assets. If publication
fails after creating a tag or draft, start a new run to use the next revision.
Do not rerun just the failed publishing job after it has pushed a tag.

The first release of CLI `11.11.0` is `v11.11.0-1`, followed by `v11.11.0-2`,
and so on. A new upstream version starts at revision `1`. Homebrew detects these
upgrades even when `heroku --version` still prints the same upstream version.

The workflow runs only when dispatched; pushing or rebasing `local-fixes` alone
does not publish a release. The prepared local archive is not uploaded by the
workflow: Actions builds its own archive from the selected committed source.

## Rebase and publish subsequent fixes

In the CLI repository, with a clean working tree:

```sh
git fetch upstream
git switch local-fixes
git rebase upstream/main
```

Resolve any conflicts and run the CLI's relevant tests, then publish the rebased
branch with `git push --force-with-lease origin local-fixes`. Dispatch **Release
Heroku** again. Other computers can then run
`brew update && brew upgrade dentarg/tap/heroku`. Never rewrite the tap's
published release tags.

## Prepare a release locally

Requirements: Git, tar, Node.js 22 or newer, and npm. From this tap, run:

```sh
node scripts/prepare-release.mjs /repos/src/heroku-cli 1
```

The final argument is the tap revision. The script builds committed `HEAD` in a
temporary directory, leaves the CLI checkout alone, and writes the formula plus
an archive, checksum, metadata, and notes under `releases/vVERSION-REVISION/`.
The `releases/` directory is ignored by Git. The script refuses to overwrite an
existing local release directory.

Edit `scripts/heroku.rb.template` to change the formula, commit the template,
and dispatch a release to regenerate `Formula/heroku.rb` automatically.

## Validation

```sh
node --check scripts/prepare-release.mjs
node --test scripts/release-plan.test.mjs
actionlint .github/workflows/release.yml
brew style Formula/heroku.rb
node scripts/test-formula.mjs v11.11.0-1
```

The formula test checks the version, command discovery, and preservation of an
existing Git configuration with the opt-out enabled. The test script installs
from the local archive before its public URL exists, runs the Homebrew checks,
then restores the formula and uninstalls the test copy. Run it in an environment
without an existing Heroku installation. Homebrew and the local release archive
are required; publishing to GitHub is not.

Formula layout and npm installation follow Homebrew's
[tap documentation](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap) and
[Node.js formula guidance](https://docs.brew.sh/Language-Specific-Formulae#nodejs).

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

Validate the scripts with:

```sh
node --test scripts/spinel-version.test.mjs
actionlint .github/workflows/release-spinel.yml
```
