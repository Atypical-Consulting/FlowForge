import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { debounce } from "../lib/utils";
import {
  COMMIT_TYPES,
  COMMIT_TYPE_LABELS,
  type CommitType,
  useConventionalStore,
} from "../stores/conventional";

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
  // Use shallow comparison to prevent unnecessary re-renders
  const {
    commitType,
    scope,
    description,
    body,
    isBreaking,
    breakingDescription,
    typeSuggestion,
    scopeSuggestions,
    inferredScope,
    validation,
    isValidating,
    setCommitType,
    setScope,
    setDescription,
    setBody,
    setIsBreaking,
    setBreakingDescription,
    fetchTypeSuggestion,
    fetchScopeSuggestions,
    fetchInferredScope,
    validateMessage,
    buildCommitMessage,
    reset,
  } = useConventionalStore(
    useShallow((state) => ({
      commitType: state.commitType,
      scope: state.scope,
      description: state.description,
      body: state.body,
      isBreaking: state.isBreaking,
      breakingDescription: state.breakingDescription,
      typeSuggestion: state.typeSuggestion,
      scopeSuggestions: state.scopeSuggestions,
      inferredScope: state.inferredScope,
      validation: state.validation,
      isValidating: state.isValidating,
      setCommitType: state.setCommitType,
      setScope: state.setScope,
      setDescription: state.setDescription,
      setBody: state.setBody,
      setIsBreaking: state.setIsBreaking,
      setBreakingDescription: state.setBreakingDescription,
      fetchTypeSuggestion: state.fetchTypeSuggestion,
      fetchScopeSuggestions: state.fetchScopeSuggestions,
      fetchInferredScope: state.fetchInferredScope,
      validateMessage: state.validateMessage,
      buildCommitMessage: state.buildCommitMessage,
      reset: state.reset,
    })),
  );

  // Build current message
  const currentMessage = buildCommitMessage();

  // Track if suggestions have been initialized
  const initializedRef = useRef(false);

  // Debounced validation - use ref to keep stable reference
  const validateMessageRef = useRef(validateMessage);
  validateMessageRef.current = validateMessage;

  const debouncedValidate = useMemo(
    () =>
      debounce((message: string) => {
        if (message.trim()) {
          validateMessageRef.current(message);
        }
      }, 300),
    [],
  );

  // Validate on message change
  useEffect(() => {
    if (description) {
      debouncedValidate(currentMessage);
    }
    return () => debouncedValidate.cancel?.();
  }, [currentMessage, debouncedValidate, description]);

  // Filtered scope suggestions for autocomplete
  const filteredScopes = useMemo(() => {
    const query = scope.toLowerCase();
    if (!query) return scopeSuggestions;
    return scopeSuggestions.filter((s) =>
      s.scope.toLowerCase().includes(query),
    );
  }, [scope, scopeSuggestions]);

  // Is form valid for commit?
  const canCommit = useMemo(() => {
    return (
      commitType !== "" &&
      description.trim() !== "" &&
      (validation?.isValid ?? false) &&
      (!isBreaking || breakingDescription.trim() !== "")
    );
  }, [commitType, description, validation, isBreaking, breakingDescription]);

  // Apply type suggestion
  const applyTypeSuggestion = useCallback(() => {
    if (typeSuggestion) {
      setCommitType(typeSuggestion.suggestedType);
    }
  }, [typeSuggestion, setCommitType]);

  // Apply scope suggestion
  const applyScopeSuggestion = useCallback(
    (scopeValue: string) => {
      setScope(scopeValue);
    },
    [setScope],
  );

  // Initialize suggestions when hook is used - only once
  const initializeSuggestions = useCallback(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetchTypeSuggestion();
    fetchInferredScope();
    fetchScopeSuggestions();
  }, [fetchTypeSuggestion, fetchInferredScope, fetchScopeSuggestions]);

  return {
    // State
    commitType,
    scope,
    description,
    body,
    isBreaking,
    breakingDescription,

    // Suggestions
    typeSuggestion,
    scopeSuggestions: filteredScopes,
    inferredScope,

    // Validation
    validation,
    isValidating,
    canCommit,

    // Computed
    currentMessage,
    commitTypes: COMMIT_TYPES,
    commitTypeLabels: COMMIT_TYPE_LABELS,

    // Actions
    setCommitType,
    setScope,
    setDescription,
    setBody,
    setIsBreaking,
    setBreakingDescription,
    applyTypeSuggestion,
    applyScopeSuggestion,
    initializeSuggestions,
    reset,
  };
}

export type { CommitType };
