# Repository Initialization

FlowForge can create a brand-new Git repository from any folder on your machine. The **Init Repo** blade walks you through every step — from choosing a default branch name to generating a `.gitignore` and an optional first commit.

## Opening the Init Repo Blade

When you open a folder that is not yet a Git repository, FlowForge's welcome screen shows an **Initialize Repository** button. Clicking it pushes the Init Repo blade onto the navigation stack.

You can also reach it from the command palette with **Cmd/Ctrl+Shift+P** → *Initialize Repository*.

## Default Branch Name

The first field lets you set the initial branch name. FlowForge defaults to `main`, but you can type any valid branch name. This value is passed directly to `git init --initial-branch`.

## Project Type Detection

FlowForge scans the target folder and suggests a project type based on the files it finds. Detection is based on common markers:

| Marker File | Detected Type |
|-------------|---------------|
| `package.json` | Node.js |
| `Cargo.toml` | Rust |
| `pyproject.toml` / `setup.py` | Python |
| `go.mod` | Go |
| `*.sln` / `*.csproj` | .NET |
| `Gemfile` | Ruby |

The detected type pre-selects a recommended `.gitignore` template so you can get started quickly.

## .gitignore Templates

FlowForge ships with **163 templates** sourced from GitHub's [gitignore repository](https://github.com/github/gitignore). Templates are organized by category:

| Category | Examples |
|----------|----------|
| Languages | C, Go, Java, Python, Rust, Swift |
| Frameworks | Node, Rails, Unity, Unreal Engine |
| Editors | JetBrains, Vim, VS Code |
| Operating Systems | macOS, Windows, Linux |

### Multi-Template Composition

Select more than one template to combine them. FlowForge merges the selected templates and deduplicates overlapping rules so your `.gitignore` stays clean.

### Offline Fallback

If GitHub's API is unreachable, FlowForge falls back to a bundled copy of the templates. You always have access to the full template library regardless of network connectivity.

### Live Preview

A preview pane on the right side of the blade shows the final `.gitignore` content in real time as you add or remove templates. You can also edit the preview directly before committing.

## README Generation

Toggle the **Create README.md** switch to generate a starter `README.md` containing the repository name and a placeholder description. The file uses the folder name as the project title.

## Initial Commit

Enable the **Create initial commit** option to have FlowForge stage the generated files and create a first commit automatically. The default commit message is:

```
feat: initialize repository
```

You can edit the message before confirming.

## Workflow Summary

1. Open a non-Git folder in FlowForge.
2. Click **Initialize Repository** on the welcome screen.
3. Set the default branch name.
4. Select one or more `.gitignore` templates (or accept the auto-detected recommendation).
5. Optionally enable README generation and an initial commit.
6. Click **Create** — FlowForge runs `git init`, writes the selected files, and optionally commits them.

After initialization, FlowForge loads the new repository and you can start working immediately.
