# Releasing FlowForge

This document describes how to cut a release and, in particular, how to set up
**macOS code signing + notarization** so downloaded builds are not flagged by
Gatekeeper as *"FlowForge.app is damaged and can't be opened."*

## How releases work

Releases are automated by [release-please](https://github.com/googleapis/release-please)
through [`.github/workflows/release-please.yml`](.github/workflows/release-please.yml):

- Every push to `main` runs release-please, which derives the next semantic version from the
  [Conventional Commits](https://www.conventionalcommits.org/) since the last tag and keeps a
  **release PR** (`chore(main): release X.Y.Z`) up to date. That PR bumps the version in
  `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
  (see [`release-please-config.json`](release-please-config.json)) and prepends the new section
  to `CHANGELOG.md`.
- Merging the release PR tags `vX.Y.Z` and creates the GitHub Release. In the same workflow run
  the `build` matrix then builds the installers for **macOS (Apple Silicon)**, **Windows** and
  **Linux (x86_64 and arm64)** with [`tauri-action`](https://github.com/tauri-apps/tauri-action)
  and attaches them to that release.
- PRs are squash-merged, so the **PR title** is the commit release-please reads: `fix:` bumps the
  patch version, `feat:` the minor one, `feat!:` (or a `BREAKING CHANGE:` footer) the major one.
  `chore:`, `docs:`, `ci:`, … do not trigger a release on their own.

### Cutting a release

```bash
# 1. Merge dev -> main (release-please only watches main).
git switch main && git merge --ff-only dev && git push origin main
# 2. Wait for the "release-please" workflow to open/refresh the release PR against main,
#    review the CHANGELOG it proposes, then merge it. Nothing to bump or tag by hand.
```

Merging the release PR triggers the tag, the GitHub Release and the installer builds. If the
release PR is missing after a push (token or permission hiccup), re-run the workflow from the
Actions tab (`workflow_dispatch`) — it is idempotent.

> `Cargo.lock` is not rewritten by release-please (cargo strips its annotation), so the
> `flowforge` entry lags `Cargo.toml` by one version on the release commit. The build job
> refreshes it with `cargo update -p flowforge`; locally the next `cargo build` does the same.

---

## macOS code signing & notarization

Without signing, macOS quarantines downloaded builds and shows the misleading
*"damaged and can't be opened"* dialog. The fix is to sign the app with an
**Apple Developer ID Application** certificate and have Apple **notarize** it.

`release-please.yml` already passes the required environment variables to `tauri-action`.
When the GitHub secrets below are **absent**, builds are simply unsigned (current
behavior). When they are **present**, builds are automatically signed and notarized.

> **Important:** use a **"Developer ID Application"** certificate — *not* "Apple
> Development" (that is for local development only and will not work for
> distributing a downloadable app).

### Step 1 — Create the certificate (one time)

Either:

- **Xcode** → Settings → Accounts → *[your Apple ID]* → **Manage Certificates** →
  **+** → **Developer ID Application**, or
- [developer.apple.com](https://developer.apple.com/account/resources/certificates/list)
  → Certificates → **+** → **Developer ID Application** (follow the CSR steps).

### Step 2 — Export it as a `.p12`

Keychain Access → **login → My Certificates** → find
`Developer ID Application: <You> (TEAMID)` → right-click → **Export…** → save
`certificate.p12` and set an **export password** (you will need it below).

### Step 3 — Gather the seven values

```bash
base64 -i certificate.p12 | pbcopy          # APPLE_CERTIFICATE (now on the clipboard)
security find-identity -v -p codesigning    # copy "Developer ID Application: You (TEAMID)"
openssl rand -base64 24                      # KEYCHAIN_PASSWORD (any random string)
```

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | base64 of `certificate.p12` (from the command above) |
| `APPLE_CERTIFICATE_PASSWORD` | the export password set in Step 2 |
| `APPLE_SIGNING_IDENTITY` | the full `Developer ID Application: You (TEAMID)` string |
| `APPLE_TEAM_ID` | your 10-character Team ID (the part in parentheses, or developer.apple.com → Membership) |
| `APPLE_ID` | your Apple account email |
| `APPLE_PASSWORD` | an **app-specific password** — appleid.apple.com → Sign-In and Security → App-Specific Passwords |
| `KEYCHAIN_PASSWORD` | any random string (from the command above) |

### Step 4 — Add the secrets to GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**, or via the CLI:

```bash
base64 -i certificate.p12 | gh secret set APPLE_CERTIFICATE
gh secret set APPLE_CERTIFICATE_PASSWORD   # each of these prompts for the value
gh secret set APPLE_SIGNING_IDENTITY
gh secret set APPLE_TEAM_ID
gh secret set APPLE_ID
gh secret set APPLE_PASSWORD
gh secret set KEYCHAIN_PASSWORD
```

### Step 5 — Cut a signed release

Merge `dev` → `main`, then merge the release PR as described above.
The macOS build will now be signed and notarized; users can open it normally.

### Verifying a signed build

After downloading the new `.dmg`:

```bash
# Should report "accepted" / "Notarized Developer ID"
spctl -a -vvv /Applications/FlowForge.app
# Should show your Developer ID and "Authority=Apple ..."
codesign -dvvv /Applications/FlowForge.app
```

### Cleanup once signing is verified

Once a signed release is confirmed working, remove the now-inaccurate Gatekeeper
workaround note (the `xattr -cr` block) from the README and the docs.

---

## Temporary workaround for unsigned builds

Until a signed release is available, an unsigned `.app` can be opened by clearing
the quarantine attribute:

```bash
xattr -cr /Applications/FlowForge.app
```

## Notes & follow-ups

- **Notarization auth alternatives:** instead of `APPLE_ID` + `APPLE_PASSWORD` +
  `APPLE_TEAM_ID`, you may use an App Store Connect API key via `APPLE_API_ISSUER`,
  `APPLE_API_KEY`, and `APPLE_API_KEY_PATH`.
- **If notarization fails** on hardened-runtime entitlements, add a
  `bundle.macOS.entitlements` file in `tauri.conf.json` and re-run.
- **Intel / Universal macOS:** the matrix currently builds Apple Silicon only.
  Add an `x86_64-apple-darwin` matrix entry (or a universal target) to cover Intel Macs.
