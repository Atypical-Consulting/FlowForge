# FlowForge Feature Analysis

> **Research Dimension**: Features  
> **Project**: FlowForge — AI-native Git client (Tauri + Rust + React)  
> **Competitors Analyzed**: GitKraken, Fork, Tower, Sourcetree, GitHub Desktop  
> **Last Updated**: 2026-02-03

---

## Executive Summary

Analysis of 5 major Git GUI clients reveals **three significant market gaps** that FlowForge can exploit:

1. **Gitflow is supported but not enforced** — No client prevents workflow violations
2. **Conventional commits are completely absent** — Zero native support across all clients
3. **Worktrees are an afterthought** — Basic support at best, broken at worst

---

## Market Gaps Analysis

### Gap 1: Gitflow Support is Shallow

| Client | Gitflow Support | Enforcement | Issues |
|--------|-----------------|-------------|--------|
| GitKraken | Yes (built-in) | None | No "support" branches, inflexible merge targets |
| Sourcetree | Yes (plugin) | None | Frequently breaks after updates |
| Tower | Yes | None | Manual branch management |
| Fork | No | N/A | Must use CLI |
| GitHub Desktop | No | N/A | Focused on GitHub Flow |

**Opportunity**: Visual workflow enforcement with branch type awareness. Prevent invalid operations (e.g., merging feature directly to main).

### Gap 2: Conventional Commits Don't Exist

| Client | Conventional Commit Support |
|--------|----------------------------|
| GitKraken | AI commits exist but don't follow convention |
| Tower | Commit templates + Gitmoji (separate, not integrated) |
| Sourcetree | None |
| Fork | None |
| GitHub Desktop | None (open request since 2023) |

**Opportunity**: First Git GUI with convention-aware commit composer, scope inference, type detection, and real-time validation.

### Gap 3: Worktrees Are Broken

| Client | Worktree Support | Quality |
|--------|------------------|---------|
| Sourcetree | None | Request open since 2015 |
| GitKraken | Added v10.5 (2024) | Inconsistent |
| Tower | Added 2025 | Basic but newest |
| Fork | Yes | Bugs with stash, submodules |
| GitHub Desktop | None | No plans |

**Opportunity**: First-class worktree management integrated with Gitflow workflows.

---

## Feature Categories

### Table Stakes (Must Have)

These features are expected by users — absence causes abandonment.

#### Core Git Operations
| Feature | Complexity | Dependencies |
|---------|------------|--------------|
| Clone repository | Low | Network |
| Stage/unstage files | Low | Git core |
| Commit with message | Low | Git core |
| Push/pull/fetch | Low | Network, Git core |
| View file diff (inline & side-by-side) | Medium | Diff engine |
| View commit history (log) | Medium | Git core |
| Create/delete branches | Low | Git core |
| Checkout branch | Low | Git core |
| Merge branches | Medium | Git core |
| Stash management | Low | Git core |
| Tag management | Low | Git core |
| View blame/annotate | Medium | Git core |

#### UX Fundamentals
| Feature | Complexity | Dependencies |
|---------|------------|--------------|
| Dark mode | Low | UI framework |
| Keyboard shortcuts | Low | UI framework |
| Multiple repository tabs | Medium | State management |
| Search commits | Medium | Git core |
| Search files | Low | File system |
| Undo last action | Medium | Command history |
| Repository bookmarks/recent | Low | Persistence |

#### Basic Integrations
| Feature | Complexity | Dependencies |
|---------|------------|--------------|
| GitHub/GitLab/Bitbucket auth | Medium | OAuth |
| Open in terminal | Low | System |
| Open in file explorer | Low | System |
| Open in external diff tool | Low | System |
| Credential storage | Medium | OS keychain |

---

### Differentiators (Competitive Advantage)

These features set FlowForge apart from competitors.

#### Tier 1: Core Differentiators (v1)

| Feature | Complexity | Dependencies | Competitor Gap |
|---------|------------|--------------|----------------|
| **Gitflow visual workflow** | High | State machine, Graph viz | All have weak enforcement |
| **Gitflow operation enforcement** | High | State machine | None enforce |
| **Conventional commit composer** | Medium | Parser, UI | None have it |
| **Commit scope inference** | Medium | File analysis | None have it |
| **Commit type detection** | Medium | Diff analysis | None have it |
| **Commit message validation** | Low | Parser | None have it |
| **Changelog generation** | Medium | Commit parser | None integrated |
| **First-class worktree panel** | Medium | Git worktree API | All have poor support |
| **Worktree status indicators** | Low | File watcher | None have it |
| **Worktree-branch linking** | Low | Git worktree API | None visualize it |

#### Tier 2: Future Differentiators (v2+)

| Feature | Complexity | Dependencies | Notes |
|---------|------------|--------------|-------|
| **MCP server** | Very High | Protocol impl | AI agent integration |
| **Tiered autonomy model** | High | MCP, Policy engine | Agent guardrails |
| **Choreography view** | High | MCP, Real-time UI | Agent operation visualization |
| **Embedded AI model** | High | ONNX Runtime | Offline semantic analysis |
| **Smart staging (auto-grouping)** | Medium | Diff analysis, AI | Split messy changes |
| **Conflict resolution with AI** | High | Diff, AI | Semantic merge assistance |

#### Tier 3: Polish Features (v3+)

| Feature | Complexity | Dependencies | Notes |
|---------|------------|--------------|-------|
| Interactive rebase (drag-drop) | High | Git rebase, Complex UI | Visual rebase planning |
| Branch health monitoring | Medium | Analytics | Staleness, drift detection |
| Team workflow sharing | Medium | Config sync | Share Gitflow settings |
| Commit signing (GPG/SSH) | Medium | Crypto libs | Security |
| Submodule management | High | Git submodule API | Many repos need this |
| LFS support | Medium | Git LFS | Large file handling |

---

### Anti-Features (Deliberately NOT Building)

| Feature | Reason | Risk if Built |
|---------|--------|---------------|
| Built-in code editor | Scope creep, IDE competition | Bloat, poor experience |
| Issue tracker integration | v1 scope control | Distraction from core value |
| Mercurial support | Git-only focus | Maintenance burden |
| Plugin/extension system | Complexity, v1 focus | Security, stability risks |
| CI/CD integration | v1 scope control | Feature creep |
| Code review features | GitHub/GitLab do this well | Duplication |
| Built-in terminal | Users have terminals | Bloat |
| Project management | Scope creep | Distraction |
| Wiki/documentation | Out of scope | Not a Git client feature |

#### v1 Explicit Exclusions

| Feature | Reason |
|---------|--------|
| Linux support | Focus on macOS/Windows first, Linux v1.1 |
| Enterprise features (SSO, audit) | Consumer/prosumer focus first |
| Self-hosted Git server support | GitHub/GitLab/Bitbucket first |

---

## Feature Dependencies

```
Git Core Operations
       │
       ├──► Branch Management
       │           │
       │           ├──► Gitflow State Machine
       │           │           │
       │           │           └──► Gitflow Visual Workflow
       │           │
       │           └──► Worktree Management
       │
       ├──► Staging Area
       │           │
       │           └──► Conventional Commit Composer
       │                       │
       │                       ├──► Scope Inference
       │                       ├──► Type Detection
       │                       └──► Changelog Generation
       │
       └──► Commit History
                   │
                   └──► Topology Visualization
                               │
                               └──► Gitflow Lane Display
```

---

## Competitive Pricing Context

| Client | Pricing Model | Price |
|--------|---------------|-------|
| GitKraken | Subscription | $48/year |
| Tower | Subscription | $69-99/year |
| Fork | One-time | $49.99 |
| Sourcetree | Free | $0 (Atlassian) |
| GitHub Desktop | Free | $0 (GitHub) |

**Implication**: FlowForge could compete at Fork's price point ($49.99 one-time) or GitKraken's ($48/year) depending on feature set and update cadence.

---

## Quality Gate Verification

- [x] Categories are clear (table stakes vs differentiators vs anti-features)
- [x] Complexity noted for each feature
- [x] Dependencies between features identified

---

## Sources

- [GitKraken Features](https://www.gitkraken.com/git-client)
- [Tower Features](https://www.git-tower.com/features)
- [Fork Features](https://git-fork.com/)
- [Sourcetree Documentation](https://www.sourcetreeapp.com/)
- [GitHub Desktop](https://desktop.github.com/)
- [GitKraken Gitflow Documentation](https://help.gitkraken.com/gitkraken-client/git-flow/)
- [Tower Worktree Announcement](https://www.git-tower.com/blog/tower-mac-15/)
