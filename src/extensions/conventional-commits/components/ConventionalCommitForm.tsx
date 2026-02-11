import { useEffect } from "react";
import { useConventionalCommit } from "../hooks/useConventionalCommit";
import { cn } from "../../../core/lib/utils";
import { BreakingChangeSection } from "./BreakingChangeSection";
import { CharacterProgress } from "./CharacterProgress";
import { CommitActionBar } from "./CommitActionBar";
import { CommitPreview } from "./CommitPreview";
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
      <CommitPreview message={currentMessage} variant="compact" />

      {/* Action buttons — commit button is type="submit", form onSubmit handles it */}
      <CommitActionBar
        canCommit={canCommit}
        disabled={disabled}
        onCommit={() => {}}
        onCancel={onCancel ? handleCancel : undefined}
      />
    </form>
  );
}
