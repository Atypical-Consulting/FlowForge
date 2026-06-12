# Releasing FlowForge

This document describes how to cut a release and, in particular, how to set up
**macOS code signing + notarization** so downloaded builds are not flagged by
Gatekeeper as *"FlowForge.app is damaged and can't be opened."*

## How releases work

- Releases are built by [`.github/workflows/release.yml`](.github/workflows/release.yml),
  triggered when a tag matching `v*` is pushed.
- The workflow builds installers for **macOS (Apple Silicon)**, **Windows**, and
  **Linux** via [`tauri-action`](https://github.com/tauri-apps/tauri-action) and
  publishes a GitHub Release with the binaries attached.
- Releases build from `main`, so changes to `release.yml` (and the version bump)
  must be merged into `main` **before** tagging.

### Cutting a release

```bash
# 1. Make sure main has the changes you want to release (merge dev -> main).
# 2. Bump the version in all manifests to e.g. 1.9.1:
#    - package.json, package-lock.json
#    - src-tauri/Cargo.toml, Cargo.lock (flowforge package)
#    - src-tauri/tauri.conf.json
# 3. Commit the bump, then tag and push:
git tag -a v1.9.1 -m "FlowForge v1.9.1"
git push origin v1.9.1
```

Pushing the tag triggers the release workflow.

---

## macOS code signing & notarization

Without signing, macOS quarantines downloaded builds and shows the misleading
*"damaged and can't be opened"* dialog. The fix is to sign the app with an
**Apple Developer ID Application** certificate and have Apple **notarize** it.

`release.yml` already passes the required environment variables to `tauri-action`.
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

Merge `dev` → `main`, then tag a new version (e.g. `v1.9.1`) as described above.
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
workaround note (the `xattr -cr` block) from `release.yml`.

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
