# Extension Trust Levels

FlowForge uses a three-tier trust model to control extension API access and execution isolation.

Source: `src/extensions/extensionTypes.ts`, `src/extensions/sandbox/sandbox-api-surface.ts`

## Trust Model

| Level | Label | API Access | Execution Environment | Examples |
|-------|-------|-----------|----------------------|----------|
| `built-in` | Built-in | Full ExtensionAPI | Main thread | GitHub, Content Viewers, Conventional Commits, Gitflow |
| `user-trusted` | Trusted | Full ExtensionAPI | Main thread | User-installed extensions |
| `sandboxed` | Sandboxed | sandbox-safe methods only | Worker (future) | Third-party extensions (v1.7.0+) |

## How Trust Level is Determined

### Built-in

Set automatically by `registerBuiltIn()` in `ExtensionHost.ts`. Built-in extensions are bundled with the application and activated at startup. Their `trustLevel` is always `"built-in"` regardless of any manifest field.

### User-trusted

Applied to extensions installed by the user and loaded from disk via the Tauri asset protocol (`convertFileSrc`). These extensions have full API access since the user explicitly chose to install them.

### Sandboxed

The default trust level for extensions discovered from `flowforge.extension.json` manifests. When the `trustLevel` field is omitted, it defaults to `"sandboxed"`. Future versions will execute sandboxed extensions in a Worker thread with restricted API access.

## Sandbox-Safe vs Requires-Trust

Methods are classified based on whether their inputs and outputs can be serialized across a Worker boundary.

### Sandbox-safe methods

These methods use serializable data only and can be proxied via `postMessage`:

- `onDidGit(operation, handler)` -- Listen for post-operation git events
- `onWillGit(operation, handler)` -- Listen for pre-operation git events (can cancel)
- `onDispose(disposable)` -- Register cleanup callback

### Requires-trust methods

These methods accept React components, closures, or store references that cannot cross a Worker boundary:

- `registerBlade(config)` -- Requires `ComponentType`
- `registerCommand(config)` -- Requires action callback with closure access
- `contributeToolbar(config)` -- Requires React render functions and `LucideIcon`
- `contributeContextMenu(config)` -- Requires callback functions with closure access
- `contributeSidebarPanel(config)` -- Requires React `ComponentType`
- `contributeStatusBar(config)` -- Requires React render function

See [ExtensionAPI Reference](./extension-api.md) for full method documentation.

## Worker Sandbox Architecture

The sandbox prototype (`src/extensions/sandbox/`) provides isolated execution for untrusted extensions using Web Workers and `MessagePort` communication.

### How it works

1. The `SandboxBridge` (host side) creates a Worker from the extension's entry point
2. Worker sends a `ready` handshake message on startup
3. API calls from the Worker are serialized as `{ type: "api-call", id, method, args }` messages
4. The host validates the method against the sandbox-safe list before executing
5. Results are sent back as `{ type: "api-response", id, result }` or `{ type: "api-error", id, error }`

### What cannot cross the Worker boundary

- React components (`ComponentType`, `ReactNode`)
- Closures with captured scope variables
- Zustand store references
- LucideIcon components
- DOM element references

These limitations are why `registerBlade`, `contributeToolbar`, and similar UI registration methods require trust.

## Design Tokens for Extensions

Extensions that render UI should use Catppuccin theme tokens for visual consistency.

### CSS Custom Properties

All colors are available as CSS custom properties:

```css
var(--ctp-base)        /* background */
var(--ctp-surface0)    /* elevated surface */
var(--ctp-surface1)    /* border, divider */
var(--ctp-surface2)    /* secondary border */
var(--ctp-text)        /* primary text */
var(--ctp-subtext0)    /* secondary text */
var(--ctp-subtext1)    /* tertiary text */
var(--ctp-overlay0)    /* placeholder text */
var(--ctp-blue)        /* primary accent */
var(--ctp-green)       /* success */
var(--ctp-red)         /* error, destructive */
var(--ctp-yellow)      /* warning */
var(--ctp-peach)       /* secondary accent */
var(--ctp-mauve)       /* tertiary accent */
```

### Tailwind Utility Classes

Use the `ctp-` prefix with Tailwind utilities:

```
bg-ctp-base       bg-ctp-surface0     bg-ctp-surface1
text-ctp-text     text-ctp-subtext0   text-ctp-overlay0
border-ctp-surface1   border-ctp-surface2
text-ctp-blue     text-ctp-green      text-ctp-red
```

These tokens automatically adapt to light/dark theme changes.
