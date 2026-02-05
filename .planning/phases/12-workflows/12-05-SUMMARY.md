# Summary: Amend Commit

## Plan
12-05-PLAN.md — Amend commit with message pre-fill and confirmation

## Status
Complete

## Deliverables

### Files Modified
- `src-tauri/src/git/commit.rs` — Added get_last_commit_message command and LastCommitMessage struct
- `src-tauri/src/lib.rs` — Registered get_last_commit_message command
- `src/components/commit/CommitForm.tsx` — Added amend pre-fill logic and confirmation dialogs
- `src/hooks/useKeyboardShortcuts.ts` — Added Ctrl+Shift+M toggle amend shortcut

### Commits
1. `b59aea3` — feat(12-05): amend commit with message pre-fill and confirmation

## Implementation Notes

### Backend: get_last_commit_message
Returns the HEAD commit message parsed into components:
- `subject` — First line of commit message
- `body` — Everything after first blank line (optional)
- `fullMessage` — Complete commit message

### Frontend: Amend Pre-fill Logic
When checking amend checkbox:
1. Fetches last commit message via `getLastCommitMessage()`
2. If message field is empty: auto-fills with previous message
3. If message field has content: prompts "Replace with previous commit message?"
4. User can choose to keep current or load previous

### Frontend: Amend Confirmation
Before executing amend commit:
- Shows confirmation dialog: "Amend will rewrite the last commit. This cannot be undone. Continue?"
- Only proceeds if user confirms

### Keyboard Shortcut
- `Ctrl+Shift+M` (Cmd+Shift+M on Mac) toggles amend checkbox
- Dispatches `toggle-amend` custom event
- CommitForm listens for event and calls `handleAmendChange`

## Verification
- `cargo check` passes
- `npm run build` passes
- LastCommitMessage type exported to TypeScript bindings
