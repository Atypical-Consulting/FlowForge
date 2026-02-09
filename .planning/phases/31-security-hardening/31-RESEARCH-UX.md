# Phase 31: Security Hardening - UX Research

**Researched:** 2026-02-09
**Domain:** Content Security Policy, Asset Protocol Scope, Tauri Capabilities -- User Experience Impact
**Confidence:** HIGH

## Summary

Security hardening (CSP, asset protocol scope narrowing, capability auditing) is primarily a backend/configuration change, but it has significant UX implications that must be anticipated and designed for. The current FlowForge codebase has **three concrete user-facing breakage risks** from CSP enforcement: (1) Monaco Editor loading from CDN will be blocked by `script-src` restrictions, (2) the inline FOUC-prevention script in `index.html` will be blocked without a nonce or hash, and (3) NuGet package viewer's direct `fetch()` calls to `nuget.org` APIs will be blocked by `connect-src`. Additionally, the MarkdownImage component loads external `http://` and `https://` images from arbitrary domains, which `img-src` will restrict.

From a UX perspective, the key insight is that security hardening should be **invisible to users when things work correctly** and **informative when things fail**. Users should never see a blank Monaco editor with a cryptic console error. They should never encounter a silently broken NuGet viewer. The UX strategy is: fix the root causes (bundle Monaco locally, proxy NuGet through Rust backend), add graceful degradation for things that legitimately cannot be whitelisted (arbitrary external images in markdown), and communicate clearly when security boundaries prevent an action.

For the future extension system (Phase 32+), the security UX research reveals that VS Code's "Workspace Trust" model is the best reference: trust boundaries should be per-publisher (not per-extension), prompts should be rare and meaningful (not per-action), and the trust decision should be reversible from settings.

**Primary recommendation:** Fix all CSP breakage at the implementation level (bundle Monaco, move NuGet fetch to Rust backend, handle inline script via nonce/hash) so that CSP enforcement is invisible to users. Design graceful degradation for external markdown images. Defer extension permission UX to later phases but establish the architectural contract now.

## Architecture Patterns

### Current External Network Dependencies (Frontend)

The following frontend code makes direct network requests that a strict CSP `connect-src` or `script-src` policy will affect:

| Component | URL | CSP Directive | Impact |
|-----------|-----|---------------|--------|
| Monaco Editor (`monacoTheme.ts`) | `https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs` | `script-src` | **CRITICAL** -- Editor will not load at all |
| NuGet Viewer (`NugetPackageViewer.tsx`) | `https://azuresearch-usnc.nuget.org/query?q=...` | `connect-src` | Package info will fail silently |
| NuGet Viewer (`NugetPackageViewer.tsx`) | `https://api.nuget.org/v3/registration5-gz-semver2/...` | `connect-src` | Published date lookup will fail |
| Markdown Images (`MarkdownImage.tsx`) | Any `http://` or `https://` URL in markdown | `img-src` | External images in README files will break |
| NuGet Viewer links | `https://www.nuget.org/packages/...` (href, not fetch) | N/A (navigation) | Links opened via plugin-opener, unaffected by CSP |

### Current External Network Dependencies (Backend / Rust)

These are NOT affected by CSP (CSP governs the WebView, not Rust):

| Component | URL | Notes |
|-----------|-----|-------|
| Gitignore templates (`gitignore.rs`) | `https://api.github.com/gitignore/templates` | Rust-side reqwest, CSP does not apply |
| Git clone/fetch/push | Various git remotes | libgit2, not WebView |

### Current Inline Code in HTML

| File | Issue | CSP Directive |
|------|-------|---------------|
| `index.html` lines 9-29 | Inline `<script>` for FOUC prevention (theme detection) | `script-src` requires `'unsafe-inline'` OR nonce/hash |

### Current Inline Styles in Components

Multiple components use React `style={}` props (e.g., `GitflowCheatsheetBlade.tsx`, `Viewer3dBlade.tsx`, `FileTreeBlade.tsx`, `TopologyPanel.tsx`, `AnimatedGradientBg.tsx`, `ShortcutTooltip.tsx`). In Tauri v2, the build system automatically hashes inline styles, so these should work with CSP. However, Tailwind CSS's `style` attribute usage and framer-motion's inline style animations need verification.

**Confidence:** HIGH -- Verified via Tauri v2 docs that `style` attributes are handled by Tauri's CSP injection at build time.

---

## UX Impact Analysis

### Impact 1: Monaco Editor Failure (CRITICAL)

**What happens without mitigation:** The code viewer blade (`ViewerCodeBlade.tsx`) and diff viewer will show a blank/loading state indefinitely. Monaco's CDN scripts will be blocked by `script-src 'self'`. No visible error will be shown to the user -- just a perpetual loading spinner or empty panel.

**Current UX:** Monaco loads from jsdelivr CDN (configured in `monacoTheme.ts` line 44-48). If CDN is unreachable, the component silently fails.

**Fix strategy (implementation, not UX):** Bundle Monaco locally using `@monaco-editor/react`'s built-in local loader:
```typescript
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
loader.config({ monaco });
```
This eliminates the CDN dependency entirely. No CSP whitelist needed for script-src.

**UX design needed:** None -- the fix makes the problem invisible. But add error boundary around Editor component to catch unexpected failures gracefully, showing `BladeContentError` with a retry button instead of a blank panel.

**Confidence:** HIGH -- [Verified via @monaco-editor/react v4.4.0+ docs](https://www.npmjs.com/package/@monaco-editor/react) that local bundling is supported natively.

### Impact 2: NuGet Package Viewer Failure (MODERATE)

**What happens without mitigation:** When a user opens a `.nupkg` file in the repo browser, the NuGet viewer will show the package name/version (parsed from filename) but the enrichment data (description, downloads, authors, published date) will fail to load. The `fetch()` calls to `azuresearch-usnc.nuget.org` and `api.nuget.org` will be blocked by `connect-src`.

**Current UX:** Already has graceful degradation -- the viewer shows "Could not fetch package info from NuGet.org" (line 238) or "Package not found on NuGet.org" (line 243). This is acceptable UX.

**Fix strategy options:**
1. **Move NuGet fetch to Rust backend** (preferred) -- Add a Tauri command `get_nuget_package_info(package_id)` that uses reqwest. CSP doesn't apply to Rust. Frontend calls this via IPC. This is consistent with the gitignore template pattern already in the codebase.
2. **Whitelist NuGet domains in CSP** -- Add `azuresearch-usnc.nuget.org` and `api.nuget.org` to `connect-src`. Simpler but widens the attack surface and sets a bad precedent for future features.

**UX design needed:** If using option 1, no UX change needed -- the existing error states handle failures. If the Rust command fails, return an appropriate error that maps to the existing UI states.

**Confidence:** HIGH -- Pattern already proven by gitignore.rs implementation.

### Impact 3: External Markdown Images (LOW-MODERATE)

**What happens without mitigation:** When a user views a markdown file that contains external image references (e.g., `![badge](https://img.shields.io/...)` or `![screenshot](https://user-images.githubusercontent.com/...)`), those images will fail to load. The `img-src` CSP directive will block them.

**Current UX:** `MarkdownImage.tsx` already has graceful degradation -- it shows `[image: alt text]` as a placeholder (line 89-92). This is acceptable but could be improved.

**Fix strategy options:**
1. **Whitelist common image CDNs** -- Add `img.shields.io`, `*.githubusercontent.com`, `avatars.githubusercontent.com` to `img-src`. This covers the most common cases (GitHub README badges and screenshots). Moderate security trade-off.
2. **Proxy through Rust backend** -- Fetch images via a Tauri command, return as base64 data URIs. Secure but adds complexity and latency.
3. **Allow `https:` broadly in img-src** -- `img-src 'self' asset: data: https:` allows all HTTPS images. Least restrictive but images are lower-risk than scripts.
4. **Show a "load external image" button** -- Replace blocked images with a clickable placeholder that says "External image from [domain]. Click to load." User clicks, image loads via Rust proxy. Most secure, adds friction.

**Recommended approach:** Option 3 (`img-src 'self' asset: data: https:`) -- images are display-only content and cannot execute code. This is standard practice even in strict CSP deployments. The `data:` source is needed for the existing base64 image loading pattern in `MarkdownImage.tsx`.

**UX design needed:**
- If using option 3: No UX change, images just work.
- If using option 4: Design a tasteful placeholder that shows the image domain, uses `MarkdownImage`'s existing error state pattern, and adds a small "Load" button. Should match the Catppuccin theme (e.g., `text-ctp-overlay0` placeholder, `text-ctp-blue` button).

**Confidence:** HIGH -- CSP img-src behavior is well-documented.

### Impact 4: Inline FOUC Prevention Script (LOW)

**What happens without mitigation:** The theme detection script in `index.html` (lines 9-29) will be blocked by `script-src 'self'` (no `'unsafe-inline'`). The user will see a flash of unstyled content (FOUC) -- the page briefly appears in the wrong theme before React hydrates.

**Current UX:** Seamless theme application before any React rendering.

**Fix strategy:** Tauri v2's build system automatically hashes inline scripts and adds them to the CSP. The inline script should work as-is because Tauri's `dangerousDisableAssetCspModification` defaults to `false`, meaning Tauri WILL inject the hash. Verify this works during implementation.

**UX design needed:** None -- Tauri handles this automatically. But verify during development that the FOUC prevention still works after CSP is enabled.

**Confidence:** MEDIUM -- Tauri docs confirm automatic hashing, but edge cases exist. Needs implementation-time verification.

### Impact 5: Framer Motion Inline Styles (LOW)

**What happens without mitigation:** framer-motion applies inline `style` attributes for animations. CSP `style-src` with `'self'` only (no `'unsafe-inline'`) could block these.

**Current behavior:** Multiple components use framer-motion (`AnimatePresence`, `motion.*`). If inline styles are blocked, animations will not render and components may appear broken.

**Fix strategy:** Tailwind CSS v4 generates utility classes (not inline styles), so it's unaffected. For framer-motion, Tauri's CSP injection handles inline styles automatically at build time. If issues arise, `'unsafe-inline'` for `style-src` is a standard and low-risk exception (inline styles cannot execute code).

**UX design needed:** None -- this should work automatically. Monitor during development.

**Confidence:** MEDIUM -- Standard practice but needs verification with framer-motion's runtime style injection.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monaco CDN loading | CSP whitelist for jsdelivr | Local bundling via `loader.config({ monaco })` | CDN whitelisting introduces supply-chain risk; local bundle is self-contained |
| Frontend-to-external-API fetch | CSP whitelist for each API domain | Rust backend commands + IPC | Keeps all external network calls in Rust where they're not subject to CSP |
| CSP violation monitoring | Custom error handlers in every component | Browser's `securitypolicyviolation` event + toast notification | One global handler catches all CSP violations |
| Extension permission UI | Custom dialog per permission | Standardized permission prompt component | Consistency, reusability, user learning |

**Key insight:** The correct fix for most CSP issues is to move the network call to the Rust backend, not to whitelist domains in CSP. This is both more secure and more consistent with Tauri's security model.

---

## Common Pitfalls

### Pitfall 1: Silent Failures from CSP Violations

**What goes wrong:** CSP violations are only visible in the browser console (DevTools). Users see blank panels, missing images, or broken features with no explanation.

**Why it happens:** CSP violations don't throw JavaScript errors that can be caught by try/catch or error boundaries. The browser silently blocks the resource.

**How to avoid:**
1. Add a global `securitypolicyviolation` event listener in `main.tsx` that logs violations and optionally shows a toast notification during development.
2. Ensure every component that loads external resources has explicit error/fallback states (all blade viewers already have this pattern via `BladeContentError`).
3. Test CSP in development using `devCsp` configuration.

**Warning signs:** Blank panels, missing images, features that "used to work" after security hardening.

### Pitfall 2: Overly Broad CSP Whitelist

**What goes wrong:** To fix CSP breakage, developers add broad wildcards like `connect-src *` or `script-src 'unsafe-inline' 'unsafe-eval'`, negating the security benefits.

**Why it happens:** Time pressure, unfamiliarity with CSP, "it works in dev" mentality.

**How to avoid:**
1. Document every domain in the CSP whitelist with a justification.
2. Prefer moving calls to Rust backend over whitelisting domains.
3. Use the most restrictive feasible policy: start with `'self'` only, add sources one at a time, test each addition.

**Warning signs:** CSP policy contains `*`, `'unsafe-eval'`, or more than 3-4 whitelisted domains.

### Pitfall 3: Breaking Development Workflow

**What goes wrong:** Strict CSP in production is fine, but the same policy in development breaks hot module replacement (HMR), Vite dev server WebSocket, and React DevTools.

**Why it happens:** Using the same CSP for both production and development.

**How to avoid:** Use `devCsp` in `tauri.conf.json` with a more permissive policy that allows Vite's dev server:
```json
{
  "security": {
    "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data: https:; connect-src ipc: http://ipc.localhost",
    "devCsp": "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src ipc: http://ipc.localhost ws://localhost:* http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data: https:"
  }
}
```

**Warning signs:** HMR stops working, Vite WebSocket connection fails, React DevTools can't connect.

### Pitfall 4: Asset Protocol Scope Too Narrow

**What goes wrong:** Narrowing `assetProtocol.scope` from `["**"]` to specific directories breaks features that read files from the user's repository.

**Why it happens:** Misunderstanding what the asset protocol is used for vs. what the Rust backend reads directly.

**How to avoid:**
- The current codebase does NOT use `asset://` URLs in the frontend (verified: no `asset://` or `convertFileSrc` references in `src/`).
- All file reading goes through Tauri commands (`commands.readRepoFile`, `commands.getFileBase64`, etc.).
- The asset protocol scope can likely be **disabled entirely** (`"enable": false`) since no frontend code uses it.
- If it must remain enabled, scope it to the app's own assets directory only.

**Warning signs:** Images or files that were loading via asset protocol stop loading. (Currently N/A for this codebase.)

**Confidence:** HIGH -- Grep search confirmed no `asset://` or `convertFileSrc` usage in the source.

### Pitfall 5: Capability Permissions That Look Broad But Are Needed

**What goes wrong:** Auditing capabilities and removing permissions that seem broad but are actually required, breaking features.

**Current permissions analysis:**
| Permission | Used By | Can Narrow? |
|------------|---------|-------------|
| `core:default` | Tauri core functionality | No -- baseline |
| `opener:default` | `openUrl()` in MarkdownLink, Header, worktrees | Possibly -- could scope to `opener:allow-open-url` only |
| `dialog:default` | File/folder pickers in CloneForm, Header, worktrees | Possibly -- could scope to `dialog:allow-open` only |
| `store:default` | Settings persistence via plugin-store | No -- needed for all store operations |
| `core:window:default` | Window management | Possibly -- could scope to specific window operations |
| `window-state:default` | Window position/size persistence | No -- simple plugin |

**How to avoid:** Before removing any permission, grep the codebase for its usage. Test each removal individually. Document what each permission enables.

---

## UX Patterns for Security Communication

### Pattern 1: Invisible Security (Primary)

**What:** Security measures work silently. Users never see security UI unless something goes wrong.
**When:** CSP enforcement, capability restrictions, asset protocol scoping.
**Why:** Security that's invisible is security that users don't try to work around.
**FlowForge application:** After fixing Monaco bundling, NuGet proxy, and CSP configuration, all current features should work exactly as before. No new UI elements needed for Phase 31.

### Pattern 2: Informative Degradation

**What:** When a security boundary prevents content from loading, show a clear message explaining what happened and (if possible) offer a workaround.
**When:** External markdown images blocked by CSP, extension content blocked.
**Example UI:**
```
+-------------------------------------------+
|  [Image icon]                             |
|  External image blocked                   |
|  Source: img.shields.io                   |
|  Images from external sources are         |
|  not loaded for security.                 |
+-------------------------------------------+
```
**FlowForge application:** Enhance `MarkdownImage.tsx`'s error state to distinguish between "image not found" and "image blocked by security policy". (Only needed if using strict `img-src`, not if using `img-src https:`.)

### Pattern 3: CSP Violation Toast (Development Only)

**What:** A global event listener shows toast notifications when CSP blocks a resource, making violations immediately visible to developers.
**When:** Development builds only.
**Example:**
```typescript
// main.tsx (dev only)
if (import.meta.env.DEV) {
  document.addEventListener('securitypolicyviolation', (e) => {
    toast.warning(`CSP blocked: ${e.blockedURI} (${e.violatedDirective})`);
  });
}
```
**Why:** CSP violations are silent by default. During development, developers need immediate feedback when they introduce code that violates CSP.

### Pattern 4: Extension Trust Prompt (Future -- Phase 32+)

**What:** When a user installs a third-party extension, show a one-time trust prompt for the publisher (not the individual extension).
**When:** First extension from a new publisher is installed.
**Reference:** VS Code's publisher trust model (introduced in v1.97).
**Design principles:**
- Trust is per-publisher, not per-extension (reduces prompt frequency)
- Show publisher name, extension name, requested permissions in plain language
- "Trust" and "Don't Trust" as primary actions (not "OK"/"Cancel")
- Trust decision is reversible from Settings > Extensions
- Never show permission prompts during normal operation (only at install time)

**Confidence:** MEDIUM -- Based on VS Code research; actual extension system design may differ.

---

## Extension Security UX Architecture (Forward-Looking)

This section documents architectural decisions for the extension permission model's UX, to be implemented in Phase 32+. Establishing the contract now ensures Phase 31's security boundaries are compatible.

### Permission Declaration in Manifests

Extensions declare their required permissions in `manifest.json`:
```json
{
  "permissions": {
    "network": ["api.github.com", "*.githubusercontent.com"],
    "commands": ["registerBlade", "registerCommand", "registerToolbarItem"],
    "settings": true,
    "repoContext": true
  }
}
```

**UX implication:** The manifest format determines what information is available for the trust prompt. Declare permissions in human-readable categories, not raw API names.

### Permission Display Categories

Map technical permissions to user-facing categories:

| Technical Permission | User-Facing Category | Plain Language |
|---------------------|---------------------|----------------|
| `network: [domains]` | Network Access | "Can connect to api.github.com" |
| `commands: [...]` | App Integration | "Can add toolbar buttons and panels" |
| `settings: true` | Settings | "Can store its own settings" |
| `repoContext: true` | Repository Info | "Can read your branch names and remote URLs" |
| `fs: [paths]` | File Access | "Can read files in your repository" |

### Trust Levels (Future)

| Level | Visual Indicator | Who | Example |
|-------|-----------------|-----|---------|
| Built-in | No indicator (it's part of the app) | FlowForge team | GitHub Integration (first-party) |
| Verified Publisher | Blue checkmark badge | Verified third parties | Community extensions |
| Unverified | Yellow warning badge | Unknown publishers | User-authored extensions |

**UX principle:** First-party extensions (like the GitHub integration) should NEVER show permission prompts. They are part of the app. Only third-party extensions trigger trust prompts.

### Settings Integration

A new "Extensions" tab in Settings (alongside General, Git, Integrations, Review, Appearance) would display:
- List of installed extensions with enable/disable toggles
- Per-extension permission summary
- "Trust" status with ability to revoke
- Extension-specific settings (delegated to the extension's `contributes.settings`)

**Confidence:** MEDIUM -- Architecture is sound but actual implementation will be determined in Phase 32.

---

## Impact on Current User Workflows

### Workflow: Viewing Code Files
**Current:** User opens repo browser > clicks a file > ViewerCodeBlade renders Monaco editor loaded from CDN.
**After Phase 31 (without fix):** Blank editor panel. No error shown.
**After Phase 31 (with fix):** Identical to current behavior. Monaco loaded from local bundle.
**User perception:** No change. Invisible.

### Workflow: Viewing NuGet Packages
**Current:** User opens .nupkg > NugetPackageViewer fetches metadata from nuget.org APIs.
**After Phase 31 (without fix):** Package name/version shown (from filename), but description, downloads, etc. missing. Existing error state shows "Could not fetch package info."
**After Phase 31 (with fix):** Identical to current behavior. Metadata fetched via Rust backend.
**User perception:** No change if fix is applied. Graceful degradation if not.

### Workflow: Viewing Markdown with External Images
**Current:** User opens README.md > external images (badges, screenshots) load from arbitrary URLs.
**After Phase 31 (with `img-src https:`):** Identical to current behavior.
**After Phase 31 (with strict `img-src`):** External images show `[image: alt text]` placeholder.
**User perception:** Depends on CSP strictness chosen. Recommended `img-src https:` preserves current behavior.

### Workflow: Opening External Links
**Current:** User clicks link in markdown > `openUrl()` via plugin-opener opens in system browser.
**After Phase 31:** Identical. `openUrl()` uses Tauri IPC, not affected by CSP.
**User perception:** No change.

### Workflow: Clone Repository
**Current:** User enters URL > clone proceeds via Rust backend.
**After Phase 31:** Identical. Git operations use libgit2, not WebView network.
**User perception:** No change.

### Workflow: Gitignore Template Selection
**Current:** Templates fetched from GitHub API via Rust backend, with bundled fallback.
**After Phase 31:** Identical. Rust-side reqwest is not affected by CSP.
**User perception:** No change.

---

## Recommended CSP Configuration

Based on the analysis, the recommended CSP for production:

```json
{
  "security": {
    "csp": {
      "default-src": "'self'",
      "script-src": "'self'",
      "style-src": "'self' 'unsafe-inline'",
      "img-src": "'self' asset: data: https:",
      "font-src": "'self' data:",
      "connect-src": "ipc: http://ipc.localhost",
      "worker-src": "'self' blob:"
    },
    "devCsp": {
      "default-src": "'self'",
      "script-src": "'self' 'unsafe-inline'",
      "style-src": "'self' 'unsafe-inline'",
      "img-src": "'self' asset: data: https:",
      "font-src": "'self' data:",
      "connect-src": "ipc: http://ipc.localhost ws://localhost:* http://localhost:*",
      "worker-src": "'self' blob:"
    }
  }
}
```

**Directive justifications:**
- `script-src 'self'`: Only app scripts. No CDN, no inline (Tauri hashes inline scripts automatically).
- `style-src 'self' 'unsafe-inline'`: Tailwind classes are bundled; framer-motion uses inline styles at runtime. `unsafe-inline` for styles is low-risk (styles cannot execute code).
- `img-src 'self' asset: data: https:`: Local images, asset protocol, base64 data URIs (used by MarkdownImage), and any HTTPS external image. Images are display-only.
- `font-src 'self' data:`: Bundled fonts from `@fontsource-variable`. `data:` for potential base64 font embedding.
- `connect-src ipc: http://ipc.localhost`: Only Tauri IPC. No frontend-initiated external network calls (all go through Rust backend).
- `worker-src 'self' blob:`: Monaco Editor uses web workers. After local bundling, workers are `'self'`. `blob:` is needed if Monaco creates blob URLs for workers (common pattern).

**Prerequisites before this CSP can be enforced:**
1. Monaco Editor must be bundled locally (remove CDN dependency)
2. NuGet API calls must be moved to Rust backend
3. Verify framer-motion works with `'unsafe-inline'` for styles
4. Verify Tauri's inline script hashing works for `index.html` FOUC script

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSP as string in config | CSP as directive object in Tauri v2 | Tauri v2.0 | Easier to maintain, merge directives |
| `'unsafe-inline'` for scripts | Nonce/hash-based script allowlisting | Tauri v2.0 | Tauri auto-hashes inline scripts at build time |
| Wildcard asset protocol scope | Directory-scoped asset protocol | Tauri v2.0 | Minimum-privilege file access |
| Monolithic capability file | Scoped capabilities with allow/deny | Tauri v2.0 | Fine-grained permission model |
| Extension trust: user decides | Publisher-level trust prompts | VS Code v1.97 (2025) | Fewer prompts, more meaningful trust decisions |

---

## Open Questions

1. **Framer-motion runtime style injection under CSP**
   - What we know: framer-motion injects inline styles at runtime for animations. Tauri's build-time hashing covers static inline styles but may not cover dynamically injected ones.
   - What's unclear: Whether `'unsafe-inline'` in `style-src` covers all framer-motion use cases, or if any edge cases exist.
   - Recommendation: Include `'unsafe-inline'` in `style-src` (low risk) and verify in development. This is standard practice.

2. **Monaco worker bundling specifics**
   - What we know: Monaco Editor uses web workers for language services. Local bundling changes how workers are loaded.
   - What's unclear: Exact `worker-src` directive needed. Workers may use `blob:` URLs or be loaded as separate files.
   - Recommendation: Start with `worker-src 'self' blob:` and test. May need adjustment based on Vite's worker bundling output.

3. **Three.js WebGL and CSP**
   - What we know: The 3D viewer (`Viewer3dBlade.tsx`) uses Three.js with WebGL.
   - What's unclear: Whether WebGL shader compilation is affected by CSP (some browsers treat shader compilation as a form of code execution).
   - Recommendation: Test the 3D viewer after CSP enforcement. WebGL is generally CSP-compatible but edge cases exist.

4. **Asset protocol: can it be disabled entirely?**
   - What we know: No frontend code uses `asset://` URLs or `convertFileSrc`. All file I/O goes through Tauri commands.
   - What's unclear: Whether any Tauri plugin or internal mechanism uses the asset protocol implicitly.
   - Recommendation: Try `"enable": false` and test all features. If something breaks, narrow the scope to specific directories instead.

---

## Sources

### Primary (HIGH confidence)
- [Tauri v2 CSP Documentation](https://v2.tauri.app/security/csp/) -- CSP configuration format, directive support
- [Tauri v2 Security Config Reference](https://v2.tauri.app/reference/config/#securityconfig) -- Full security config schema
- [Tauri v2 Capabilities Documentation](https://v2.tauri.app/security/capabilities/) -- Capability/permission model
- [@monaco-editor/react npm](https://www.npmjs.com/package/@monaco-editor/react) -- Local bundling support (v4.4.0+)
- Codebase analysis: `tauri.conf.json`, `default.json`, `monacoTheme.ts`, `NugetPackageViewer.tsx`, `MarkdownImage.tsx`, `index.html`

### Secondary (MEDIUM confidence)
- [VS Code Extension Runtime Security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security) -- Publisher trust model
- [VS Code Workspace Trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust) -- Trust boundary design
- [Microsoft Secure by Design UX Toolkit](https://microsoft.design/articles/secure-by-design-a-ux-toolkit/) -- Security UX principles
- [Toptal UX Security Overview](https://www.toptal.com/designers/product-design/ux-security) -- Security UX patterns

### Tertiary (LOW confidence)
- [Keycloak Issue #32901](https://github.com/keycloak/keycloak/issues/32901) -- Monaco CSP conflict reports (community evidence)
- [Medium: Privacy-First UX](https://medium.com/@harsh.mudgal_27075/privacy-first-ux-design-systems-for-trust-9f727f69a050) -- General privacy UX patterns

---

## Metadata

**Confidence breakdown:**
- CSP impact analysis: HIGH -- Verified against actual codebase with grep/read of every external dependency
- Monaco fix strategy: HIGH -- Verified via official @monaco-editor/react documentation
- NuGet proxy pattern: HIGH -- Pattern already proven in codebase (gitignore.rs)
- Extension security UX: MEDIUM -- Based on VS Code research, actual implementation TBD
- Framer-motion/WebGL compat: MEDIUM -- Standard practice but needs implementation-time verification

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days -- stable domain, Tauri v2 is mature)
