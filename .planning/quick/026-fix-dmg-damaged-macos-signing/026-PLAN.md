---
phase: quick
plan: 026
type: execute
---

# Quick Task 026: Fix DMG "damaged" error on macOS

## Tasks

### Task 1: Add Apple signing env vars to release workflow
- Add APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID
- Signing activates when secrets are configured in GitHub

### Task 2: Add Gatekeeper workaround to release notes
- Add `xattr -cr` instruction for unsigned builds

### Task 3: Delete and recreate v1.1.0 tag
- Delete GitHub release, delete tag, recreate, push to trigger new CI
