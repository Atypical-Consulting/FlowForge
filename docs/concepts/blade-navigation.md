# Blade Navigation

FlowForge uses a **blade-based navigation model** to organize its interface. Each blade is a focused panel that slides in from the right, forming a stack of contextual views.

## What Is a Blade?

A blade is a self-contained panel that occupies the main content area. Blades stack on top of each other: when you open a new blade it pushes onto the stack, and when you close it the previous blade is revealed.

```
┌──────────┬──────────┬──────────┐
│          │          │          │
│  Blade 1 │  Blade 2 │  Blade 3 │
│  (root)  │          │ (active) │
│          │          │          │
└──────────┴──────────┴──────────┘
              ← stack grows →
```

The active blade is always the rightmost panel. Earlier blades remain visible at narrower widths to provide context.

## Navigation Actions

FlowForge's navigation state machine supports four actions:

| Action | Effect |
|--------|--------|
| **Push** | Add a new blade to the top of the stack. |
| **Pop** | Remove the active blade and return to the previous one. |
| **Replace** | Swap the active blade for a different one without changing stack depth. |
| **Reset** | Clear the entire stack and start fresh with a single blade. |

These actions are managed by an XState state machine that ensures transitions are predictable and testable.

## Unsaved Changes Protection

If a blade contains a form with unsaved changes, FlowForge prevents accidental navigation away. Attempting to pop or replace a dirty blade triggers a confirmation dialog, giving you the option to discard changes or stay on the current blade.

## Direction-Aware Animations

Blade transitions use direction-aware animations powered by Framer Motion:

- **Push** slides the new blade in from the right.
- **Pop** slides the current blade out to the right, revealing the one beneath.

When the user prefers reduced motion (`prefers-reduced-motion: reduce`), animations are replaced with instant transitions.

## Singleton Blades

Some blades are **singletons** — only one instance can exist in the stack at a time. If you try to open a singleton blade that is already present, FlowForge navigates to the existing instance instead of creating a duplicate. Examples include:

- **Settings** — global application preferences.
- **Changelog** — version history and release notes.

## Process Switching

FlowForge defines top-level **processes** that each own a blade stack. The two primary processes are:

- **Staging** — for everyday commit workflows (changes, staging, commit messages).
- **Topology** — for visualizing and navigating the commit graph.

Switching between processes replaces the entire blade stack with the target process's root blade. Each process remembers its own stack, so switching back restores your previous position.

## How It Connects

The blade model underpins every panel you interact with in FlowForge. Understanding the stack metaphor helps you navigate efficiently — use the back button or **Escape** to pop, and click deeper into detail views to push.

See [Repository Initialization](/features/init-repo) and [Staging & Commits](/features/staging) for examples of blades in action.
