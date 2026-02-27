# FlowForge

> **A modern, opinionated Git client that makes Gitflow workflows a first-class citizen.**

<!-- Badges: Row 1 — Identity -->
[![Atypical-Consulting - FlowForge](https://img.shields.io/static/v1?label=Atypical-Consulting&message=FlowForge&color=blue&logo=github)](https://github.com/Atypical-Consulting/FlowForge)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.70+-purple?logo=rust)](https://www.rust-lang.org/)
[![stars - FlowForge](https://img.shields.io/github/stars/Atypical-Consulting/FlowForge?style=social)](https://github.com/Atypical-Consulting/FlowForge)
[![forks - FlowForge](https://img.shields.io/github/forks/Atypical-Consulting/FlowForge?style=social)](https://github.com/Atypical-Consulting/FlowForge)

<!-- Badges: Row 2 — Activity -->
[![GitHub tag](https://img.shields.io/github/tag/Atypical-Consulting/FlowForge?include_prereleases=&sort=semver&color=blue)](https://github.com/Atypical-Consulting/FlowForge/releases/)
[![issues - FlowForge](https://img.shields.io/github/issues/Atypical-Consulting/FlowForge)](https://github.com/Atypical-Consulting/FlowForge/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/Atypical-Consulting/FlowForge)](https://github.com/Atypical-Consulting/FlowForge/pulls)
[![GitHub last commit](https://img.shields.io/github/last-commit/Atypical-Consulting/FlowForge)](https://github.com/Atypical-Consulting/FlowForge/commits/main)

<!-- Badges: Row 3 — Quality -->
[![Docs](https://github.com/Atypical-Consulting/FlowForge/actions/workflows/docs.yml/badge.svg)](https://github.com/Atypical-Consulting/FlowForge/actions/workflows/docs.yml)
[![Release](https://github.com/Atypical-Consulting/FlowForge/actions/workflows/release.yml/badge.svg)](https://github.com/Atypical-Consulting/FlowForge/actions/workflows/release.yml)

---

![FlowForge Screenshot](docs/screenshot.png)

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## The Problem

Most Git GUIs treat Gitflow as an afterthought -- buried in menus or requiring manual branch naming. Developers end up memorizing naming conventions, juggling terminal commands, and hoping they picked the right base branch. The result is friction that discourages teams from adopting a structured branching strategy.

## The Solution

**FlowForge** puts Gitflow front and center with a dedicated desktop app that makes branching, releasing, and hotfixing intuitive. Start a feature, release, or hotfix with a single click -- FlowForge handles the naming, the base branch, and the merge targets so you can focus on writing code.

## Features

- **Gitflow-First Design** - Start features, releases, and hotfixes with a single click. FlowForge understands your branching strategy.
- **Visual Topology** - See your commit history as an interactive graph with branch relationships clearly displayed.
- **Staging Area** - Stage individual files or hunks with a clean, intuitive interface.
- **Conventional Commits** - Built-in support for conventional commit format with validation and type selection.
- **Branch Management** - Create, switch, merge, and delete branches without leaving the app.
- **Stash Operations** - Save and restore work-in-progress with full stash management.
- **Tag Support** - Create and manage both lightweight and annotated tags.
- **Worktree Management** - Work on multiple branches simultaneously with git worktree support.
- **Beautiful Theme** - Catppuccin Mocha color scheme throughout for a consistent, eye-friendly experience.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri 2 |
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Rust |
| Git Engine | libgit2 via git2-rs (no shell-out) |
| State Management | Zustand + TanStack Query |
| Visualization | React Flow + dagre |
| Animations | Framer Motion |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.70
- [pnpm](https://pnpm.io/) (recommended) or npm

#### Platform-specific dependencies

**macOS:**
```bash
xcode-select --install
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

**Windows:**
- Visual Studio 2022 with C++ build tools
- WebView2 (included in Windows 11, or install from Microsoft)

### Installation

**Option 1 -- Pre-built Releases** *(recommended)*

Download the latest release from the [Releases page](https://github.com/Atypical-Consulting/FlowForge/releases).

- **macOS (Apple Silicon):** Download the `.dmg` file and drag FlowForge to your Applications folder.
- **Windows:** Download the `.msi` installer and run it.
- **Linux:** Download the `.deb` package or `.AppImage` file.

> **macOS users:** FlowForge is not code-signed with an Apple Developer certificate. macOS Gatekeeper will show a "damaged" error when you first open the app. To fix this, run the following command in Terminal after installing:
> ```bash
> xattr -cr /Applications/FlowForge.app
> ```

**Option 2 -- From Source**

```bash
git clone https://github.com/Atypical-Consulting/FlowForge.git
cd FlowForge
pnpm install
pnpm tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Usage

### Development Mode

```bash
# Start the full Tauri app with hot reload
pnpm tauri dev

# Run the frontend only (without Tauri shell)
pnpm dev
```

### Gitflow Workflows

1. **Start a Feature** -- Click the "New Feature" button, enter a name, and FlowForge creates `feature/<name>` from `develop`.
2. **Start a Release** -- Click "New Release", enter a version, and FlowForge creates `release/<version>` from `develop`.
3. **Start a Hotfix** -- Click "New Hotfix", enter a version, and FlowForge creates `hotfix/<version>` from `main`.
4. **Finish** -- When done, FlowForge merges the branch back into the correct targets and cleans up.

### Quality Tools

```bash
# Run tests
pnpm test

# Type check
pnpm type-check

# Lint and format
pnpm check
```

## Architecture

```
┌─────────────────────────────────────────────┐
│              React Frontend                 │
│   (React 19 + Tailwind + Zustand + R.Flow) │
├─────────────────────────────────────────────┤
│             Tauri Bridge (IPC)              │
│          (Commands + Events + FS)           │
├─────────────────────────────────────────────┤
│              Rust Backend                   │
│          (Command Handlers + Logic)         │
├─────────────────────────────────────────────┤
│            libgit2 (git2-rs)               │
│       (Repo / Branch / Commit / Diff)       │
└─────────────────────────────────────────────┘
```

### Project Structure

```
FlowForge/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── stores/             # Zustand state stores
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utilities
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   └── git/            # Git operations (libgit2)
│   └── Cargo.toml
├── docs/                   # VitePress documentation site
├── package.json
└── tauri.conf.json
```

## Roadmap

- [ ] Release management wizard with changelog generation
- [ ] Hotfix wizard with cherry-pick support
- [ ] Team collaboration features (shared branch policies)
- [ ] Custom branch naming policies
- [ ] Interactive rebase visualizer
- [ ] Built-in diff and merge conflict resolver

> Want to contribute? Pick any roadmap item and open a PR!

## Stats

<!-- Get your hash from https://repobeats.axiom.co -->
![Alt](https://repobeats.axiom.co/api/embed/00000000000000000000000000000000000000000000.svg "Repobeats analytics image")

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using [conventional commits](https://www.conventionalcommits.org/) (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE) &copy; 2026 [Atypical Consulting](https://atypical.garry-ai.cloud)

## Acknowledgments

- [Catppuccin](https://github.com/catppuccin/catppuccin) for the beautiful color palette
- [Tauri](https://tauri.app/) for the amazing desktop framework
- [libgit2](https://libgit2.org/) for robust Git operations

---

Built with care by [Atypical Consulting](https://atypical.garry-ai.cloud) -- opinionated, production-grade open source.

[![Contributors](https://contrib.rocks/image?repo=Atypical-Consulting/FlowForge)](https://github.com/Atypical-Consulting/FlowForge/graphs/contributors)
