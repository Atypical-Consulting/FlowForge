# Staging & Commits

FlowForge gives you fine-grained control over what goes into each commit, with a visual diff viewer and a streamlined commit workflow.

## Viewing Changes

The Changes panel lists all modified, added, and deleted files in your working directory. Each file shows its status icon and relative path. Click a file to view its diff in the editor pane.

## Staging Files

- **Stage a single file** by clicking the **+** button next to it.
- **Stage all files** with the toolbar button or the **Cmd/Ctrl+Shift+A** shortcut.
- **Unstage a file** by clicking the **-** button on a staged file.

Staged files appear in the upper section of the Changes panel, while unstaged files remain below.

## Writing Commits

Enter your commit message in the text area at the top of the Changes panel. The first line is treated as the commit summary. Press **Commit** or use the keyboard shortcut to create the commit.

### Amend Mode

Toggle amend mode with **Cmd/Ctrl+Shift+M** to modify the most recent commit. The previous commit message is loaded into the text area, and any staged changes are folded into the amended commit.

## Diff Viewer

The built-in diff viewer highlights added and removed lines with Catppuccin-themed colors. It supports:

- **Unified diff** layout for a compact view.
- **Syntax highlighting** for common file types.
- **Large file handling** with virtualized scrolling.

## Undo Last Commit

If you need to revert the last commit, use the **Undo** action in the toolbar. This performs a soft reset, preserving your changes in the working directory so you can re-commit after corrections.
