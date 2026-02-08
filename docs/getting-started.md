# Getting Started

FlowForge is a desktop Git client built with Tauri. It provides a visual interface for everyday Git operations with first-class Gitflow support.

## Prerequisites

- **Node.js** 20 or later
- **Rust** (stable toolchain)
- **Git** installed and available on your `PATH`
- A platform supported by Tauri (macOS, Windows, or Linux)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/phmatray/FlowForge.git
cd FlowForge
npm install
```

## Running in Development

Start the Tauri development server:

```bash
npm run tauri dev
```

This launches both the Vite frontend dev server and the Tauri native window. Changes to React components are hot-reloaded automatically.

## Building for Production

Create a release build:

```bash
npm run tauri build
```

The output binary is placed in `src-tauri/target/release/`.

## Opening Your First Repository

1. Launch FlowForge.
2. Press **Cmd/Ctrl+O** or click **Open Repository** on the welcome screen.
3. Select a folder containing a Git repository.
4. FlowForge loads the repository status, branches, and commit history.

If the repository has not been initialized with Gitflow, navigate to the Gitflow panel and click **Initialize Gitflow** to set up the standard branch structure.

## Next Steps

- Learn about [Gitflow workflows](/features/gitflow) for managing features, releases, and hotfixes.
- Explore [staging and commits](/features/staging) for day-to-day changes.
- See all available [keyboard shortcuts](/reference/keyboard-shortcuts) for fast navigation.
