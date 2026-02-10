# ExtensionAPI Reference

Each extension receives its own `ExtensionAPI` instance when activated. All registrations are automatically namespaced with `ext:{extensionId}:` and tracked for atomic cleanup on deactivation.

Source: `src/extensions/ExtensionAPI.ts`

## API Method Classification

| Method | Sandbox Safety | Description |
|--------|---------------|-------------|
| `registerBlade(config)` | requires-trust | Register a blade type with React component |
| `registerCommand(config)` | requires-trust | Register a command palette entry |
| `contributeToolbar(config)` | requires-trust | Add a toolbar action |
| `contributeContextMenu(config)` | requires-trust | Add a context menu item |
| `contributeSidebarPanel(config)` | requires-trust | Add a sidebar panel section |
| `contributeStatusBar(config)` | requires-trust | Add a status bar widget |
| `onDidGit(operation, handler)` | sandbox-safe | Listen for post-operation git events |
| `onWillGit(operation, handler)` | sandbox-safe | Listen for pre-operation git events (can cancel) |
| `onDispose(disposable)` | sandbox-safe | Register cleanup callback |
| `cleanup()` | internal | Remove all registrations (called by host) |

Methods marked **requires-trust** accept React components, closures, or store references that cannot be serialized across a Worker boundary. Only `built-in` and `user-trusted` extensions may call these methods.

Methods marked **sandbox-safe** use serializable inputs/outputs and can be proxied to Worker-based sandboxed extensions via `postMessage`.

## Automatic Namespacing

All IDs are prefixed with `ext:{extensionId}:` automatically. For example, an extension with ID `github` registering a blade type `sign-in` produces the blade type `ext:github:sign-in`.

Built-in extensions that need to replace core blade types can set `coreOverride: true` in the blade config to skip namespacing.

## Blade Registration

```typescript
api.registerBlade({
  type: "my-view",           // becomes ext:{id}:my-view
  title: "My View",
  component: MyComponent,    // React component
  singleton: true,           // optional: only one instance allowed
  lazy: true,                // optional: lazy-loaded
  wrapInPanel: true,         // optional: wrap in panel chrome
  showBack: true,            // optional: show back button
  coreOverride: false,       // optional: skip namespace prefix
});
```

**Config interface:** `ExtensionBladeConfig`
**Sandbox safety:** requires-trust (accepts `ComponentType`)

## Commands

```typescript
api.registerCommand({
  id: "do-thing",            // becomes ext:{id}:do-thing
  title: "Do The Thing",
  category: "My Extension",  // defaults to extensionId
  action: () => { /* ... */ },
  icon: MyIcon,              // optional: LucideIcon
  enabled: () => true,       // optional: dynamic enable/disable
  shortcut: "mod+shift+t",   // optional: keyboard shortcut
});
```

**Config interface:** `ExtensionCommandConfig`
**Sandbox safety:** requires-trust (accepts action callback with closure access)

## Toolbar

```typescript
api.contributeToolbar({
  id: "my-button",           // becomes ext:{id}:my-button
  label: "My Button",
  icon: MyIcon,              // LucideIcon
  group: "tools",            // toolbar group: "app" | "vcs" | "views" | "tools"
  priority: 50,              // sort order within group
  execute: () => { /* ... */ },
  when: () => true,          // optional: visibility condition
});
```

**Config interface:** `ExtensionToolbarConfig`
**Sandbox safety:** requires-trust (accepts React render functions and LucideIcon)

## Context Menu

```typescript
api.contributeContextMenu({
  id: "my-action",           // becomes ext:{id}:my-action
  label: "My Action",
  location: "branch-list",   // where the menu appears
  execute: (context) => { /* ... */ },
  when: (context) => true,   // optional: visibility condition
  priority: 50,              // optional: sort order
});
```

**Config interface:** `ExtensionContextMenuConfig`
**Sandbox safety:** requires-trust (accepts callback functions with closure access)

## Sidebar Panels

```typescript
api.contributeSidebarPanel({
  id: "my-panel",            // becomes ext:{id}:my-panel
  title: "My Panel",
  icon: MyIcon,              // LucideIcon
  component: MyPanelComponent,
  priority: 50,              // clamped to 1-69 (70-100 reserved for core)
  defaultOpen: false,        // optional
});
```

**Config interface:** `ExtensionSidebarPanelConfig`
**Sandbox safety:** requires-trust (accepts React ComponentType)

## Status Bar

```typescript
api.contributeStatusBar({
  id: "my-status",           // becomes ext:{id}:my-status
  alignment: "left",         // "left" or "right"
  priority: 50,              // clamped to 1-89 (90-100 reserved for core)
  renderCustom: () => <MyWidget />,
  when: () => true,          // optional: visibility condition
});
```

**Config interface:** `ExtensionStatusBarConfig`
**Sandbox safety:** requires-trust (accepts React render function)

## Git Hooks

```typescript
// Post-operation: fires after git operation completes
api.onDidGit("commit", (context) => {
  console.log("Committed:", context.commitMessage);
});

// Pre-operation: fires before, can cancel
api.onWillGit("commit", (context) => {
  if (!isValid(context)) {
    return { cancel: true, reason: "Validation failed" };
  }
});
```

**Supported operations:** `commit`, `push`, `pull`, `fetch`, `merge`, `checkout`, `rebase`, `stash`, `tag`
**Sandbox safety:** sandbox-safe (serializable `GitHookContext` input/output)

## Lifecycle

### onDispose

Register cleanup callbacks that run when the extension is deactivated. Supports both function and `{ dispose }` object patterns. Disposables execute in reverse registration order (LIFO).

```typescript
const subscription = someStore.subscribe(handler);
api.onDispose(() => subscription.unsubscribe());
```

**Sandbox safety:** sandbox-safe

### cleanup()

Called internally by the ExtensionHost during deactivation or on activation failure. Removes all registrations in this order:

1. Blades
2. Commands
3. Toolbar actions
4. Context menu items
5. Sidebar panels
6. Status bar items
7. Git hook subscriptions
8. Disposables (reverse order / LIFO)

After cleanup, all tracking arrays are reset so the API instance can be reused on re-activation.
