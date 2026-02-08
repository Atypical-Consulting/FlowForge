import { useEffect } from "react";
import { useConventionalCommit } from "../../hooks/useConventionalCommit";
import { useCommitExecution } from "../../hooks/useCommitExecution";
import { useBladeFormGuard } from "../../hooks/useBladeFormGuard";
import { useConventionalStore } from "../../stores/conventional";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { SplitPaneLayout } from "../layout/SplitPaneLayout";
import { TypeSelector } from "../commit/TypeSelector";
import { ScopeAutocomplete } from "../commit/ScopeAutocomplete";
import { BreakingChangeSection } from "../commit/BreakingChangeSection";
import { CharacterProgress } from "../commit/CharacterProgress";
import { ValidationErrors } from "../commit/ValidationErrors";
import { CommitPreview } from "../commit/CommitPreview";
import { CommitActionBar } from "../commit/CommitActionBar";
import { cn } from "../../lib/utils";

const MAX_DESCRIPTION_LENGTH = 72;
const BLADE_ID = "conventional-commit-blade";

interface ConventionalCommitBladeProps {
  amend?: boolean;
}

export function ConventionalCommitBlade({
  amend: initialAmend,
}: ConventionalCommitBladeProps) {
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
    canCommit,
    currentMessage,
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

  const store = useConventionalStore;
  const { goBack } = useBladeNavigation();
  const { markDirty, markClean } = useBladeFormGuard(BLADE_ID);

  const { commit, commitAndPush, isCommitting, isPushing } =
    useCommitExecution({
      onCommitSuccess: () => {
        reset();
        markClean();
        goBack();
      },
    });

  // Initialize suggestions on mount
  useEffect(() => {
    initializeSuggestions();
  }, [initializeSuggestions]);

  // Handle initialAmend prop
  useEffect(() => {
    if (initialAmend) {
      store.getState().setIsAmend(true);
    }
  }, [initialAmend, store]);

  // Dirty form guard: mark dirty when form has content
  useEffect(() => {
    if (description || commitType) {
      markDirty();
    } else {
      markClean();
    }
  }, [description, commitType, markDirty, markClean]);

  const isAmend = useConventionalStore((s) => s.isAmend);

  const handleCommit = () => {
    if (isAmend) {
      const confirmed = window.confirm(
        "Amend will rewrite the last commit. This cannot be undone. Continue?",
      );
      if (!confirmed) return;
    }
    commit(currentMessage, isAmend);
  };

  const handleCommitAndPush = () => {
    if (isAmend) {
      const confirmed = window.confirm(
        "This will amend the last commit and force push. This cannot be undone. Continue?",
      );
      if (!confirmed) return;
    }
    commitAndPush(currentMessage, isAmend);
  };

  const isDescriptionOverLimit = description.length > MAX_DESCRIPTION_LENGTH;

  return (
    <div className="flex flex-col h-full">
      {/* Main content with split pane */}
      <div className="flex-1 min-h-0">
        <SplitPaneLayout
          autoSaveId="cc-blade-split"
          primaryDefaultSize={55}
          primaryMinSize={30}
          primaryMaxSize={70}
          detailMinSize={25}
          primary={
            /* LEFT PANEL: Form */
            <div className="h-full overflow-y-auto p-4 space-y-4">
              {/* Type selector — 6 columns for wider layout */}
              <TypeSelector
                value={commitType}
                onChange={setCommitType}
                suggestion={typeSuggestion}
                onApplySuggestion={applyTypeSuggestion}
                columns={6}
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

              {/* Body textarea — taller for blade layout */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-ctp-subtext1">
                  Body (optional)
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Explain what and why vs. how..."
                  rows={8}
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
              <ValidationErrors
                validation={validation}
                isValidating={isValidating}
              />
            </div>
          }
          detail={
            /* RIGHT PANEL: Preview */
            <div className="h-full overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-ctp-subtext1">
                  Message Preview
                </label>
              </div>
              <CommitPreview message={currentMessage} variant="full" />
            </div>
          }
        />
      </div>

      {/* Footer with action buttons */}
      <div className="border-t border-ctp-surface0 p-4 bg-ctp-crust">
        <CommitActionBar
          canCommit={canCommit}
          isCommitting={isCommitting}
          isPushing={isPushing}
          amend={isAmend}
          showPush={true}
          onCommit={handleCommit}
          onCommitAndPush={handleCommitAndPush}
        />
      </div>
    </div>
  );
}
