# dentarg's Homebrew tap

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

## Prepare a release

Requirements: Git, tar, Node.js 22 or newer, and npm. To publish, install the
GitHub CLI (`gh`) and authenticate to GitHub.

Commit the desired CLI changes on `local-fixes`, then run from this tap:

```sh
node scripts/prepare-release.mjs /repos/src/heroku-cli 1
```

The final argument is the tap revision. Use `1` for the first build of an
upstream version, then `2`, `3`, and so on for additional local fixes. When the
upstream version increases, start again at `1`. Homebrew uses the upstream
version and formula revision to detect upgrades, even when `heroku --version`
still prints the same upstream version.

The script builds committed `HEAD` in a temporary directory using `npm ci`,
leaves the CLI checkout alone, and writes:

- `Formula/heroku.rb`: release URL, checksum, version, and revision.
- `releases/v11.11.0-1/heroku-11.11.0.tgz`: compiled npm package.
- `SHA256SUMS`, `release.json`, and `notes.md` in the same release directory.

The `releases/` directory is ignored by Git. Upload these files as GitHub release
assets; do not add them to the tap's Git history. The script refuses to replace
an existing local release directory. Never replace a published archive or reuse
its tag: publish a new revision instead.

Edit `scripts/heroku.rb.template` to change the formula, then prepare a new
release to regenerate `Formula/heroku.rb`.

## Publish the first release

Create the public repository `dentarg/homebrew-tap` on GitHub without an initial
README, license, or Gitignore. This directory is already initialized with a
`main` branch, an initial commit, and the appropriate `origin` remote.

```sh
git push -u origin main

gh release create v11.11.0-1 \
  releases/v11.11.0-1/heroku-11.11.0.tgz \
  releases/v11.11.0-1/SHA256SUMS \
  releases/v11.11.0-1/release.json \
  --repo dentarg/homebrew-tap \
  --target main \
  --title "Heroku 11.11.0, dentarg revision 1" \
  --notes-file releases/v11.11.0-1/notes.md

brew install dentarg/tap/heroku
brew test dentarg/tap/heroku
```

The formula's download URL becomes usable once the release is published.

## Rebase and publish subsequent fixes

In the CLI repository, with a clean working tree:

```sh
git fetch upstream
git switch local-fixes
git rebase upstream/main
```

Resolve any conflicts and run the CLI's relevant tests before packaging. If you
publish the rebased source branch, use `git push --force-with-lease origin
local-fixes`; never rewrite the tap's published release tags.

Run `prepare-release.mjs` with the next revision, review and commit the generated
formula, and push the tap's `main`. Create a new GitHub release using the commands
above with the new version and revision. Other computers can then run
`brew update && brew upgrade dentarg/tap/heroku`.

## Validation

```sh
node --check scripts/prepare-release.mjs
brew style Formula/heroku.rb
brew audit --strict dentarg/tap/heroku
brew test dentarg/tap/heroku
```

The formula test checks the version, command discovery, and preservation of an
existing Git configuration with the opt-out enabled. Auditing and testing the
installed formula require the tap and release to be available locally or on
GitHub.

Formula layout and npm installation follow Homebrew's
[tap documentation](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap) and
[Node.js formula guidance](https://docs.brew.sh/Language-Specific-Formulae#nodejs).
