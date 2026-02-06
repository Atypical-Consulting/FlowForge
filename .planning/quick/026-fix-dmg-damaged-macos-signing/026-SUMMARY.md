# Quick Task 026: Fix DMG "damaged" error on macOS

## Result: COMPLETE

**Commit:** 2b46b07

## Problem

macOS shows "FlowForge.app is damaged and can't be opened" when opening the DMG from the GitHub release. This is macOS Gatekeeper blocking unsigned/unnotarized apps — not related to the TAURI_CHANNEL fix.

## Root Cause

The release workflow had no Apple code signing or notarization configured. Without signing, macOS Gatekeeper quarantines the app and shows the "damaged" error.

## Fix

1. **Added Apple signing env vars** to `tauri-action` step in `.github/workflows/release.yml`:
   - `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`
   - `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
   - These activate automatically when the corresponding GitHub secrets are configured

2. **Added workaround** in release notes for unsigned builds:
   ```
   xattr -cr /Applications/FlowForge.app
   ```

3. **Redeployed:** Deleted GitHub release + tag, recreated tag on fixed commit, pushed to trigger new CI

## Next Steps

To enable proper code signing, add these GitHub secrets:
- `APPLE_CERTIFICATE` — Base64-encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD` — Certificate password
- `APPLE_SIGNING_IDENTITY` — e.g. "Developer ID Application: Your Name (TEAM_ID)"
- `APPLE_ID` — Apple Developer account email
- `APPLE_PASSWORD` — App-specific password
- `APPLE_TEAM_ID` — 10-char team ID
