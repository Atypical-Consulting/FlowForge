# Gitflow Workflow

FlowForge provides a visual interface for the [Gitflow branching model](https://nvie.com/posts/a-successful-git-branching-model/), making it easy to follow a structured release process without memorizing commands.

## Initializing Gitflow

Before using Gitflow features, your repository needs the standard branch structure (`main`, `develop`, and the associated prefixes). Open the Gitflow panel and click **Initialize Gitflow**. FlowForge creates the required branches and configures the prefixes for you.

## Starting a Flow

Click the **Start** button next to the flow type you want to begin:

- **Feature** — branches from `develop` for new functionality.
- **Release** — branches from `develop` to prepare a version for production.
- **Hotfix** — branches from `main` to patch a critical issue.

Enter a name for the branch and FlowForge creates it and checks it out automatically.

## Working on a Flow

While a flow is active, the header displays the current flow type and branch name. You can commit changes, push, and pull as usual. The active flow indicator stays visible until you finish or cancel it.

## Finishing a Flow

When your work is ready to merge, click **Finish** in the Gitflow panel. A dialog appears with:

1. A description of the merge operation (e.g., "Merge feature/login into develop").
2. An advisory **Review Checklist** with common pre-merge reminders. Items are customizable in Settings and never block the finish action.
3. For releases and hotfixes, an optional **tag message** field.

Clicking **Finish** merges the branch, creates a tag when applicable, and cleans up the flow branch.

## Customizing the Review Checklist

Navigate to **Settings > Review** to add, remove, or reorder checklist items for each flow type. Changes are persisted across sessions.
