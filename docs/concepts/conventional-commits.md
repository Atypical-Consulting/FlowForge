# Conventional Commits

[Conventional Commits](https://www.conventionalcommits.org/) is a specification for writing commit messages that follow a consistent, machine-readable format. It builds on [SemVer](https://semver.org/) principles to communicate the intent of each change through the commit message itself.

## The Format

Every conventional commit message follows this structure:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Examples

```
feat(auth): add login with GitHub OAuth

fix: prevent crash when repository path contains spaces

docs(readme): update installation instructions for Node 22

feat!: drop support for Node 16

BREAKING CHANGE: Minimum required Node.js version is now 20.
```

## Commit Types

The most common types are:

| Type | Purpose | SemVer Impact |
|------|---------|---------------|
| `feat` | A new feature | Minor bump |
| `fix` | A bug fix | Patch bump |
| `docs` | Documentation only | None |
| `style` | Formatting, whitespace, semicolons — no logic change | None |
| `refactor` | Code restructuring without changing behavior | None |
| `perf` | Performance improvement | None |
| `test` | Adding or updating tests | None |
| `build` | Build system or dependency changes | None |
| `ci` | CI/CD configuration changes | None |
| `chore` | Maintenance tasks (release scripts, tooling) | None |

## Breaking Changes

Breaking changes are signaled in two ways:

1. **Exclamation mark** after the type/scope: `feat!: new API`
2. **Footer** with `BREAKING CHANGE:` followed by a description.

Both indicate a major version bump under SemVer.

## Why Use Conventional Commits?

### Automated Changelogs

Tools can parse your commit history and generate changelogs grouped by type:

```markdown
## v1.3.0 (2026-02-08)

### Features
- **auth:** add login with GitHub OAuth
- **topology:** add zoom-to-fit button

### Bug Fixes
- prevent crash when repository path contains spaces
- **staging:** fix file count badge overflow
```

### Semantic Versioning

By scanning commit types since the last release, tools can automatically determine the next version number:

- Any `feat` commit → bump **minor** version
- Only `fix` commits → bump **patch** version
- Any `BREAKING CHANGE` → bump **major** version

### Clear History

A standardized format makes `git log` output scannable. You can instantly tell whether a commit added a feature, fixed a bug, or updated documentation.

### Team Alignment

New contributors learn the convention quickly, and code reviews can focus on the change itself rather than debating message formats.

## Scopes

Scopes are optional and describe the area of the codebase affected:

```
feat(staging): add drag-and-drop file staging
fix(topology): correct edge rendering for merge commits
refactor(store): simplify branch state management
```

Common scopes in a project might include: `auth`, `api`, `ui`, `docs`, `ci`, `config`.

## Tips for Good Commit Messages

1. **Use the imperative mood** — "add feature" not "added feature" or "adds feature".
2. **Keep the first line under 72 characters** — it should fit in a `git log --oneline`.
3. **Separate subject from body with a blank line** — the body explains *why*, the subject explains *what*.
4. **Reference issues** in footers — `Closes #42` or `Refs #100`.

## Conventional Commits in FlowForge

FlowForge's commit panel provides a text area where you write your commit messages. While FlowForge does not enforce the Conventional Commits format, its structured workflow encourages clear, descriptive messages:

- The **summary line** maps naturally to the `<type>(scope): description` format.
- **Amend mode** lets you revise a message if you realize the type or scope was wrong.
- The **undo last commit** action gives you a safety net to re-commit with a corrected message.

Pairing Conventional Commits with FlowForge's [GitFlow workflow](/features/gitflow) gives you a clean history where every branch merge and version tag tells a coherent story.
