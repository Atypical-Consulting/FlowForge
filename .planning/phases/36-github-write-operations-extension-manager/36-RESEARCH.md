# Phase 36: GitHub Write Operations & Extension Manager - Research

**Researched:** 2026-02-10
**Domain:** GitHub API write operations, extension lifecycle management, UX patterns, Tauri/Rust/React implementation
**Confidence:** HIGH
**Method:** 3-specialist parallel research (UX, Architecture, Implementation)

## Summary

Phase 36 adds two capability sets: (1) GitHub write operations (merge PR with strategy selection, create PR from current branch) and (2) extension manager UI (install from GitHub URL, enable/disable, uninstall, permission review). All three specialist researchers converge on the same conclusion: **no new dependencies needed, all patterns extend existing codebase conventions**.

The Rust `client.rs` needs `github_post` and `github_put` helpers mirroring `github_get`. Each write operation is a dedicated Tauri command. The frontend uses TanStack Query `useMutation` for write lifecycles with `onSuccess` cache invalidation. The Extension Manager is a core blade (not extension-registered) that extends `ExtensionHost` with install/uninstall/enable/disable operations. Extension install follows a two-phase flow: clone+validate (Rust) → user reviews manifest → confirm install.

**Primary recommendation:** Follow Phase 35 patterns exactly. Add POST/PUT to client.rs, create merge/create-pr commands, build `useMutation` hooks, extend ExtensionHost for management operations, register Extension Manager as a core blade.

## Standard Stack

### Core (no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| reqwest | 0.13 (existing) | HTTP POST/PUT for GitHub write operations | Already handles GET; json feature enabled |
| serde/serde_json | 1.x (existing) | Serialize request bodies, deserialize responses | Already in Cargo.toml |
| git2 | 0.20 (existing) | Branch info, commit messages for PR pre-fill | Already used for all local git ops |
| tauri-specta | 2.0.0-rc.21 (existing) | Type-safe IPC for new commands | Already generates bindings.ts |
| @tanstack/react-query | ^5 (existing) | `useMutation` for write ops, cache invalidation | Already used for read queries |
| zustand | ^5 (existing) | Extension manager state, form state | Already used for all stores |
| @tauri-apps/plugin-store | ^2 (existing) | Persist extension enable/disable state | Already used via getStore() |

### No New Dependencies Needed
All 3 researchers confirmed: zero new npm or Cargo dependencies required.

## Architecture Patterns

### Project Structure (Changes Only)

```
src-tauri/src/
  github/
    client.rs         # ADD: github_post(), github_put() helpers
    error.rs          # ADD: MergeConflict, ValidationFailed, MethodNotAllowed variants
    types.rs          # ADD: MergePrRequest, CreatePrRequest, MergeResult, CreatePrResponse, BranchCommits
    pulls.rs          # ADD: github_merge_pull_request, github_create_pull_request commands
    branch_info.rs    # NEW: get_branch_commits (for PR body pre-fill)
  extensions/
    install.rs        # NEW: install_extension, uninstall_extension, validate_manifest_from_url
    mod.rs            # ADD: pub mod install

src/
  extensions/
    ExtensionHost.ts     # ADD: installFromUrl, uninstall, enable, disable, persistState
    extensionTypes.ts    # ADD: source field, enabledState on ExtensionInfo
  extensions/github/
    hooks/
      useGitHubMutation.ts  # NEW: useMergePr, useCreatePr mutations
    blades/
      CreatePullRequestBlade.tsx  # NEW: PR creation form blade
      ExtensionManagerBlade.tsx   # NEW: extension list + install
    components/
      MergeStrategySelector.tsx   # NEW: radio group for merge strategy
      MergeConfirmDialog.tsx      # NEW: confirmation dialog before merge
      ToggleSwitch.tsx            # NEW: reusable toggle for extension enable/disable
      PermissionBadge.tsx         # NEW: colored badges for extension permissions
    index.ts             # MODIFY: register new blades + commands
  stores/bladeTypes.ts   # ADD: "extension-manager" to BladePropsMap (core blade)
  blades/extension-manager/  # NEW: core blade registration + component
```

### Pattern 1: HTTP Client Extension (Rust)
Add `github_post` and `github_put` to `client.rs` mirroring the existing `github_get` pattern. Single point of authentication, consistent error handling, consistent headers.

### Pattern 2: TanStack Query useMutation (Frontend)
Write operations use `useMutation` with explicit `onSuccess` cache invalidation. Pessimistic UI for destructive operations (merge), optimistic for additive (enable/disable toggle).

### Pattern 3: Two-Phase Extension Install
1. **Phase A (Rust):** Clone from URL → validate manifest → return manifest to frontend for review
2. **Phase B (Frontend):** Display permissions + contributions → user confirms → Rust copies to extensions dir → ExtensionHost discovers + activates

### Pattern 4: Extension Manager as Core Blade
Register `"extension-manager"` in `BladePropsMap` (core, not extension). It manages all extensions so must work even when extensions fail. Accessible from command palette + toolbar (Puzzle icon, `app` group).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog animations | Custom overlay | Existing `Dialog`/`DialogContent`/`DialogFooter` | Focus trap, Escape, backdrop, framer-motion |
| Loading button | Manual spinner | `Button` with `loading`/`loadingText` | Already handles spinner + disabled + text swap |
| Error notifications | Custom alert | `toast.error()` from stores/toast.ts | Project-wide system |
| Form validation | Framework | React controlled components + inline validation | Matches CloneForm pattern |
| Cache invalidation | Manual refetch | TanStack Query `invalidateQueries` | Handles stale data + background refetch |
| HTTP auth | Manual token | `client::github_post/github_put` | Token in Rust/keychain, consistent headers |
| Markdown preview | Custom renderer | `MarkdownRenderer` (existing) | GFM, code highlighting |

## Common Pitfalls

### Pitfall 1: Stale PR Data After Merge
**What:** User sees "Open" after merging. **Why:** TanStack Query cache stale. **Fix:** In mutation `onSuccess`, invalidate BOTH PR detail and PR list query keys. Consider `setQueryData` for optimistic update after server confirms.

### Pitfall 2: specta BigInt Panic for u64 Fields
**What:** specta panics with `BigIntForbidden`. **Why:** JS Number can't safely represent u64. **Fix:** Use `String` for IDs in IPC types. Already fixed in Phase 35 for `CommentInfo.id`.

### Pitfall 3: Branch Not Pushed Before PR Creation
**What:** 422 error "branch not found". **Why:** Local branch has no remote tracking branch. **Fix:** Check if branch is pushed to remote before showing Create PR form. Prompt user to push first.

### Pitfall 4: Merge Strategy Not Available
**What:** 405 when selecting "Rebase" but repo only allows "Squash". **Why:** Repo settings restrict merge methods. **Fix:** Handle 405 gracefully with clear message. Optionally detect from error response.

### Pitfall 5: Extension Clone Leaves Temp Dirs on Failure
**What:** Temp directories accumulate. **Fix:** Use temp dir that auto-cleans, or explicit cleanup on error path.

### Pitfall 6: Lost Form State on Accidental Navigation
**What:** User loses PR description after back navigation. **Fix:** Use existing `useBladeFormGuard` hook (already used by ConventionalCommitBlade).

### Pitfall 7: Built-In Extension Uninstall Attempted
**What:** User tries to uninstall GitHub built-in extension. **Fix:** Don't show Uninstall button for `builtIn === true` extensions. Show "Built-in" badge instead.

### Pitfall 8: lib.rs Command Registration Forgotten
**What:** New command written but not in `collect_commands![]`. **Fix:** After any new command: (1) add `pub use` in mod.rs, (2) add to `use` block in lib.rs, (3) add to `collect_commands![]`, (4) rebuild.

## Key UX Decisions (from UX Research)

1. **Merge Strategy:** Radio group in dialog (not split button). Green merge button, Cancel focused first.
2. **PR Creation:** New blade (not dialog). Title pre-filled from branch name, body from commit messages. Draft toggle.
3. **Extension Manager:** Core blade with sections: Install URL input at top, Installed section, Built-in section.
4. **Extension Install Flow:** Multi-step: enter URL → loading → manifest review (permissions, contributions) → confirm.
5. **Merge button placement:** In PR detail blade trailing section. Click opens confirmation dialog.
6. **Create PR entry:** Toolbar button (views group) + command palette. Visible when auth + remote + not default branch.
7. **Extension Manager entry:** Toolbar button (app group, Puzzle icon) + command palette + settings link.

## Key Architecture Decisions (from Architecture Research)

1. **Write operations:** Pessimistic UI with `useMutation` (server confirms before UI updates)
2. **Extension state persistence:** `tauri-plugin-store` (survives app updates)
3. **Extension install:** git2 clone for public repos; shell git for future private repo support
4. **Uninstall orchestration:** Frontend orchestrates: deactivate (JS) → delete files (Rust) → remove from store (JS)
5. **Error handling:** Add `MergeNotAllowed`, `HeadChanged`, `ValidationFailed` to GitHubError enum
6. **Cache invalidation:** After merge/create, invalidate both list and detail query keys

## Open Questions

1. **git2 shallow clone reliability** — Implement with depth(1), fallback to full clone on failure
2. **Extension permissions enforcement** — Display-only for Phase 36; runtime enforcement deferred to EXT-F02
3. **Branch protection pre-check** — Handle error gracefully rather than pre-checking (reduces API calls)
4. **Merge strategy persistence** — Store per-repo in existing settings mechanism
5. **PR templates** — Defer to future phase; commit messages as body is sufficient for v1.5

## Detailed Research Files

Three specialist research files are available for deep-dive reference:
- `36-RESEARCH-UX.md` — UX patterns, wireframes, accessibility, competitive analysis
- `36-RESEARCH-ARCHITECTURE.md` — Data flow, state management, extensibility analysis
- `36-RESEARCH-IMPLEMENTATION.md` — Code patterns, API contracts, Tauri/Rust/React specifics

## Sources

### Primary (HIGH confidence)
- FlowForge codebase direct inspection (client.rs, pulls.rs, issues.rs, types.rs, error.rs, ExtensionHost.ts, ExtensionAPI.ts, dialog.tsx, button.tsx, ConventionalCommitBlade, PullRequestDetailBlade)
- GitHub REST API official docs (merge PR: PUT /repos/{owner}/{repo}/pulls/{number}/merge, create PR: POST /repos/{owner}/{repo}/pulls)
- TanStack Query v5 docs via Context7 (useMutation, invalidateQueries, optimistic updates)

### Secondary (MEDIUM confidence)
- GitHub.com, GitHub Desktop, GitKraken, VS Code merge/PR UX patterns
- VS Code Extension Marketplace UX patterns
- NN/g confirmation dialog best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Zero new dependencies; all patterns from existing code
- Write operation architecture: HIGH — Verified from GitHub API docs + TanStack Query docs + existing codebase patterns
- Extension manager architecture: HIGH — ExtensionHost already has the right shape; additions are state transitions
- UX patterns: HIGH — Strong consensus across GitHub.com, Desktop, GitKraken, VS Code
- Implementation patterns: HIGH — All patterns derived from existing codebase

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable patterns)
