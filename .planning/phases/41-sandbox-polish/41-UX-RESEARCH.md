# Phase 41: Sandbox & Polish - UX Research

**Researched:** 2026-02-10
**Domain:** Extension UX, Trust Visualization, Sandbox Error Handling, Deprecation Impact
**Confidence:** HIGH (codebase analysis) / MEDIUM (external UX patterns)

## Summary

Phase 41 introduces trust-level distinctions, a Worker-based sandbox prototype, API classification, and deprecation cleanup. From a UX perspective, the key challenge is communicating security and trust concepts to users without creating friction or confusion. The extension system already has solid foundations -- an Extension Manager blade with toggle switches, permission badges, built-in/installed sections, error states, and toast notifications. The phase needs to layer trust indicators onto this existing UI, prepare error handling for sandboxed extension failures, and ensure the 92-import deprecation cleanup is invisible to end users.

**Primary recommendation:** Use the existing `PermissionBadge` visual pattern (colored pill badges) to add trust-level indicators in the Extension Manager. Keep trust UX unobtrusive for built-in extensions (subtle "Verified" badge) and progressively more prominent for external/untrusted extensions (warning colors, permission review). Do NOT add consent dialogs or blocking modals in v1.6.0 -- this is infrastructure-only.

## Trust Level Visual Design

### Current State in Codebase (HIGH confidence)

The Extension Manager already distinguishes built-in from installed extensions:
- **ExtensionCard** (`src/blades/extension-manager/components/ExtensionCard.tsx`) shows a "Built-in" pill badge (10px, rounded-full, `bg-ctp-surface1 text-ctp-subtext0`)
- **ExtensionManagerBlade** separates extensions into "Built-in" and "Installed" sections
- **PermissionBadge** (`src/extensions/github/components/PermissionBadge.tsx`) uses color-coded pills: blue for `network`, yellow for `filesystem`, green for `git-operations`
- **ExtensionInfo** has a `builtIn?: boolean` flag but no trust-level field
- The Rust `ExtensionManifest` struct has no trust field -- only `permissions: Option<Vec<String>>`

### Industry Patterns (MEDIUM confidence)

**VS Code** (source: [Extension Runtime Security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security)):
- Uses a "Verified Publisher" blue checkmark badge next to publisher name
- Shows trust consent dialog on first install of third-party extensions (since v1.97)
- Workspace Trust mode restricts what extensions can do in untrusted folders
- Trust is binary: trusted or restricted (no gradient)

**JetBrains** (source: [Understanding Plugin Security](https://plugins.jetbrains.com/docs/marketplace/understanding-plugin-security.html)):
- "Verified Vendor" badge confirms identity but not quality
- No runtime sandbox -- plugins have full access
- Project-level trust dialog: "Trust Project" vs "Preview in Safe Mode"

### Recommended Trust Level Design

**Three-tier trust model for FlowForge:**

| Level | Label | Badge Color | Icon | Meaning |
|-------|-------|-------------|------|---------|
| `built-in` | "Built-in" | `bg-ctp-surface1 text-ctp-subtext0` (existing) | Shield with check | Bundled with app, full trust |
| `trusted` | "Trusted" | `bg-ctp-green/15 text-ctp-green` | Shield | Installed, user-approved, not sandboxed |
| `sandboxed` | "Sandboxed" | `bg-ctp-yellow/15 text-ctp-yellow` | Box/Container | Runs in Worker isolation |

**Visual hierarchy (existing patterns to extend):**
- The existing "Built-in" badge on ExtensionCard already uses the right pattern -- a small, rounded pill
- Add a `TrustBadge` component following the same `PermissionBadge` pattern: `text-[10px] px-1.5 py-0.5 rounded-full font-medium`
- Use Lucide icons: `ShieldCheck` (built-in), `Shield` (trusted), `Box` (sandboxed)
- Position trust badge immediately after the extension name, before the version number

**What NOT to do in v1.6.0:**
- Do NOT add consent/trust dialogs -- this phase is infrastructure prep, not enforcement
- Do NOT add a "marketplace" or "unverified" tier -- there is no marketplace yet
- Do NOT change the install flow -- the `InstallExtensionDialog` should continue as-is

### Implementation Impact on ExtensionCard

The existing ExtensionCard already renders the "Built-in" badge conditionally:

```tsx
{isBuiltIn && (
  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ctp-surface1 text-ctp-subtext0 font-medium">
    Built-in
  </span>
)}
```

This should be replaced with a `TrustBadge` component that reads trust level from `ExtensionInfo` and renders the appropriate badge. The component should be reusable across the install dialog's review step too.

## Extension Lifecycle Feedback

### Current State (HIGH confidence)

The existing lifecycle feedback in FlowForge:
- **Activation success:** Toast notification (`toast.success`) -- e.g., "Conventional Commits enabled"
- **Activation failure:** Toast error (`toast.error`) + error status in ExtensionCard (red border, error message)
- **Deactivation:** Toast info (`toast.info`) -- e.g., "Gitflow disabled"
- **Toggle state:** ToggleSwitch shows a Loader2 spinner during toggle
- **Extension status enum:** `discovered | activating | active | error | deactivated | disabled` (6 states)
- **BladeRenderer fallback:** When a blade's extension is disabled, shows "This content requires an extension that is currently disabled" with a link to Extension Manager

### VS Code Best Practices (MEDIUM confidence)

Source: [VS Code Status Bar UX](https://code.visualstudio.com/api/ux-guidelines/status-bar) and [Notifications](https://code.visualstudio.com/api/ux-guidelines/notifications):
- Status bar items with loading icons for discreet background progress
- Notifications only when absolutely necessary
- "Do not show again" option on every notification
- Progress notifications for long-running operations

### Recommended Lifecycle Feedback

**Current feedback is already well-designed.** Specific enhancements for Phase 41:

1. **No new notifications for activate/deactivate** -- the existing toast + toggle spinner pattern is sufficient and follows VS Code's "respect the user's attention" principle.

2. **Add "activating" visual state to ExtensionCard** -- currently the `activating` status exists in the enum but the card only checks `active` vs `error`. During Worker sandbox activation (which may be slower than built-in activation), the card should show a subtle loading indicator on the card itself, not just the toggle.

3. **Status bar extension count (optional)** -- a small status bar item on the right showing "Extensions: 4/4" could provide ambient awareness, but this is low priority and should be deferred if scope is tight.

4. **BladeRenderer subscription gap** -- The roadmap notes that BladeRenderer doesn't subscribe to blade registry changes. Currently it uses `getBladeRegistration()` which is a plain function call, not a Zustand subscription. If an extension activates AFTER a blade is already rendered, the fallback UI won't update to show the newly available content. This is a minor UX gap because extensions activate at startup, but it could matter for sandbox extensions that activate lazily. Consider converting `bladeRegistry` to a Zustand store or adding a `useBladeTick()` hook to force re-renders.

## Sandbox Error UX

### Current Error Handling (HIGH confidence)

FlowForge already has robust error handling at multiple levels:

| Layer | Component | Behavior |
|-------|-----------|----------|
| Extension activation | `ExtensionHost.activateExtension()` | try/catch, sets `error` status, calls `api.cleanup()`, shows toast |
| Blade rendering | `BladeErrorBoundary` | Catches React rendering errors, shows retry + go back buttons |
| Missing extension | `BladeRenderer` fallback | Shows "requires an extension" message with link to Extension Manager |
| Install flow | `InstallExtensionDialog` | Multi-step state machine: input -> fetching -> review -> installing -> success/error |

### Sandbox-Specific Error Scenarios

When extensions run in a Worker sandbox, new failure modes emerge:

| Scenario | User Impact | Recommended UX |
|----------|-------------|----------------|
| Worker fails to load | Extension stuck in "activating" | Timeout after 10s, transition to `error` status, toast: "Extension timed out during activation" |
| postMessage timeout | Extension call hangs | Per-call timeout (5s default), show loading state in calling component, then error |
| Worker crashes | Extension silently dies | Worker `onerror` handler sets extension to `error` status, toast notification |
| Sandbox blocks API | Extension tries unsafe operation | Throw descriptive error in Worker, surface as extension error: "X requires trust level: built-in" |
| Memory/CPU abuse | System slowdown | Worker `terminate()` as kill switch, set extension to `error` with "terminated due to resource usage" |

### Recommended Sandbox Error UX

1. **Use existing BladeErrorBoundary** -- sandboxed extension components should be wrapped in the same error boundary that already handles core blade errors. No new error UI needed.

2. **Add timeout handling to ExtensionHost** -- when activating a sandboxed extension, use `Promise.race` with a timeout. If activation exceeds 10 seconds, reject with a clear message.

3. **Toast for non-blocking errors** -- sandbox errors should use the existing `toast.error()` pattern. Error toasts already persist (no auto-dismiss per `DEFAULT_DURATIONS.error: undefined`), which is correct for extension failures.

4. **"Retry" action on error toasts** -- enhance the toast for sandbox errors with a `ToastAction` that re-attempts activation:
   ```ts
   toast.error(`Extension "${name}" timed out`, {
     label: "Retry",
     onClick: () => activateExtension(id),
   });
   ```

5. **Extension card error state** -- already handles `error` status with red border. Add the specific error message from the sandbox (e.g., "Worker terminated: exceeded memory limit").

6. **Do NOT add modal dialogs for sandbox errors** -- sandbox failures are not critical enough to interrupt the user's workflow. The non-blocking toast + error card state is the right pattern.

## Deprecation Impact Assessment

### Scope (HIGH confidence)

**16 deprecated re-export shim files** in `src/stores/`:
- `repository.ts`, `branches.ts`, `tags.ts`, `gitflow.ts`, `stash.ts`, `clone.ts`, `undo.ts`, `worktrees.ts`, `topology.ts` (-> `./domain/git-ops`)
- `staging.ts`, `commandPalette.ts` (-> `./domain/ui-state`)
- `navigation.ts`, `settings.ts`, `theme.ts`, `branchMetadata.ts`, `reviewChecklist.ts` (-> `./domain/preferences`)

**92 import statements across 55 files** still reference these shims.

### User-Facing Impact: ZERO

The deprecated shims are **internal implementation details** -- they are import path aliases, not user-facing features. Removing them:
- Does NOT change any UI behavior
- Does NOT change any user-visible text, icons, or interactions
- Does NOT break any extension APIs (extensions import from `../extensions/ExtensionAPI`, not from stores)
- Does NOT affect the Rust backend (shims are TypeScript-only)

The only "users" affected are **extension developers** who import from `stores/repository` instead of `stores/domain/git-ops`. However:
- All 4 built-in extensions (content-viewers, conventional-commits, gitflow, github) use these shim paths
- External extensions would NOT import from FlowForge internal stores (they use the ExtensionAPI facade)
- The 3 built-in extensions that import `useRepositoryStore` from shim paths need updating

### Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missed consumer in refactor | LOW | TypeScript compiler will catch any broken imports immediately |
| Merge conflicts with in-flight PRs | N/A | Phase 41 is sequential after Phase 40 |
| Extension developer confusion | NEGLIGIBLE | No external extensions exist yet; built-in extensions are updated in same commit |

### Recommended Approach

1. **Do it as a single atomic commit** -- update all 55 files, remove all 16 shim files, run `tsc --noEmit` to verify zero broken imports.
2. **No user-facing changelog entry needed** -- this is invisible to end users.
3. **No deprecation warning UI** -- the shims are code-level, not user-level.

## Documentation UX Patterns

### Current Documentation State (HIGH confidence)

FlowForge has no developer-facing documentation site. Extension development documentation exists only in:
- JSDoc comments on `ExtensionAPI` class methods
- The `ExtensionManifest` Rust struct comments
- Inline code comments in the 4 built-in extension entry points

### Best Practices for Extension API Documentation (MEDIUM confidence)

Source: [Pronovix API Documentation Best Practices](https://pronovix.com/blog/best-practices-and-ux-tips-api-documentation):

1. **Getting Started guide** -- should let a developer create a "hello world" extension in under 5 minutes
2. **API Reference** -- generated from TypeScript types, organized by registration surface
3. **Code snippets** -- copy-pasteable examples for each API method
4. **Progressive disclosure** -- start simple, reveal advanced topics (sandbox, git hooks) later

### Recommended Documentation Structure

```
docs/
  getting-started.md       # Your first extension in 5 min
  api-reference.md         # Full ExtensionAPI class reference
  extension-manifest.md    # JSON schema for flowforge.extension.json
  trust-levels.md          # Built-in vs trusted vs sandboxed
  examples/
    hello-world/           # Minimal blade extension
    toolbar-action/        # Toolbar + command contribution
    git-hook/              # Pre-commit validation
    sidebar-panel/         # Sidebar widget extension
```

### Key Developer Experience Patterns

1. **Organized by extension point, not by API method:**
   - "Adding a blade" (registerBlade + type system)
   - "Adding a toolbar action" (contributeToolbar + icons)
   - "Hooking into git operations" (onWillGit/onDidGit)
   - "Adding a sidebar panel" (contributeSidebarPanel)

2. **API classification table** -- critical for Phase 41's sandbox-safe vs requires-trust classification:

   | API Method | Trust Level | Sandbox Safe | Notes |
   |------------|------------|--------------|-------|
   | `registerBlade` | Any | YES | UI contribution, no side effects |
   | `registerCommand` | Any | YES | UI contribution, no side effects |
   | `contributeToolbar` | Any | YES | UI contribution, no side effects |
   | `contributeContextMenu` | Any | YES | UI contribution, no side effects |
   | `contributeSidebarPanel` | Any | YES | UI contribution, no side effects |
   | `contributeStatusBar` | Any | YES | UI contribution, no side effects |
   | `onDidGit` | trusted+ | NO | Receives post-operation data |
   | `onWillGit` | trusted+ | NO | Can cancel git operations |
   | `onDispose` | Any | YES | Cleanup callback |

3. **Inline "Try it" sections** -- for a desktop app, this means linking to example extension repos that can be installed via the existing `InstallExtensionDialog`.

## Extensibility UI Architecture

### Current Architecture (HIGH confidence)

FlowForge uses a **registry-based extensibility pattern** with 7 registries:

| Registry | Store Type | React Integration | Source Tracking |
|----------|-----------|-------------------|-----------------|
| `bladeRegistry` | Plain Map | `getBladeRegistration()` function | `source` field |
| `commandRegistry` | Plain Map | Consumed by CommandPalette | `source` field |
| `toolbarRegistry` | Zustand store | `useToolbarRegistry` hook | `source` field |
| `contextMenuRegistry` | Zustand store | `useContextMenuRegistry` hook | `source` field |
| `sidebarPanelRegistry` | Zustand store | `useSidebarPanelRegistry` hook | `source` field |
| `statusBarRegistry` | Zustand store | `useStatusBarRegistry` hook | `source` field |
| `previewRegistry` | Plain Map | Function-based lookup | No source tracking |

**Key UX architecture observations:**

1. **Blade registry is the odd one out** -- it is a plain `Map` without Zustand, so components that call `getBladeRegistration()` do NOT re-render when registrations change. All other registries use Zustand stores that trigger re-renders automatically.

2. **Priority clamping enforces visual hierarchy** -- extension sidebar panels are clamped to 1-69 (core reserves 70-100), extension status bar items clamped to 1-89 (core reserves 90-100). This ensures core UI elements always appear in predictable positions.

3. **Namespace prefixing** -- all extension contributions are prefixed with `ext:{extensionId}:` unless `coreOverride: true`. This prevents collisions and enables per-extension cleanup.

4. **Source-based bulk cleanup** -- `unregisterBySource("ext:{id}")` removes all contributions from a single extension across all registries. This is clean and atomic.

### Recommended Architecture Improvements for Phase 41

1. **Convert bladeRegistry to Zustand** -- this is the highest-impact UX improvement. When an extension activates after initial render, blade content should appear without requiring navigation. Currently, BladeRenderer calls `getBladeRegistration()` which is not reactive. Converting to a Zustand store with `useBladeRegistry` selector would fix this.

2. **Consistent visual language for extension contributions:**
   - Extension-contributed toolbar items should look identical to core items (already true)
   - Extension-contributed sidebar panels should look identical to core panels (already true)
   - Extension-contributed status bar items should look identical to core items (already true)
   - This is already well-implemented -- no changes needed

3. **Extension contribution indicators (optional, low priority):**
   - In the command palette, extension commands could show a small "ext" indicator
   - In the context menu, extension items could show the extension icon
   - These are nice-to-have but not necessary for v1.6.0

4. **Error isolation boundary per extension:**
   - Each extension's contributed sidebar panel should be wrapped in its own error boundary
   - Currently, `BladeErrorBoundary` wraps blades but sidebar panels may not have error boundaries
   - A crashing extension sidebar panel should not take down the entire sidebar

## Recommendations

### Priority 1 (Must-have for Phase 41)

1. **Add `trustLevel` field to ExtensionInfo and ExtensionManifest** -- `"built-in" | "trusted" | "sandboxed"`. Built-in extensions set this automatically in `registerBuiltIn()`. External extensions default to `"sandboxed"` (future) or `"trusted"` (current behavior for installed extensions).

2. **Create TrustBadge component** -- follows existing PermissionBadge pattern, renders trust level as color-coded pill. Place in ExtensionCard next to extension name.

3. **Classify ExtensionAPI methods** -- add JSDoc `@sandbox-safe` or `@requires-trust` annotations to each method. No runtime enforcement in v1.6.0, just documentation.

4. **Remove 16 deprecated shims** -- pure internal refactor, zero UX impact. Update all 92 imports across 55 files. TypeScript compiler verifies correctness.

5. **Sandbox error handling via existing patterns** -- use `BladeErrorBoundary` for rendering errors, `toast.error()` with retry action for activation failures, timeout on Worker activation.

### Priority 2 (Should-have for Phase 41)

6. **Convert bladeRegistry to Zustand store** -- fixes the subscription gap where BladeRenderer doesn't react to runtime registration changes. Important for sandbox extensions that may activate lazily.

7. **Add per-extension error boundaries for sidebar panels** -- prevents a crashing extension panel from breaking the entire sidebar.

8. **Add "activating" visual state to ExtensionCard** -- show loading indicator on the card (not just the toggle) when an extension is in `activating` status, especially relevant for slower sandbox activation.

### Priority 3 (Nice-to-have, can defer to post-v1.6.0)

9. **Extension contribution indicators in command palette** -- subtle "ext" tag on extension-contributed commands.

10. **Status bar extension health indicator** -- "Extensions: 4/4 active" in status bar.

11. **Documentation website** -- depends on whether docs are in scope for v1.6.0. At minimum, the API classification table should exist as a markdown file in the repo.

## Common Pitfalls

### Pitfall 1: Over-designing Trust UI for Infrastructure Phase
**What goes wrong:** Building full trust consent dialogs, warning modals, and "are you sure?" prompts when there is no marketplace, no untrusted extensions, and no sandboxing enforcement yet.
**Why it happens:** Looking at VS Code's mature trust system and trying to replicate it.
**How to avoid:** Phase 41 is about INFRASTRUCTURE. Add the trust field, the badge, and the API classification. Do NOT add blocking trust dialogs. Those belong in a future "marketplace" phase.
**Warning signs:** Any PR that adds a modal dialog with "Trust this extension?" is over-scoping.

### Pitfall 2: Breaking Extension Imports During Deprecation Cleanup
**What goes wrong:** Missing a consumer, causing a runtime error in an obscure code path.
**Why it happens:** 92 imports across 55 files is a lot of changes.
**How to avoid:** Run `tsc --noEmit` after every shim removal. Use search-and-replace with the exact import paths. Test all 4 built-in extensions activate/deactivate after the change.
**Warning signs:** Any file still importing from `stores/repository` instead of `stores/domain/git-ops` after cleanup.

### Pitfall 3: Ignoring the BladeRenderer Subscription Gap
**What goes wrong:** Sandbox extensions activate after initial render, but their blade content doesn't appear until the user navigates away and back.
**Why it happens:** `bladeRegistry` is a plain Map, not a Zustand store. `getBladeRegistration()` is not reactive.
**How to avoid:** Convert bladeRegistry to Zustand or add a registry version counter that triggers re-renders.
**Warning signs:** User toggles an extension on, opens a blade that should be provided by that extension, and sees the "requires extension" fallback even though the extension is active.

### Pitfall 4: Worker Sandbox Prototype Scope Creep
**What goes wrong:** Building a full sandbox runtime when the goal is a "prototype" that "demonstrates postMessage communication."
**Why it happens:** Sandbox is an exciting technical challenge that invites over-engineering.
**How to avoid:** The success criterion is clear: "demonstrates postMessage communication between host and isolated extension code." A single Worker that can receive a message and respond is sufficient. No need for Comlink, no need for full API proxying.
**Warning signs:** Any PR that introduces more than 200 lines of sandbox runtime code is likely over-scoping.

## Open Questions

1. **Should the Worker sandbox prototype actually run a real extension?**
   - What we know: Success criterion says "demonstrates postMessage communication between host and isolated extension code"
   - What's unclear: Does "extension code" mean a real extension entry point, or a demo script?
   - Recommendation: Use a minimal demo script, not a real extension. Attempting to run a real extension in a Worker requires proxying the entire ExtensionAPI, which is far beyond prototype scope.

2. **Should trust level be stored in the Rust manifest or only in TypeScript?**
   - What we know: Built-in extensions create synthetic manifests in `registerBuiltIn()`. External manifests are parsed from JSON by Rust.
   - What's unclear: Whether the `trustLevel` field belongs in the JSON schema or is runtime-only.
   - Recommendation: Add it to the Rust struct as `Option<String>` with `serde(default)` so it can be declared in manifest JSON for future use, but set it programmatically for built-in extensions.

3. **Is the documentation website in scope for v1.6.0 or a future phase?**
   - What we know: Plan 41-03 says "Documentation website update and version bump to v1.6.0"
   - What's unclear: Whether "documentation website" means a new site or updating an existing one.
   - Recommendation: If no docs site exists, create API classification as markdown in-repo. A full docs site is a separate effort.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/extensions/ExtensionAPI.ts`, `src/extensions/ExtensionHost.ts`, `src/extensions/extensionTypes.ts`
- Codebase analysis: `src/blades/extension-manager/` (ExtensionManagerBlade, ExtensionCard, InstallExtensionDialog)
- Codebase analysis: `src/blades/_shared/BladeRenderer.tsx`, `src/blades/_shared/BladeErrorBoundary.tsx`
- Codebase analysis: All 16 deprecated shim files in `src/stores/`
- Codebase analysis: Rust `src-tauri/src/extensions/manifest.rs`

### Secondary (MEDIUM confidence)
- [VS Code Extension Runtime Security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security) - Trust levels, verified publisher badges
- [VS Code Workspace Trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust) - Restricted mode UX
- [VS Code Status Bar UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/status-bar) - Loading indicators, error states
- [VS Code Notifications UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/notifications) - "Respect the user's attention" principle
- [JetBrains Plugin Security](https://plugins.jetbrains.com/docs/marketplace/understanding-plugin-security.html) - Verified vendor badges
- [Security and Trust in VS Marketplace](https://developer.microsoft.com/blog/security-and-trust-in-visual-studio-marketplace) - Publisher verification
- [Comlink TypeScript Worker RPC](https://github.com/GoogleChromeLabs/comlink) - Worker communication library (Context7, HIGH)
- [Pronovix API Documentation Best Practices](https://pronovix.com/blog/best-practices-and-ux-tips-api-documentation) - Getting started guides, API reference design

### Tertiary (LOW confidence)
- [JavaScript Sandboxing Deep Dive](https://alexgriss.tech/en/blog/javascript-sandboxes/) - Browser sandbox architecture
- [UX Patterns for Error Handling](https://medium.com/design-bootcamp/error-handling-ux-design-patterns-c2a5bbae5f8d) - General error handling patterns

## Metadata

**Confidence breakdown:**
- Trust level visual design: HIGH - based on direct codebase analysis of existing badge patterns + well-documented VS Code patterns
- Extension lifecycle feedback: HIGH - existing implementation is already solid, minor enhancements identified
- Sandbox error UX: MEDIUM - new territory for the app, but can leverage existing error handling patterns
- Deprecation impact: HIGH - exact import counts verified by codebase analysis, zero user-facing impact confirmed
- Documentation UX: MEDIUM - no existing docs site, recommendations based on industry patterns
- Extensibility architecture: HIGH - registry system thoroughly analyzed, specific gap (bladeRegistry reactivity) identified

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, no rapidly changing dependencies)

## RESEARCH COMPLETE
