import { create } from "zustand";
import { commands } from "../bindings";
import type {
  CommitType,
  TypeSuggestion,
  ScopeSuggestion,
  ValidationResult,
} from "../bindings";

/**
 * Valid conventional commit types.
 */
export const COMMIT_TYPES: CommitType[] = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "chore",
  "ci",
  "build",
  "revert",
];

/**
 * Display labels for commit types.
 */
export const COMMIT_TYPE_LABELS: Record<CommitType, string> = {
  feat: "Feature",
  fix: "Bug Fix",
  docs: "Documentation",
  style: "Style",
  refactor: "Refactor",
  perf: "Performance",
  test: "Test",
  chore: "Chore",
  ci: "CI",
  build: "Build",
  revert: "Revert",
};

interface ConventionalState {
  // Form state
  commitType: CommitType | "";
  scope: string;
  description: string;
  body: string;
  isBreaking: boolean;
  breakingDescription: string;

  // Suggestions
  typeSuggestion: TypeSuggestion | null;
  scopeSuggestions: ScopeSuggestion[];
  inferredScope: string | null;

  // Validation
  validation: ValidationResult | null;
  isValidating: boolean;

  // Actions
  setCommitType: (type: CommitType | "") => void;
  setScope: (scope: string) => void;
  setDescription: (desc: string) => void;
  setBody: (body: string) => void;
  setIsBreaking: (breaking: boolean) => void;
  setBreakingDescription: (desc: string) => void;

  // Async actions
  fetchTypeSuggestion: () => Promise<void>;
  fetchScopeSuggestions: () => Promise<void>;
  fetchInferredScope: () => Promise<void>;
  validateMessage: (message: string) => Promise<void>;

  // Utilities
  buildCommitMessage: () => string;
  reset: () => void;
}

export const useConventionalStore = create<ConventionalState>((set, get) => ({
  // Initial state
  commitType: "",
  scope: "",
  description: "",
  body: "",
  isBreaking: false,
  breakingDescription: "",
  typeSuggestion: null,
  scopeSuggestions: [],
  inferredScope: null,
  validation: null,
  isValidating: false,

  // Setters
  setCommitType: (type) => set({ commitType: type }),
  setScope: (scope) => set({ scope }),
  setDescription: (desc) => set({ description: desc }),
  setBody: (body) => set({ body }),
  setIsBreaking: (breaking) => set({ isBreaking: breaking }),
  setBreakingDescription: (desc) => set({ breakingDescription: desc }),

  // Async actions
  fetchTypeSuggestion: async () => {
    try {
      const result = await commands.suggestCommitType();
      if (result.status === "ok") {
        const suggestion = result.data;
        set({ typeSuggestion: suggestion });
        // Auto-fill if high confidence and no type selected
        if (suggestion.confidence === "high" && !get().commitType) {
          set({ commitType: suggestion.suggestedType });
        }
      }
    } catch (e) {
      console.error("Failed to fetch type suggestion:", e);
    }
  },

  fetchScopeSuggestions: async () => {
    try {
      const result = await commands.getScopeSuggestions(20);
      if (result.status === "ok") {
        set({ scopeSuggestions: result.data });
      }
    } catch (e) {
      console.error("Failed to fetch scope suggestions:", e);
    }
  },

  fetchInferredScope: async () => {
    try {
      const result = await commands.inferScopeFromStaged();
      if (result.status === "ok") {
        const scope = result.data;
        set({ inferredScope: scope });
        // Auto-fill if scope is inferred and not already set
        if (scope && !get().scope) {
          set({ scope });
        }
      }
    } catch (e) {
      console.error("Failed to infer scope:", e);
    }
  },

  validateMessage: async (message) => {
    set({ isValidating: true });
    try {
      const result = await commands.validateConventionalCommit(message);
      set({ validation: result, isValidating: false });
    } catch (e) {
      console.error("Validation failed:", e);
      set({ isValidating: false });
    }
  },

  buildCommitMessage: () => {
    const { commitType, scope, description, body, isBreaking, breakingDescription } =
      get();

    if (!commitType || !description) {
      return "";
    }

    // Build header: type(scope)!: description
    let header = commitType;
    if (scope) header += `(${scope})`;
    if (isBreaking) header += "!";
    header += `: ${description}`;

    // Build full message
    let message = header;
    if (body) {
      message += `\n\n${body}`;
    }
    if (isBreaking && breakingDescription) {
      message += `\n\nBREAKING CHANGE: ${breakingDescription}`;
    }

    return message;
  },

  reset: () =>
    set({
      commitType: "",
      scope: "",
      description: "",
      body: "",
      isBreaking: false,
      breakingDescription: "",
      typeSuggestion: null,
      inferredScope: null,
      validation: null,
      isValidating: false,
    }),
}));

export type { CommitType, TypeSuggestion, ScopeSuggestion, ValidationResult };
