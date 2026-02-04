import { useEffect } from "react";
import { useConventionalCommit } from "../../hooks/useConventionalCommit";
import { TypeSelector } from "./TypeSelector";
import { ScopeAutocomplete } from "./ScopeAutocomplete";
import { BreakingChangeSection } from "./BreakingChangeSection";
import { ValidationErrors } from "./ValidationErrors";
import { cn } from "../../lib/utils";

const MAX_DESCRIPTION_LENGTH = 72;

interface ConventionalCommitFormProps {
  onCommit: (message: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export function ConventionalCommitForm({
  onCommit,
  onCancel,
  disabled = false,
}: ConventionalCommitFormProps) {
  const {
    // State
    commitType,
    scope,
    description,
    body,
    isBreaking,
    breakingDescription,

    // Suggestions
    typeSuggestion,
    scopeSuggestions,
    inferredScope,

    // Validation
    validation,
    isValidating,
    canCommit,

    // Computed
    currentMessage,

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
  } = useConventionalCommit();

  // Initialize suggestions on mount
  useEffect(() => {
    initializeSuggestions();
  }, [initializeSuggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canCommit && !disabled) {
      onCommit(currentMessage);
      reset();
    }
  };

  const handleCancel = () => {
    reset();
    onCancel?.();
  };

  const descriptionRemaining = MAX_DESCRIPTION_LENGTH - description.length;
  const isDescriptionOverLimit = descriptionRemaining < 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector */}
      <TypeSelector
        value={commitType}
        onChange={setCommitType}
        suggestion={typeSuggestion}
        onApplySuggestion={applyTypeSuggestion}
      />

      {/* Scope autocomplete */}
      <ScopeAutocomplete
        value={scope}
        onChange={setScope}
        suggestions={scopeSuggestions}
        inferredScope={inferredScope}
        onApplySuggestion={applyScopeSuggestion}
      />

      {/* Description input */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-gray-300">
            Description *
          </label>
          <span
            className={cn(
              "text-xs",
              isDescriptionOverLimit
                ? "text-red-400"
                : descriptionRemaining <= 10
                  ? "text-yellow-400"
                  : "text-gray-500",
            )}
          >
            {descriptionRemaining} characters remaining
          </span>
        </div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of the change"
          className={cn(
            "w-full px-3 py-2 text-sm bg-gray-800 border rounded",
            "text-white placeholder:text-gray-500",
            "focus:outline-none focus:ring-1",
            isDescriptionOverLimit
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : "border-gray-700 focus:border-blue-500 focus:ring-blue-500",
          )}
        />
      </div>

      {/* Body textarea */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">
          Body (optional)
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Explain what and why vs. how..."
          rows={4}
          className={cn(
            "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded resize-none",
            "text-white placeholder:text-gray-500",
            "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
          )}
        />
      </div>

      {/* Breaking change section */}
      <BreakingChangeSection
        isBreaking={isBreaking}
        onBreakingChange={setIsBreaking}
        description={breakingDescription}
        onDescriptionChange={setBreakingDescription}
      />

      {/* Validation errors */}
      <ValidationErrors validation={validation} isValidating={isValidating} />

      {/* Message preview */}
      {currentMessage && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Preview</label>
          <pre
            className={cn(
              "p-3 text-sm bg-gray-900 border border-gray-700 rounded",
              "text-gray-300 font-mono whitespace-pre-wrap break-words",
              "max-h-32 overflow-y-auto",
            )}
          >
            {currentMessage}
          </pre>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded",
              "text-gray-300 bg-gray-700 hover:bg-gray-600",
              "focus:outline-none focus:ring-2 focus:ring-gray-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
            disabled={disabled}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canCommit || disabled}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded",
            "text-white bg-blue-600 hover:bg-blue-500",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          Commit
        </button>
      </div>
    </form>
  );
}
