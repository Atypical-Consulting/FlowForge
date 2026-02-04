import { useEffect, useMemo, useCallback } from "react";
import {
  useConventionalStore,
  COMMIT_TYPES,
  COMMIT_TYPE_LABELS,
  type CommitType,
} from "../stores/conventional";
import { debounce } from "../lib/utils";

/**
 * Hook for managing conventional commit form state.
 *
 * Provides:
 * - Form state and setters
 * - Type and scope suggestions
 * - Debounced validation
 * - Computed canCommit flag
 */
export function useConventionalCommit() {
  const store = useConventionalStore();

  // Build current message
  const currentMessage = store.buildCommitMessage();

  // Debounced validation
  const debouncedValidate = useMemo(
    () =>
      debounce((message: string) => {
        if (message.trim()) {
          store.validateMessage(message);
        }
      }, 300),
    [store],
  );

  // Validate on message change
  useEffect(() => {
    if (store.description) {
      debouncedValidate(currentMessage);
    }
    return () => debouncedValidate.cancel?.();
  }, [currentMessage, debouncedValidate, store.description]);

  // Filtered scope suggestions for autocomplete
  const filteredScopes = useMemo(() => {
    const query = store.scope.toLowerCase();
    if (!query) return store.scopeSuggestions;
    return store.scopeSuggestions.filter((s) =>
      s.scope.toLowerCase().includes(query),
    );
  }, [store.scope, store.scopeSuggestions]);

  // Is form valid for commit?
  const canCommit = useMemo(() => {
    return (
      store.commitType !== "" &&
      store.description.trim() !== "" &&
      (store.validation?.isValid ?? false) &&
      (!store.isBreaking || store.breakingDescription.trim() !== "")
    );
  }, [
    store.commitType,
    store.description,
    store.validation,
    store.isBreaking,
    store.breakingDescription,
  ]);

  // Apply type suggestion
  const applyTypeSuggestion = useCallback(() => {
    if (store.typeSuggestion) {
      store.setCommitType(store.typeSuggestion.suggestedType);
    }
  }, [store]);

  // Apply scope suggestion
  const applyScopeSuggestion = useCallback(
    (scope: string) => {
      store.setScope(scope);
    },
    [store],
  );

  // Initialize suggestions when hook is used
  const initializeSuggestions = useCallback(() => {
    store.fetchTypeSuggestion();
    store.fetchInferredScope();
    store.fetchScopeSuggestions();
  }, [store]);

  return {
    // State
    commitType: store.commitType,
    scope: store.scope,
    description: store.description,
    body: store.body,
    isBreaking: store.isBreaking,
    breakingDescription: store.breakingDescription,

    // Suggestions
    typeSuggestion: store.typeSuggestion,
    scopeSuggestions: filteredScopes,
    inferredScope: store.inferredScope,

    // Validation
    validation: store.validation,
    isValidating: store.isValidating,
    canCommit,

    // Computed
    currentMessage,
    commitTypes: COMMIT_TYPES,
    commitTypeLabels: COMMIT_TYPE_LABELS,

    // Actions
    setCommitType: store.setCommitType,
    setScope: store.setScope,
    setDescription: store.setDescription,
    setBody: store.setBody,
    setIsBreaking: store.setIsBreaking,
    setBreakingDescription: store.setBreakingDescription,
    applyTypeSuggestion,
    applyScopeSuggestion,
    initializeSuggestions,
    reset: store.reset,
  };
}

export type { CommitType };
