# FlowForge Technology Stack

> **Research Dimension**: Stack  
> **Project**: FlowForge — AI-native Git client (Tauri + Rust + React)  
> **Last Updated**: 2026-02-03

---

## Executive Summary

FlowForge should use Tauri 2.x with a Rust backend built on git2-rs (libgit2 bindings) and a React 19 frontend. The stack prioritizes performance, type safety, and cross-platform reliability.

---

## Rust Backend

### Core Framework

| Crate | Version | Purpose | Confidence |
|-------|---------|---------|------------|
| `tauri` | 2.10.1 | Application framework | HIGH |
| `git2` | 0.20.4 | Git operations (libgit2 bindings) | HIGH |
| `tokio` | 1.49.0 | Async runtime | HIGH |
| `serde` | 1.0.228 | Serialization | HIGH |
| `serde_json` | 1.x | JSON serialization | HIGH |

### Git & File System

| Crate | Version | Purpose | Confidence |
|-------|---------|---------|------------|
| `git2` | 0.20.4 | Primary Git operations | HIGH |
| `notify` | 8.2.0 | Cross-platform file watching | HIGH |
| `walkdir` | 2.5.0 | Directory traversal | HIGH |

### State Machine & Validation

| Crate | Version | Purpose | Confidence |
|-------|---------|---------|------------|
| `statig` | 0.3.x | Hierarchical state machines (Gitflow) | MEDIUM |
| `regex` | 1.11.x | Conventional commit parsing | HIGH |

### Error Handling & Utilities

| Crate | Version | Purpose | Confidence |
|-------|---------|---------|------------|
| `thiserror` | 2.0.18 | Error derivation | HIGH |
| `anyhow` | 1.0.100 | Error context | HIGH |
| `tracing` | 0.1.x | Logging/diagnostics | HIGH |

### Type-Safe IPC

| Crate | Version | Purpose | Confidence |
|-------|---------|---------|------------|
| `tauri-specta` | 2.0.0-rc.21 | TypeScript binding generation | MEDIUM |
| `specta` | 2.x | Type export | MEDIUM |

**Note on tauri-specta**: Despite RC status, it eliminates manual type synchronization between Rust and TypeScript. The alternative (manual types) is error-prone.

---

## React Frontend

### Core

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `vite` | 6.x | Build tool | HIGH |
| `react` | 19.x | UI framework | HIGH |
| `react-dom` | 19.x | DOM rendering | HIGH |
| `typescript` | 5.x | Type safety | HIGH |

### State Management

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `zustand` | 5.0.10 | Global state | HIGH |
| `@tanstack/react-query` | 5.90.x | Server state caching | HIGH |

**Why Zustand over Redux**: 3KB bundle, hook-based API, no providers needed. Redux boilerplate is overkill for desktop apps.

### Routing

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `react-router` | 7.12.x | Navigation | HIGH |

### UI Components

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `tailwindcss` | 4.x | Styling | HIGH |
| `shadcn/ui` | latest | Component primitives | HIGH |
| `@radix-ui/*` | latest | Accessible primitives | HIGH |
| `lucide-react` | latest | Icons | HIGH |

**Why shadcn/ui**: Copy-paste components = full ownership. Radix primitives provide WCAG 2.1 AA compliance.

### Visualization

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `@xyflow/react` | 12.x | Graph/DAG visualization | HIGH |
| `d3` | 7.x | Custom visualizations | MEDIUM |

### Editor

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `@monaco-editor/react` | 4.7.0 | Diff viewer, commit editor | HIGH |

### Development

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `biome` | 1.x | Linting + formatting | HIGH |
| `vitest` | 3.x | Testing | HIGH |

**Why Biome over ESLint/Prettier**: 10-20x faster, single tool, written in Rust.

---

## What NOT to Use

### Rejected Alternatives

| Technology | Reason |
|------------|--------|
| **Electron** | 150MB+ binary, 500MB+ memory baseline |
| **gitoxide/gix** | Not mature enough for v1 (reassess for v2) |
| **Redux** | Excessive boilerplate for desktop apps |
| **Create React App** | Deprecated, Vite is the standard |
| **Styled Components** | Runtime CSS-in-JS overhead |
| **Jest** | Vitest is faster and Vite-native |
| **MUI/Chakra UI** | Heavy bundles, harder to customize |

### git2-rs vs gitoxide

**Decision**: Use git2-rs for v1, evaluate gitoxide for v2+.

**Rationale**:
- git2-rs is battle-tested (libgit2 has 12+ years of production use)
- gitoxide clone benchmarks show ~60x slower than git2 in some scenarios
- gitoxide feature parity is growing but not complete
- git2-rs has better documentation and community support

---

## Cargo.toml Template

```toml
[package]
name = "flowforge"
version = "0.1.0"
edition = "2024"

[dependencies]
tauri = { version = "2.10", features = ["tray-icon", "dialog"] }
tauri-specta = { version = "2.0.0-rc.21", features = ["typescript"] }
specta = "2"
git2 = "0.20"
tokio = { version = "1.49", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1"
notify = "8.2"
walkdir = "2.5"
statig = "0.3"
regex = "1.11"
thiserror = "2.0"
anyhow = "1.0"
tracing = "0.1"
tracing-subscriber = "0.3"

[build-dependencies]
tauri-build = "2.10"
```

---

## package.json Template

```json
{
  "name": "flowforge",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "check": "biome check --write .",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.12.0",
    "zustand": "^5.0.10",
    "@tanstack/react-query": "^5.90.0",
    "@xyflow/react": "^12.0.0",
    "@monaco-editor/react": "^4.7.0",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

---

## Quality Gate Verification

- [x] Versions are current (verified against docs.rs, GitHub releases, npm)
- [x] Rationale explains WHY, not just WHAT
- [x] Confidence levels assigned to each recommendation

---

## Sources

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [git2-rs GitHub](https://github.com/rust-lang/git2-rs)
- [tauri-specta GitHub](https://github.com/specta-rs/tauri-specta)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [React Flow (xyflow)](https://reactflow.dev/)
- [Biome](https://biomejs.dev/)
