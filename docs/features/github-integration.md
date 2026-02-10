# GitHub Integration

FlowForge's GitHub extension connects your local repository to GitHub, letting you manage pull requests, issues, and authentication without leaving the app. It ships as the first built-in extension in FlowForge v1.5.0.

## Authentication

Sign in to GitHub using **Device Flow** — a secure browser-based flow that never requires pasting a Personal Access Token.

- **Scope profiles** — Choose between Basic (read-only), Full (read-write), or Custom scope sets depending on your needs.
- **Secure token storage** — Your OAuth token is stored in your operating system's keychain (macOS Keychain, Windows Credential Manager, or libsecret on Linux).
- **Account management** — A dedicated blade shows your GitHub username and avatar, and lets you sign out or switch scope profiles.

## Pull Requests

Browse, inspect, and create pull requests from within FlowForge.

- **Browse PRs** — View open, closed, and merged pull requests for the current repository.
- **PR details** — See the description, reviewers, labels, CI check status, and merge state for any PR.
- **Create PRs** — Open a new pull request from your current branch with title, body, base branch selector, and draft toggle.
- **Toolbar access** — A pull requests button appears in the toolbar when authenticated and a GitHub remote is detected.

## Issues

Stay on top of issues without context-switching to your browser.

- **Browse issues** — View open and closed issues for the current repository.
- **Issue details** — See descriptions, labels, assignees, and comment threads.
- **Toolbar access** — An issues button appears in the toolbar alongside the pull requests button.

## Automatic Remote Detection

FlowForge automatically detects GitHub remotes when you open a repository. If a remote matches `github.com`, the GitHub toolbar buttons appear contextually — no manual configuration needed.

## Learn More

- [Getting Started](/getting-started) — Set up FlowForge and open your first repository.
- [Blade Navigation](/concepts/blade-navigation) — Understand the stack-based UI model that powers the GitHub blades.
