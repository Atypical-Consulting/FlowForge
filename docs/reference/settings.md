# Settings

Open Settings with **Cmd/Ctrl + ,** or through the command palette. Settings are organized into the following categories.

## General

| Setting | Description | Default |
| --- | --- | --- |
| Default tab | The tab shown when opening a repository (`changes`, `history`, or `topology`). | `changes` |

## Git

### Git Identity

Configure your global Git identity used for commits:

- **User name** — maps to `user.name`
- **User email** — maps to `user.email`
- **Default branch** — maps to `init.defaultBranch`

### Repository Defaults

| Setting | Description | Default |
| --- | --- | --- |
| Default remote | The remote name used for push, pull, and fetch operations. | `origin` |
| Auto-fetch interval | When enabled, FlowForge fetches from the default remote at the specified interval (1–60 minutes). | Disabled |

## Integrations

| Setting | Description | Default |
| --- | --- | --- |
| Editor | External editor command for opening files. | _(empty)_ |
| Terminal | External terminal command for opening the repository folder. | _(empty)_ |

## Review

Configure the advisory review checklist shown when finishing Gitflow branches. Items are organized by flow type:

- **Feature** — default items cover local testing, TODO cleanup, and requirement alignment.
- **Release** — default items cover version number, changelog, stability, and known bugs.
- **Hotfix** — default items cover issue verification, regression tests, and clean-environment testing.

Each section supports adding custom items, deleting items, and resetting to defaults. Changes persist across sessions. The checklist is advisory only and never blocks the finish action.

## Appearance

| Setting | Description | Default |
| --- | --- | --- |
| Theme | Choose between Catppuccin flavors: Latte, Frappe, Macchiato, or Mocha. | `mocha` |
