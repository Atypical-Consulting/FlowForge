# Conventional Commits

::: info Upcoming Feature
The dedicated Conventional Commit blade is currently in development. This page describes the planned functionality. See [Conventional Commits concept](/concepts/conventional-commits) for the specification itself.
:::

FlowForge's Conventional Commit blade provides a structured editor that guides you through writing commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Structured Message Editor

Instead of a freeform text area, the blade breaks the commit message into discrete fields:

- **Type** — Select from a dropdown of standard types (`feat`, `fix`, `docs`, `refactor`, etc.).
- **Scope** — Optional field for the area of the codebase affected (e.g., `staging`, `topology`).
- **Description** — A short imperative summary of the change.
- **Body** — Optional long-form explanation of *why* the change was made.
- **Breaking change** — Toggle to mark the commit as a breaking change, with a field for the migration note.

## Live Preview

As you fill in the fields, a preview pane assembles the final commit message in real time:

```
feat(staging): add drag-and-drop file ordering

Allow users to reorder staged files by dragging them
into the desired commit order.

BREAKING CHANGE: Staged file order is now persisted.
```

This ensures the message is correctly formatted before you commit.

## Commit Actions

The blade offers three commit actions:

| Action | Description |
|--------|-------------|
| **Commit** | Create a commit with the staged changes and the composed message. |
| **Commit & Push** | Commit and immediately push to the remote. |
| **Amend** | Replace the previous commit's message (and optionally its contents). |

## Templates

Save frequently used type/scope combinations as templates for quick reuse. Templates are stored per-repository and appear as selectable presets at the top of the blade.

## Learn More

- [Conventional Commits specification](/concepts/conventional-commits) — understand the format, types, and versioning rules.
- [Staging & Commits](/features/staging) — the general-purpose staging workflow that pairs with this blade.
