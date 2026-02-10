# Extension Manifest Schema

Extensions ship a `flowforge.extension.json` file in their root directory. The ExtensionHost discovers and parses these manifests during extension discovery.

Rust source: `src-tauri/src/extensions/manifest.rs`
TypeScript types: `src/extensions/extensionManifest.ts`

## Example

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "Adds custom tooling to FlowForge",
  "apiVersion": "1",
  "main": "index.js",
  "trustLevel": "sandboxed",
  "contributes": {
    "blades": [
      { "type": "my-blade", "title": "My Blade", "singleton": true }
    ],
    "commands": [
      { "id": "do-thing", "title": "Do Thing", "category": "My Ext" }
    ],
    "toolbar": [
      { "id": "my-btn", "label": "My Button", "group": "tools", "priority": 50 }
    ]
  },
  "permissions": ["git-operations"]
}
```

## Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `string` | yes | - | Unique identifier for the extension |
| `name` | `string` | yes | - | Human-readable display name |
| `version` | `string` | yes | - | Semantic version (e.g. `"1.0.0"`) |
| `description` | `string` | no | `null` | Longer description of the extension |
| `apiVersion` | `string` | yes | - | Target API version (must be `"1"`) |
| `main` | `string` | yes | - | Relative path to JavaScript entry point |
| `trustLevel` | `string` | no | `"sandboxed"` | Trust level: `"built-in"`, `"user-trusted"`, or `"sandboxed"` |
| `contributes` | `object` | no | `null` | Contribution declarations (see below) |
| `permissions` | `string[]` | no | `null` | Requested permission identifiers |
| `basePath` | `string` | no | `null` | Set by discovery; not present in JSON |

## API Version

The `apiVersion` field must match the host's current API version (currently `"1"`). Extensions with a mismatched API version are rejected at discovery time with an error status.

## Trust Level

The `trustLevel` field controls what API methods the extension can call:

- `"built-in"` -- Set automatically by `registerBuiltIn()` for bundled extensions. Full API access.
- `"user-trusted"` -- User-installed extensions loaded via the asset protocol. Full API access.
- `"sandboxed"` -- Default for third-party extensions. Restricted to sandbox-safe methods only (future Worker isolation).

When the field is omitted from the manifest JSON, it defaults to `"sandboxed"`.

See [Trust Levels](./trust-levels.md) for the full trust architecture.

## Contributes

The `contributes` object declares what the extension registers. All fields are optional.

### `contributes.blades`

Array of blade type declarations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | yes | Blade type identifier |
| `title` | `string` | yes | Display title |
| `singleton` | `boolean` | no | Only one instance allowed |

### `contributes.commands`

Array of command declarations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | Command identifier |
| `title` | `string` | yes | Display title in command palette |
| `category` | `string` | no | Category for grouping |

### `contributes.toolbar`

Array of toolbar action declarations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | Toolbar action identifier |
| `label` | `string` | yes | Display label |
| `group` | `string` | no | Toolbar group (`"vcs"`, `"tools"`, etc.) |
| `priority` | `number` | no | Sort order within group |

## Permissions

The `permissions` array declares what system capabilities the extension needs. This field is reserved for future use. Currently no permissions are enforced at runtime.

## Discovery

Extensions are discovered from `{repoPath}/.flowforge/extensions/`. The host scans for `flowforge.extension.json` files, parses them, validates the API version, and registers them in the `discovered` state. Activation happens separately via `activateExtension()` or `activateAll()`.
