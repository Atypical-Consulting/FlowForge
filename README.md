# FlowForge

A modern, opinionated Git client built with Tauri and React that makes Gitflow workflows a first-class citizen.

![FlowForge Screenshot](docs/screenshot.png)

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

- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Backend**: Tauri 2, Rust
- **Git Operations**: libgit2 via git2-rs (no shell-out)
- **State Management**: Zustand + TanStack Query
- **Visualization**: React Flow + dagre
- **Animations**: Framer Motion

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.70
- [pnpm](https://pnpm.io/) (recommended) or npm

### Platform-specific dependencies

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

## Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/phmatray/git-ai.git
cd git-ai
```

2. Install dependencies:
```bash
pnpm install
```

3. Run in development mode:
```bash
pnpm tauri dev
```

4. Build for production:
```bash
pnpm tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Development

```bash
# Start development server with hot reload
pnpm tauri dev

# Run frontend only (without Tauri)
pnpm dev

# Type check
pnpm type-check

# Lint and format
pnpm lint
pnpm format
```

## Project Structure

```
git-ai/
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
├── package.json
└── tauri.conf.json
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using conventional commits (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Catppuccin](https://github.com/catppuccin/catppuccin) for the beautiful color palette
- [Tauri](https://tauri.app/) for the amazing desktop framework
- [libgit2](https://libgit2.org/) for robust Git operations
