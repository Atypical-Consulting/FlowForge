# Quick Task 37: App Toolbar Menus

## What Was Done

Added a desktop-style menu bar to the FlowForge header with four dropdown menus (File, View, Repository, Branch) that provide categorized, discoverable access to common actions.

## Changes

### New Files (8)
- `src/components/menu-bar/MenuBar.tsx` — Top-level container with ARIA menubar role
- `src/components/menu-bar/MenuBarItem.tsx` — Menu trigger button with hover-to-switch
- `src/components/menu-bar/MenuDropdown.tsx` — Animated dropdown with framer-motion slideDown
- `src/components/menu-bar/MenuItem.tsx` — Action row (icon, label, shortcut, disabled state)
- `src/components/menu-bar/MenuDivider.tsx` — Visual separator between groups
- `src/components/menu-bar/useMenuBar.ts` — State management hook (keyboard nav, click-outside)
- `src/components/menu-bar/menu-definitions.ts` — Static menu structure referencing command IDs
- `src/components/menu-bar/index.ts` — Barrel export

### Modified Files (3)
- `src/commands/navigation.ts` — 3 new commands: show-changes, show-history, show-branches
- `src/hooks/useKeyboardShortcuts.ts` — 6 new shortcuts: Cmd+N, Cmd+Shift+O, Cmd+1, Cmd+2, Cmd+B, Cmd+Shift+N
- `src/components/Header.tsx` — MenuBar integrated between app title and repo switcher

## Menu Contents

| Menu | Items |
|------|-------|
| **File** | New Repository, Open Repository, Clone Repository, Close Repository, Preferences |
| **View** | Changes, History, Show Branches, Command Palette, Toggle Theme, Extension Manager |
| **Repository** | Fetch, Pull, Push, Stage All, Toggle Amend, Refresh All |
| **Branch** | New Branch |

## Key Design Decisions

- Custom React menus (not Tauri native) for consistency with existing Catppuccin UI
- All items invoke `executeCommand()` from command registry — zero action duplication
- Disabled items shown grayed out (not hidden) for discoverability
- Hover-to-switch between menus when one is already open
- Auto-close when command palette opens
- slideDown animation with reduced-motion support

## Verification

- TypeScript: `tsc --noEmit` passes (ignoring pre-existing bindings.ts)
- Build: `npm run build` succeeds
- Tests: 233/233 pass (3 pre-existing Monaco mock failures in test suites)
- Commit: `9ab8014`
