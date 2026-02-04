import { useEffect } from "react";
import { useConventionalCommit } from "../../hooks/useConventionalCommit";
import { cn } from "../../lib/utils";
import { BreakingChangeSection } from "./BreakingChangeSection";
import { CharacterProgress } from "./CharacterProgress";
import { ScopeAutocomplete } from "./ScopeAutocomplete";
import { TypeSelector } from "./TypeSelector";
import { ValidationErrors } from "./ValidationErrors";

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

  const isDescriptionOverLimit = description.length > MAX_DESCRIPTION_LENGTH;

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
        <label className="text-sm font-medium text-ctp-subtext1">
          Description *
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of the change"
          className={cn(
            "w-full px-3 py-2 text-sm bg-ctp-surface0 border rounded",
            "text-ctp-text placeholder:text-ctp-overlay0",
            "focus:outline-none focus:ring-1",
            isDescriptionOverLimit
              ? "border-ctp-red focus:border-ctp-red focus:ring-ctp-red"
              : "border-ctp-surface1 focus:border-ctp-blue focus:ring-ctp-blue",
          )}
        />
        <CharacterProgress
          current={description.length}
          max={MAX_DESCRIPTION_LENGTH}
          warningThreshold={10}
        />
      </div>

      {/* Body textarea */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-ctp-subtext1">
          Body (optional)
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Explain what and why vs. how..."
          rows={4}
          className={cn(
            "w-full px-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded resize-none",
            "text-ctp-text placeholder:text-ctp-overlay0",
            "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
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
          <label className="text-sm font-medium text-ctp-subtext1">
            Preview
          </label>
          <pre
            className={cn(
              "p-3 text-sm bg-ctp-mantle border border-ctp-surface0 rounded",
              "text-ctp-subtext1 font-mono whitespace-pre-wrap wrap-break-words",
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
              "text-ctp-subtext1 bg-ctp-surface1 hover:bg-ctp-surface0",
              "focus:outline-none focus:ring-2 focus:ring-ctp-overlay0",
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
            "text-ctp-base bg-ctp-blue hover:bg-ctp-sapphire",
            "focus:outline-none focus:ring-2 focus:ring-ctp-blue",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          Commit
        </button>
      </div>
    </form>
  );
}
