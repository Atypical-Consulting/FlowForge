# GitHub Integration

Comprehensive GitHub integration providing OAuth device-code authentication, pull request management, issue tracking, and repository status. Supports creating PRs, viewing diffs, merging with strategy selection, and monitoring rate limits.

## File Structure

```
github/
├── README.md
├── manifest.json
├── index.ts                        # Entry point (onActivate / onDeactivate)
├── githubStore.ts                  # Zustand store (auth, remotes, polling)
├── types.ts                        # TypeScript types for GitHub data
├── blades/
│   ├── GitHubAuthBlade.tsx         # OAuth device code flow
│   ├── GitHubAccountBlade.tsx      # Account info & status
│   ├── PullRequestListBlade.tsx    # PR list with filters
│   ├── PullRequestDetailBlade.tsx  # PR detail with diff & comments
│   ├── IssueListBlade.tsx          # Issue list with filters
│   ├── IssueDetailBlade.tsx        # Issue detail with comments
│   └── CreatePullRequestBlade.tsx  # New PR form
├── components/
│   ├── CommentCard.tsx
│   ├── DeviceCodeDisplay.tsx
│   ├── GitHubStatusButton.tsx
│   ├── LabelPill.tsx
│   ├── MergeConfirmDialog.tsx
│   ├── MergeStrategySelector.tsx
│   ├── PermissionBadge.tsx
│   ├── RateLimitBar.tsx
│   ├── ScopeSelector.tsx
│   ├── StatusBadge.tsx
│   ├── TimeAgo.tsx
│   ├── ToggleSwitch.tsx
│   └── UserAvatar.tsx
└── hooks/
    ├── useGitHubQuery.ts           # React Query wrapper for GitHub API reads
    └── useGitHubMutation.ts        # React Query wrapper for GitHub API mutations
```

## Blades

| Type | Title | Singleton | Description |
|------|-------|-----------|-------------|
| `sign-in` | GitHub Sign In | Yes | OAuth device code flow for authentication |
| `account` | GitHub Account | Yes | Authenticated user profile and status |
| `pull-requests` | Pull Requests | Yes | List of open/closed PRs for the repository |
| `pull-request` | Pull Request | No | Detail view for a single PR |
| `issues` | Issues | Yes | List of open/closed issues for the repository |
| `issue` | Issue | No | Detail view for a single issue |
| `create-pr` | Create Pull Request | Yes | Form to create a new pull request |

## Commands

| ID | Title | Category | Description |
|----|-------|----------|-------------|
| `sign-in` | Sign in to GitHub | GitHub | Opens the OAuth device code flow |
| `sign-out` | Sign out of GitHub | GitHub | Clears the authenticated session |
| `open-pull-requests` | View Pull Requests | GitHub | Opens the PR list blade |
| `open-issues` | View Issues | GitHub | Opens the issue list blade |
| `create-pull-request` | Create Pull Request | GitHub | Opens the new PR form |

## Toolbar Actions

| ID | Label | Group | Priority |
|----|-------|-------|----------|
| `github-status` | GitHub | app | 60 |
| `open-pull-requests` | Pull Requests | views | 50 |
| `open-issues` | Issues | views | 45 |
| `create-pr` | Create Pull Request | views | 55 |

## Hooks & Stores

- **githubStore.ts** - Zustand store managing authentication state, detected remotes, selected remote, and background polling for PR/issue updates.
- **useGitHubQuery** - React Query wrapper that adds authentication headers and error handling for GitHub API read operations.
- **useGitHubMutation** - React Query mutation wrapper for GitHub API write operations (merge, comment, create).

<details>
<summary>Extension Directory Convention</summary>

Every FlowForge extension should follow this directory structure:

```
extension-name/
├── README.md          # Extension documentation (this file)
├── manifest.json      # Extension metadata
├── index.ts           # Entry point (onActivate / onDeactivate)
├── blades/            # Blade components
├── components/        # Shared UI components
├── commands/          # Command definitions (if complex)
├── hooks/             # React hooks
├── machines/          # XState machines
├── types.ts           # Extension-specific types
└── store.ts           # Zustand stores
```

</details>
