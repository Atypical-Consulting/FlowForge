import type { CommitTemplate } from "../stores/conventional";

export const BUILTIN_TEMPLATES: CommitTemplate[] = [
  {
    id: "new-feature",
    label: "New Feature",
    description: "Add a new feature or capability",
    icon: "Sparkles",
    fields: { commitType: "feat", description: "add " },
  },
  {
    id: "bug-fix",
    label: "Bug Fix",
    description: "Fix a bug or defect",
    icon: "Bug",
    fields: { commitType: "fix", description: "fix " },
  },
  {
    id: "breaking-change",
    label: "Breaking Change",
    description: "Introduce a breaking API change",
    icon: "AlertTriangle",
    fields: {
      commitType: "feat",
      description: "",
      isBreaking: true,
      breakingDescription: "",
    },
  },
  {
    id: "dependency-update",
    label: "Dependency Update",
    description: "Update project dependencies",
    icon: "Package",
    fields: { commitType: "build", scope: "deps", description: "update " },
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "Add or update documentation",
    icon: "FileText",
    fields: { commitType: "docs", description: "" },
  },
  {
    id: "refactor",
    label: "Refactor",
    description: "Restructure code without changing behavior",
    icon: "RefreshCw",
    fields: { commitType: "refactor", description: "" },
  },
  {
    id: "ci-cd",
    label: "CI/CD",
    description: "Update continuous integration or deployment",
    icon: "Workflow",
    fields: { commitType: "ci", description: "" },
  },
];
