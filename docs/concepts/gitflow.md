# GitFlow

GitFlow is a branching model designed by [Vincent Driessen](https://nvie.com/posts/a-successful-git-branching-model/) that provides a robust framework for managing releases. It defines a strict set of branches and rules for how they interact, making it well-suited for projects that ship versioned software on a regular cadence.

## Why GitFlow?

Most Git workflows leave branching strategy up to the team. GitFlow removes that ambiguity by assigning a clear purpose to every branch:

- **Parallel development** — Feature branches isolate work-in-progress from stable code.
- **Release stabilization** — Release branches allow last-minute fixes without blocking new feature work.
- **Emergency patches** — Hotfix branches let you patch production without disturbing the current development cycle.

## Branch Structure

GitFlow uses two long-lived branches and three types of short-lived branches:

### Long-lived Branches

| Branch | Purpose |
|--------|---------|
| `main` | Always reflects the latest production release. Every commit on `main` is a release. |
| `develop` | Integration branch for the next release. Feature branches merge here. |

### Short-lived Branches

| Branch Type | Branches from | Merges into | Naming Convention |
|-------------|---------------|-------------|-------------------|
| **Feature** | `develop` | `develop` | `feature/<name>` |
| **Release** | `develop` | `main` and `develop` | `release/<version>` |
| **Hotfix** | `main` | `main` and `develop` | `hotfix/<name>` |

## The GitFlow Lifecycle

### 1. Feature Development

When you start working on a new feature:

```
develop ─────────────────────── develop
          \                   /
           feature/login ────
```

1. Create a `feature/` branch from `develop`.
2. Commit your changes on the feature branch.
3. When complete, merge back into `develop` and delete the feature branch.

### 2. Preparing a Release

When `develop` has enough features for a release:

```
develop ──────────────── develop
          \            /        \
           release/1.0 ──────── main (tag: v1.0)
```

1. Create a `release/` branch from `develop`.
2. Only bug fixes, documentation, and release-oriented changes go here.
3. When ready, merge into both `main` (with a version tag) and back into `develop`.

### 3. Emergency Hotfixes

When a critical bug is found in production:

```
main ─────────── main (tag: v1.0.1)
      \        /       \
       hotfix/fix ───── develop
```

1. Create a `hotfix/` branch from `main`.
2. Fix the issue and bump the patch version.
3. Merge into both `main` (with a tag) and `develop`.

## When to Use GitFlow

GitFlow works best when:

- Your project ships **named versions** (v1.0, v2.0, etc.).
- You need to **support multiple releases** in parallel.
- Your team has a clear **release cadence** (weekly, monthly, etc.).
- You want a **structured process** that new team members can follow immediately.

GitFlow may be more than you need if you deploy continuously from `main` — in that case, GitHub Flow or trunk-based development might be simpler.

## GitFlow in FlowForge

FlowForge automates the entire GitFlow lifecycle through its visual interface:

- **Initialize** — Sets up `main`, `develop`, and configures branch prefixes with a single click.
- **Start** — Creates feature, release, or hotfix branches with guided forms.
- **Finish** — Performs the correct merges, creates tags, and cleans up branches automatically.
- **Review Checklist** — An advisory checklist reminds you of pre-merge steps before finishing.

See [Gitflow Workflow](/features/gitflow) for a walkthrough of FlowForge's Gitflow features.
