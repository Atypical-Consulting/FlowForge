# Quick Task 35: Implement 10 High-Value Features

## Description
Implement 10 high-value, low-effort features across two categories: general Git UX and extension system enhancements.

## Features

### General Git UX (5)
1. **Copy Commit SHA to Clipboard** — Context menu + copy button in commit details
2. **Ahead/Behind Indicator** — Show ↑N ↓N for branches with upstream tracking
3. **Bulk File Staging** — Multi-select checkboxes with Stage/Unstage Selected buttons
4. **Quick Amend Commit** — Already implemented (discovered during execution)
5. **Filter History by Author** — Author dropdown in commit history view

### Extension System (5)
6. **Extension Detail Blade** — Full info blade with contribution introspection
7. **Extension Settings Storage API** — Namespaced key-value persistence for extensions
8. **Inter-Extension Event Bus** — Pub/sub communication between extensions
9. **onDidNavigate Hook** — Blade lifecycle awareness for extensions
10. **Contribution Badges** — Dynamic count pills on sidebar panels and toolbar items

## Execution Strategy
- Wave 1 (parallel): #1, #3, #5, #6, #7 — no file overlap
- Wave 2 (parallel): #2, #4, #8 — then #9 after #8 (shared ExtensionAPI.ts)
- Wave 3: #10 (depends on #7, #8, #9)
- Team of agents with conflict-aware wave scheduling
