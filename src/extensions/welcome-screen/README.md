# Welcome Screen Extension

The landing experience when no repository is open. Provides Open/Clone actions, recent repositories list, drag-and-drop folder opening, and an animated gradient background.

## Features

- **Open Repository** - Native folder picker dialog with git repository detection
- **Clone Repository** - Inline clone form for git URLs
- **Recent Repositories** - Quick access to previously opened repos
- **Drag & Drop** - Drop a folder to open it as a repository
- **Git Init Integration** - Detects non-git folders and offers initialization (delegates to init-repo extension when available)
- **Keyboard Shortcuts** - `Cmd/Ctrl+O` to open, supports command palette overlays

## Architecture

The welcome screen is rendered directly from the blade registry when no repo is open (not via the navigation machine stack). It watches the navigation machine's blade stack to support overlay blades (e.g., Settings or Extension Manager opened via command palette while on the welcome screen).

## File Structure

```
welcome-screen/
├── manifest.json
├── index.ts                    # Extension entry point
├── README.md
├── blades/
│   └── WelcomeBlade.tsx        # Blade wrapper with navigation overlay support
└── components/
    ├── index.ts
    ├── WelcomeContent.tsx      # Main welcome screen UI
    ├── AnimatedGradientBg.tsx  # Animated gradient background
    ├── GitInitBanner.tsx       # Banner for non-git folders (init-repo available)
    ├── GitInitFallbackBanner.tsx # Banner for non-git folders (init-repo unavailable)
    └── RecentRepos.tsx         # Recent repositories list
```
