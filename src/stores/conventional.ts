import { commands } from "../bindings";
import type {
  CommitType,
  ScopeSuggestion,
  TypeSuggestion,
  ValidationResult,
} from "../bindings";
import { buildCommitMessage as buildMessage } from "../lib/conventional-utils";
import { createBladeStore } from "./createBladeStore";

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

/**
 * Template for pre-filling the conventional commit form.
 */
export interface CommitTemplate {
  id: string;
  label: string;
  description: string;
  icon?: string;
  fields: {
    commitType: CommitType;
    scope?: string;
    description: string;
    body?: string;
    isBreaking?: boolean;
    breakingDescription?: string;
  };
}

interface ConventionalState {
  // Form state
  commitType: CommitType | "";
  scope: string;
  description: string;
  body: string;
  isBreaking: boolean;
  breakingDescription: string;

  // Blade state
  isAmend: boolean;
  pushAfterCommit: boolean;
  activeTemplate: CommitTemplate | null;
  scopeFrequencies: ScopeSuggestion[];

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

  // Blade actions
  setIsAmend: (amend: boolean) => void;
  setPushAfterCommit: (push: boolean) => void;
  setActiveTemplate: (template: CommitTemplate | null) => void;
  applyTemplate: (template: CommitTemplate) => void;
  fetchScopeFrequencies: () => Promise<void>;

  // Async actions
  fetchTypeSuggestion: () => Promise<void>;
  fetchScopeSuggestions: () => Promise<void>;
  fetchInferredScope: () => Promise<void>;
  validateMessage: (message: string) => Promise<void>;

  // Utilities
  buildCommitMessage: () => string;
  reset: () => void;
}

export const useConventionalStore = createBladeStore<ConventionalState>(
  "conventional-commit",
  (set, get) => ({
    // Initial state
    commitType: "",
    scope: "",
    description: "",
    body: "",
    isBreaking: false,
    breakingDescription: "",
    isAmend: false,
    pushAfterCommit: false,
    activeTemplate: null,
    scopeFrequencies: [],
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

    // Blade setters
    setIsAmend: (amend) => set({ isAmend: amend }),
    setPushAfterCommit: (push) => set({ pushAfterCommit: push }),
    setActiveTemplate: (template) => set({ activeTemplate: template }),
    applyTemplate: (template) =>
      set({
        commitType: template.fields.commitType,
        scope: template.fields.scope || "",
        description: template.fields.description,
        body: template.fields.body || "",
        isBreaking: template.fields.isBreaking || false,
        breakingDescription: template.fields.breakingDescription || "",
        activeTemplate: template,
      }),
    fetchScopeFrequencies: async () => {
      try {
        const result = await commands.getScopeSuggestions(50);
        if (result.status === "ok") {
          set({ scopeFrequencies: result.data });
        }
      } catch (e) {
        console.error("Failed to fetch scope frequencies:", e);
      }
    },

    // Async actions
    fetchTypeSuggestion: async () => {
      try {
        const result = await commands.suggestCommitType();
        if (result.status === "ok") {
          const suggestion = result.data;
          set({ typeSuggestion: suggestion });
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
      const { commitType, scope, description, body, isBreaking, breakingDescription } = get();
      return buildMessage({ commitType, scope, description, body, isBreaking, breakingDescription });
    },

    reset: () =>
      set({
        commitType: "",
        scope: "",
        description: "",
        body: "",
        isBreaking: false,
        breakingDescription: "",
        isAmend: false,
        activeTemplate: null,
        typeSuggestion: null,
        inferredScope: null,
        validation: null,
        isValidating: false,
      }),
  }),
);

export type { CommitType, TypeSuggestion, ScopeSuggestion, ValidationResult };
