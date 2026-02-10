---
phase: 38-content-viewer-extraction
verified: 2026-02-10T20:55:12Z
status: gaps_found
score: 4/6 must-haves verified
gaps:
  - truth: "Disabling the content-viewers extension causes file previews to fall back to viewer-plaintext (plain text display)"
    status: failed
    reason: "RepoBrowserBlade.tsx openFile() does not use the dispatched blade type from bladeTypeForFile(). The else branch (line 79-81) hardcodes 'viewer-code' regardless of what fileDispatch returns. When the extension is disabled, source files still push viewer-code (unregistered) and show the Puzzle icon fallback instead of viewer-plaintext."
    artifacts:
      - path: "src/blades/repo-browser/RepoBrowserBlade.tsx"
        issue: "Lines 60-82: openFile() ignores dispatched type in else branch, hardcodes viewer-code. For .md/.gltf/.glb files, the specific if-branches also push the content-viewer type names directly without checking registration."
      - path: "src/lib/fileDispatch.ts"
        issue: "Browse fallback returns viewer-plaintext (correct), but RepoBrowserBlade never uses this value for the else case."
    missing:
      - "RepoBrowserBlade.openFile() should use the dispatched bladeType variable in the else branch instead of hardcoding viewer-code"
      - "For all file types, RepoBrowserBlade should check if the dispatched blade type is registered and fall back to viewer-plaintext when it is not"
  - truth: "Re-enabling the content-viewers extension restores all three rich viewers"
    status: partial
    reason: "The extension activation re-registers blade types correctly (verified in tests). However, already-open blades showing the Puzzle fallback would not automatically re-render because BladeRenderer does not subscribe to registry changes. The user would need to navigate away and re-open the file."
    artifacts:
      - path: "src/blades/_shared/BladeRenderer.tsx"
        issue: "BladeRenderer reads getBladeRegistration() synchronously on render, but does not subscribe to registry changes. Already-rendered Puzzle fallbacks will not update when the extension is re-enabled."
    missing:
      - "BladeRenderer would need to subscribe to blade registry changes (or the blade stack would need to re-render when extensions change) for already-open blades to restore without user interaction"
---

# Phase 38: Content Viewer Extraction Verification Report

**Phase Goal:** Markdown, code, and 3D viewers run as a single toggleable built-in extension, with graceful fallback when disabled
**Verified:** 2026-02-10T20:55:12Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening a .md file in the repo browser launches the markdown preview blade provided by the content-viewers extension | VERIFIED | `fileDispatch.ts:21-22` maps md/mdx to `viewer-markdown`; `RepoBrowserBlade.tsx:72-73` pushes `viewer-markdown`; `content-viewers/index.ts:24-31` registers `viewer-markdown` with coreOverride and React.lazy import of ViewerMarkdownBlade |
| 2 | Opening a source file in the repo browser launches the Monaco code viewer blade provided by the content-viewers extension | VERIFIED | `RepoBrowserBlade.tsx:79-81` else branch pushes `viewer-code`; `content-viewers/index.ts:33-39` registers `viewer-code` with coreOverride and React.lazy import of ViewerCodeBlade |
| 3 | Opening a .gltf/.glb file in the repo browser launches the 3D model viewer blade provided by the content-viewers extension | VERIFIED | `fileDispatch.ts:25-26` maps glb/gltf to `viewer-3d`; `RepoBrowserBlade.tsx:74-75` pushes `viewer-3d`; `content-viewers/index.ts:42-49` registers `viewer-3d` with coreOverride and React.lazy import of Viewer3dBlade |
| 4 | Disabling the content-viewers extension causes file previews to fall back to viewer-plaintext (plain text display) | FAILED | `RepoBrowserBlade.tsx:60-82` does not use dispatched type from `bladeTypeForFile()` for the else branch. When extension disabled: source files still push `viewer-code` (hardcoded), .md files still push `viewer-markdown`, .gltf/.glb still push `viewer-3d` -- all unregistered -> shows Puzzle fallback, NOT viewer-plaintext |
| 5 | Already-open viewer blades show a helpful fallback message (not red error text) when the extension is disabled | VERIFIED | `BladeRenderer.tsx:17-32` shows Puzzle icon + "This content requires an extension that is currently disabled" + "Open Extension Manager" link when `getBladeRegistration()` returns undefined. No red text. |
| 6 | Re-enabling the content-viewers extension restores all three rich viewers | PARTIAL | Extension re-activation re-registers blade types (verified by `content-viewers.test.ts`). However, already-open blades showing Puzzle fallback would not auto-update because BladeRenderer does not subscribe to registry changes. New file opens would work correctly. |

**Score:** 4/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/extensions/ExtensionAPI.ts` | coreOverride option in ExtensionBladeConfig | VERIFIED | Lines 42-46: `coreOverride?: boolean` with JSDoc; Lines 146-148: conditional namespacing |
| `src/blades/viewer-plaintext/ViewerPlaintextBlade.tsx` | Plain text fallback viewer component | VERIFIED | 43 lines, renders pre with monospaced text, handles loading/error/binary states via useRepoFile hook |
| `src/blades/viewer-plaintext/registration.ts` | Core blade registration for viewer-plaintext | VERIFIED | Registers via registerBlade with React.lazy, type "viewer-plaintext" |
| `src/lib/fileDispatch.ts` | Browse fallback returns viewer-plaintext | VERIFIED | Line 65: `return "viewer-plaintext"` for browse context |
| `src/stores/bladeTypes.ts` | viewer-plaintext in BladePropsMap | VERIFIED | Line 24: `"viewer-plaintext": { filePath: string }` |
| `src/extensions/content-viewers/index.ts` | Content viewers extension entry point | VERIFIED | Exports onActivate/onDeactivate; registers 3 viewer blades with coreOverride:true and React.lazy |
| `src/blades/_shared/BladeRenderer.tsx` | Graceful fallback for unregistered extension blades | VERIFIED | Lines 17-32: Puzzle icon + "extension that is currently disabled" message + Open Extension Manager button |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ExtensionAPI.ts` | `bladeRegistry.ts` | registerBlade with coreOverride | WIRED | Line 146-148: conditional type name, line 149-153: calls registerBlade |
| `ViewerPlaintextBlade.tsx` | `useRepoFile.ts` | useRepoFile hook | WIRED | Line 12: `const { data, isLoading, error, refetch } = useRepoFile(filePath)` |
| `fileDispatch.ts` | `bladeTypes.ts` | viewer-plaintext type | WIRED | Line 65 returns "viewer-plaintext"; BladePropsMap line 24 declares it |
| `content-viewers/index.ts` | `ViewerMarkdownBlade.tsx` | React.lazy import | WIRED | Lines 7-10: dynamic import |
| `content-viewers/index.ts` | `ViewerCodeBlade.tsx` | React.lazy import | WIRED | Lines 12-15: dynamic import |
| `content-viewers/index.ts` | `Viewer3dBlade.tsx` | React.lazy import | WIRED | Lines 17-20: dynamic import |
| `App.tsx` | `content-viewers/index.ts` | registerBuiltIn | WIRED | Lines 60-66: registerBuiltIn with id "content-viewers" before GitHub extension |
| `content-viewers/index.ts` | `ExtensionAPI.ts` | coreOverride: true | WIRED | Lines 29, 38, 47: all three registerBlade calls include coreOverride: true |
| `fileDispatch.ts` -> `RepoBrowserBlade.tsx` | Browse fallback used | bladeTypeForFile result | NOT_WIRED | RepoBrowserBlade calls bladeTypeForFile (line 67) but else branch (line 79-81) ignores the result and hardcodes "viewer-code" |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/blades/repo-browser/RepoBrowserBlade.tsx` | 79 | Comment says "viewer-code is the default for browse context" but this is stale -- fileDispatch now returns viewer-plaintext | Warning | Misleading comment, indicates the code wasn't updated to match the new dispatch behavior |
| `src/blades/repo-browser/RepoBrowserBlade.tsx` | 60-82 | Hardcoded blade type dispatch chain instead of using the dispatched type variable | Warning | Duplicates and contradicts the fileDispatch logic; prevents graceful degradation for source files |

### Human Verification Required

### 1. Visual Quality of Puzzle Fallback
**Test:** Disable content-viewers extension in Extension Manager, then open any file in repo browser
**Expected:** Puzzle icon centered, muted text "This content requires an extension that is currently disabled", clickable "Open Extension Manager" link below
**Why human:** Visual layout, icon rendering, and link styling need visual inspection

### 2. Extension Toggle Lifecycle
**Test:** Open a .md file (renders markdown preview), then disable content-viewers, then re-enable
**Expected:** After disable: blade shows Puzzle fallback. After re-enable: newly opened .md files render markdown preview again
**Why human:** Real-time state transitions and UI update timing can't be verified via grep

### 3. Viewer-plaintext Content Display
**Test:** Open a .txt or unknown file type in repo browser when content-viewers is enabled
**Expected:** The else branch currently shows viewer-code. When extension is disabled, the Puzzle fallback appears (not viewer-plaintext).
**Why human:** This verifies the gap -- the fallback chain doesn't work as designed

### Gaps Summary

**Gap 1: RepoBrowserBlade does not use fileDispatch result for fallback.** The core issue is that `RepoBrowserBlade.tsx:openFile()` has a hardcoded if/else chain that duplicates the fileDispatch logic but with a crucial difference: the else branch always pushes `"viewer-code"` instead of using the dispatched type. This means the `fileDispatch.ts` change from `"viewer-code"` to `"viewer-plaintext"` for browse fallback is dead code -- it has no effect on actual file opening behavior. When the content-viewers extension is disabled, ALL file types show the Puzzle icon fallback instead of falling back to viewer-plaintext for plain text display.

The fix would be to refactor `RepoBrowserBlade.openFile()` to use the dispatched blade type directly: `pushBlade({ type: bladeType, title, props: { filePath: entry.path } })`. Or better, implement a fallback check: if the dispatched type is not registered, fall back to `"viewer-plaintext"`.

**Gap 2: Already-open blades don't auto-restore on re-enable.** BladeRenderer reads the blade registry synchronously on render but does not subscribe to registry changes. When the extension is re-enabled and blade types are re-registered, already-rendered Puzzle fallbacks would not know to re-render. This is a minor UX gap -- the user can close and re-open the file.

---

_Verified: 2026-02-10T20:55:12Z_
_Verifier: Claude (gsd-verifier)_
