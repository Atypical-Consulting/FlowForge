import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  Folder,
  GitCommitHorizontal,
  Check,
} from "lucide-react";
import { useMemo } from "react";
import { composeGitignore } from "../../lib/gitignoreComposer";
import { useInitRepoStore } from "../../stores/initRepo";

export function InitRepoPreview() {
  const {
    activeSection,
    selectedTemplates,
    templateContents,
    readmeEnabled,
    readmeName,
    readmeDescription,
    commitEnabled,
    commitMessage,
    directoryPath,
    defaultBranch,
  } = useInitRepoStore();

  const composedGitignore = useMemo(() => {
    if (selectedTemplates.length === 0) return "";
    return composeGitignore(
      selectedTemplates.map((name) => ({
        name,
        content: templateContents[name] || "",
      })),
    );
  }, [selectedTemplates, templateContents]);

  return (
    <div className="h-full flex flex-col bg-ctp-mantle">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex-1 overflow-auto"
        >
          {activeSection === "gitignore" && (
            <GitignorePreview
              composedContent={composedGitignore}
              hasTemplates={selectedTemplates.length > 0}
            />
          )}
          {activeSection === "readme" && (
            <ReadmePreview
              enabled={readmeEnabled}
              name={readmeName}
              description={readmeDescription}
            />
          )}
          {activeSection === "commit" && (
            <CommitPreview
              enabled={commitEnabled}
              message={commitMessage}
              hasGitignore={selectedTemplates.length > 0}
              hasReadme={readmeEnabled}
            />
          )}
          {activeSection === "summary" && (
            <SummaryPreview
              directoryPath={directoryPath}
              defaultBranch={defaultBranch}
              templateCount={selectedTemplates.length}
              readmeEnabled={readmeEnabled}
              commitEnabled={commitEnabled}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function GitignorePreview({
  composedContent,
  hasTemplates,
}: {
  composedContent: string;
  hasTemplates: boolean;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-ctp-text">
        <FileText className="w-4 h-4 text-ctp-subtext0" />
        Preview: .gitignore
      </div>
      {hasTemplates ? (
        <pre className="bg-ctp-base text-ctp-text font-mono text-sm p-4 rounded-lg overflow-auto whitespace-pre max-h-[calc(100vh-12rem)]">
          {composedContent}
        </pre>
      ) : (
        <p className="text-sm text-ctp-subtext0 italic">
          Select templates to preview
        </p>
      )}
    </div>
  );
}

function ReadmePreview({
  enabled,
  name,
  description,
}: {
  enabled: boolean;
  name: string;
  description: string;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-ctp-text">
        <FileText className="w-4 h-4 text-ctp-subtext0" />
        Preview: README.md
      </div>
      {enabled ? (
        <div className="bg-ctp-base rounded-lg p-6 space-y-3">
          <h1 className="text-xl font-bold text-ctp-text">
            {name || "Project"}
          </h1>
          {description && (
            <p className="text-ctp-subtext1">{description}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-ctp-subtext0 italic">
          Enable README generation to preview
        </p>
      )}
    </div>
  );
}

function CommitPreview({
  enabled,
  message,
  hasGitignore,
  hasReadme,
}: {
  enabled: boolean;
  message: string;
  hasGitignore: boolean;
  hasReadme: boolean;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-ctp-text">
        <GitCommitHorizontal className="w-4 h-4 text-ctp-subtext0" />
        Initial Commit Summary
      </div>
      {enabled ? (
        <div className="bg-ctp-base rounded-lg p-4 space-y-4">
          <div className="space-y-1">
            <div className="text-xs text-ctp-subtext0 uppercase tracking-wide">
              Commit message
            </div>
            <div className="text-sm text-ctp-text font-mono bg-ctp-surface0 rounded px-3 py-2">
              {message || "Initial commit"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-ctp-subtext0 uppercase tracking-wide">
              Files to commit
            </div>
            <div className="space-y-1">
              {hasGitignore && (
                <div className="flex items-center gap-2 text-sm text-ctp-green">
                  <FileText className="w-3.5 h-3.5" />
                  .gitignore
                </div>
              )}
              {hasReadme && (
                <div className="flex items-center gap-2 text-sm text-ctp-green">
                  <FileText className="w-3.5 h-3.5" />
                  README.md
                </div>
              )}
              {!hasGitignore && !hasReadme && (
                <p className="text-sm text-ctp-subtext0 italic">
                  No files to commit
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ctp-subtext0 italic">
          Enable initial commit to preview
        </p>
      )}
    </div>
  );
}

function SummaryPreview({
  directoryPath,
  defaultBranch,
  templateCount,
  readmeEnabled,
  commitEnabled,
}: {
  directoryPath: string;
  defaultBranch: string;
  templateCount: number;
  readmeEnabled: boolean;
  commitEnabled: boolean;
}) {
  const folderName =
    directoryPath.split("/").pop() ||
    directoryPath.split("\\").pop() ||
    directoryPath;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-ctp-text">
        <Folder className="w-4 h-4 text-ctp-subtext0" />
        Initialization Summary
      </div>
      <div className="bg-ctp-base rounded-lg p-4 space-y-3">
        <SummaryRow label="Directory" value={folderName} />
        <SummaryRow label="Branch" value={defaultBranch || "main"} />
        <SummaryRow
          label=".gitignore"
          value={
            templateCount > 0
              ? `${templateCount} template${templateCount > 1 ? "s" : ""} selected`
              : "None"
          }
          active={templateCount > 0}
        />
        <SummaryRow
          label="README.md"
          value={readmeEnabled ? "Enabled" : "Disabled"}
          active={readmeEnabled}
        />
        <SummaryRow
          label="Initial commit"
          value={commitEnabled ? "Enabled" : "Disabled"}
          active={commitEnabled}
        />
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-ctp-surface0 last:border-0">
      <span className="text-sm text-ctp-subtext0">{label}</span>
      <span
        className={`text-sm flex items-center gap-1.5 ${active !== undefined ? (active ? "text-ctp-green" : "text-ctp-subtext0") : "text-ctp-text"}`}
      >
        {active && <Check className="w-3.5 h-3.5" />}
        {value}
      </span>
    </div>
  );
}
