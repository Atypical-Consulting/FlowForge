# Concepts

This section covers the Git workflows and conventions that FlowForge is built around. Understanding these concepts will help you get the most out of the application.

## GitFlow

GitFlow is a branching model that defines a strict structure for managing releases, features, and hotfixes. It was introduced by Vincent Driessen in 2010 and remains one of the most widely adopted branching strategies for teams shipping versioned software.

FlowForge provides a visual interface for the entire GitFlow lifecycle — from initializing the branch structure to finishing a release with automatic merges and tags.

[Learn about GitFlow &rarr;](/concepts/gitflow)

## Conventional Commits

Conventional Commits is a specification for writing structured commit messages. By following a simple format — `type(scope): description` — your commit history becomes machine-readable and human-friendly at the same time.

FlowForge's commit interface encourages clear, descriptive messages that pair naturally with this convention.

[Learn about Conventional Commits &rarr;](/concepts/conventional-commits)

## Blade Navigation

FlowForge organizes its interface using a blade-based navigation model. Each blade is a focused panel that slides onto a stack — push to go deeper, pop to go back. An XState state machine manages transitions, ensuring predictable navigation with unsaved-changes protection and direction-aware animations.

[Learn about Blade Navigation &rarr;](/concepts/blade-navigation)
