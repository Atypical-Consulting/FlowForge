import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import { useConventionalCommit } from "../../hooks/useConventionalCommit";
import { useCommitExecution } from "../../hooks/useCommitExecution";
import { useAmendPrefill } from "../../hooks/useAmendPrefill";
import { useBladeFormGuard } from "./hooks/useBladeFormGuard";
import { useConventionalStore } from "../../stores/conventional";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { SplitPaneLayout } from "../../components/layout/SplitPaneLayout";
import { TypeSelector } from "../../components/commit/TypeSelector";
import { ScopeAutocomplete } from "../../components/commit/ScopeAutocomplete";
import { BreakingChangeSection } from "../../components/commit/BreakingChangeSection";
import { CharacterProgress } from "../../components/commit/CharacterProgress";
import { ValidationErrors } from "../../components/commit/ValidationErrors";
import { CommitPreview } from "../../components/commit/CommitPreview";
import { CommitActionBar } from "../../components/commit/CommitActionBar";
import { TemplateSelector } from "../../components/commit/TemplateSelector";
import { ScopeFrequencyChart } from "../../components/commit/ScopeFrequencyChart";
import type { CommitTemplate } from "../../stores/conventional";
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

  // Success state for auto-navigate
  const [commitSuccess, setCommitSuccess] = useState(false);
  const [stayHere, setStayHere] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Amend pre-fill
  const { prefillConventional, originalMessage } = useAmendPrefill({
    mode: "conventional",
  });

  const { commit, commitAndPush, isCommitting, isPushing } =
    useCommitExecution({
      onCommitSuccess: () => {
        setCommitSuccess(true);
        reset();
        markClean();

        if (!stayHere) {
          timerRef.current = setTimeout(() => {
            goBack();
          }, 1500);
        }
      },
    });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Initialize suggestions on mount
  useEffect(() => {
    initializeSuggestions();
  }, [initializeSuggestions]);

  // Handle initialAmend prop
  useEffect(() => {
    if (initialAmend) {
      store.getState().setIsAmend(true);
      prefillConventional(store.getState());
    }
  }, [initialAmend, store, prefillConventional]);

  // Dirty form guard: mark dirty when form has content
  useEffect(() => {
    if (description || commitType) {
      markDirty();
    } else {
      markClean();
    }
  }, [description, commitType, markDirty, markClean]);

  const isAmend = useConventionalStore((s) => s.isAmend);
  const activeTemplate = useConventionalStore((s) => s.activeTemplate);
  const scopeFrequencies = useConventionalStore((s) => s.scopeFrequencies);

  // Fetch scope frequencies on mount
  useEffect(() => {
    store.getState().fetchScopeFrequencies();
  }, [store]);

  const isFormEmpty = !commitType && !description;

  const handleApplyTemplate = (template: CommitTemplate) => {
    store.getState().applyTemplate(template);
  };

  const handleAmendToggle = (checked: boolean) => {
    store.getState().setIsAmend(checked);
    if (checked) {
      prefillConventional(store.getState());
    }
  };

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

  const handleStayHere = () => {
    setStayHere(true);
    setCommitSuccess(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const isDescriptionOverLimit = description.length > MAX_DESCRIPTION_LENGTH;

  return (
    <div className="relative flex flex-col h-full">
      {/* Success overlay */}
      {commitSuccess && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-ctp-base/90 z-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
          >
            <Check className="w-16 h-16 text-ctp-green" />
          </motion.div>
          <p className="mt-4 text-lg text-ctp-text">Commit successful!</p>
          <button
            type="button"
            onClick={handleStayHere}
            className="mt-2 text-sm text-ctp-blue hover:text-ctp-sapphire underline"
          >
            Stay here
          </button>
        </motion.div>
      )}

      {/* Amend toggle header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-ctp-surface0">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isAmend}
            onChange={(e) => handleAmendToggle(e.target.checked)}
            className="rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-peach focus:ring-ctp-peach"
          />
          <RotateCcw className="w-4 h-4 text-ctp-overlay1" />
          <span className="text-ctp-subtext1">Amend last commit</span>
        </label>
      </div>

      {/* Amend warning banner */}
      {isAmend && (
        <div className="flex items-center gap-2 px-4 py-2 bg-ctp-peach/10 border-b border-ctp-peach/30 text-sm">
          <AlertTriangle className="w-4 h-4 text-ctp-peach shrink-0" />
          <span className="text-ctp-peach">
            Amending previous commit
            {originalMessage
              ? `: "${originalMessage.split("\n")[0]}"`
              : ""}
          </span>
        </div>
      )}

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
              {/* Template quick-start chips */}
              <TemplateSelector
                onApply={handleApplyTemplate}
                isFormEmpty={isFormEmpty}
                activeTemplateId={activeTemplate?.id}
              />

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

              {/* Original message comparison when amending */}
              {isAmend && originalMessage && (
                <div className="space-y-2 mb-4">
                  <label className="text-sm font-medium text-ctp-overlay1">
                    Original Message
                  </label>
                  <pre className="p-3 text-sm bg-ctp-surface0/50 border border-ctp-surface1 rounded text-ctp-overlay1 font-mono whitespace-pre-wrap line-through opacity-60">
                    {originalMessage}
                  </pre>
                </div>
              )}

              <CommitPreview message={currentMessage} variant="full" />

              {/* Scope frequency chart */}
              <ScopeFrequencyChart
                frequencies={scopeFrequencies}
                onScopeClick={setScope}
              />
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
