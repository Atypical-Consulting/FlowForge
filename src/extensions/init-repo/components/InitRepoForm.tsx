import {
  ChevronDown,
  FileText,
  FolderOpen,
  GitCommitHorizontal,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { commands } from "../../../bindings";
import { getErrorMessage } from "../../../core/lib/errors";
import { composeGitignore } from "../lib/gitignoreComposer";
import { useInitRepoStore } from "../store";
import { useGitOpsStore as useRepositoryStore } from "../../../core/stores/domain/git-ops";
import { useRecentRepos } from "../../../core/hooks/useRecentRepos";
import { useBladeNavigation } from "../../../core/hooks/useBladeNavigation";
import { Button } from "../../../core/components/ui/button";
import { ProjectDetectionBanner } from "./ProjectDetectionBanner";
import { TemplateChips } from "./TemplateChips";
import { TemplatePicker } from "./TemplatePicker";

interface InitRepoFormProps {
  onCancel?: () => void;
  onComplete?: (path: string) => void;
}

export function InitRepoForm({ onCancel, onComplete }: InitRepoFormProps) {
  const store = useInitRepoStore();
  const { openRepository } = useRepositoryStore();
  const { addRecentRepo } = useRecentRepos();
  const navigation = useBladeNavigation();

  const [gitignoreOpen, setGitignoreOpen] = useState(true);
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigation.goBack();
    }
    store.reset();
  };

  const handleInitialize = async () => {
    store.setIsInitializing(true);
    store.setInitError(null);

    try {
      // Step 1: git init
      const initResult = await commands.gitInit(
        store.directoryPath,
        store.defaultBranch,
      );
      if (initResult.status === "error") {
        store.setInitError(getErrorMessage(initResult.error));
        return;
      }

      // Step 2: Write init files
      const files: Array<{ filename: string; content: string }> = [];

      if (store.selectedTemplates.length > 0) {
        const composed = composeGitignore(
          store.selectedTemplates.map((name) => ({
            name,
            content: store.templateContents[name] || "",
          })),
        );
        files.push({ filename: ".gitignore", content: composed });
      }

      if (store.readmeEnabled) {
        let readme = `# ${store.readmeName || "Project"}\n`;
        if (store.readmeDescription) {
          readme += `\n${store.readmeDescription}\n`;
        }
        files.push({ filename: "README.md", content: readme });
      }

      if (files.length > 0) {
        const writeResult = await commands.writeInitFiles(
          store.directoryPath,
          files,
        );
        if (writeResult.status === "error") {
          store.setInitError(getErrorMessage(writeResult.error));
          return;
        }
      }

      // Step 3: Open repository
      if (onComplete) {
        onComplete(store.directoryPath);
      } else {
        await openRepository(store.directoryPath);
        await addRecentRepo(store.directoryPath);
      }

      // Step 4: Optional initial commit
      if (store.commitEnabled && files.length > 0) {
        const stageResult = await commands.stageAll();
        if (stageResult.status === "ok") {
          await commands.createCommit(
            store.commitMessage || "Initial commit",
            false,
          );
        }
      }
    } catch (e) {
      store.setInitError(
        e instanceof Error ? e.message : "Failed to initialize repository",
      );
    } finally {
      store.setIsInitializing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Section 1: Core Configuration */}
        <div
          className="space-y-4"
          onFocus={() => store.setActiveSection("summary")}
        >
          {/* Directory path (read-only) */}
          <div className="flex items-center gap-3 bg-ctp-surface0 border border-ctp-surface1 rounded-lg p-3">
            <FolderOpen className="w-4 h-4 text-ctp-subtext0 shrink-0" />
            <span className="text-sm text-ctp-subtext1 font-mono truncate">
              {store.directoryPath}
            </span>
          </div>

          {/* Branch name */}
          <div className="space-y-1.5">
            <label
              htmlFor="default-branch"
              className="text-sm font-medium text-ctp-text"
            >
              Default branch
            </label>
            <input
              id="default-branch"
              type="text"
              value={store.defaultBranch}
              onChange={(e) => store.setDefaultBranch(e.target.value)}
              placeholder="main"
              className="w-full bg-ctp-surface0 border border-ctp-surface1 rounded-md px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/50"
            />
          </div>

          {/* Project detection banner */}
          <ProjectDetectionBanner />
        </div>

        {/* Section 2: .gitignore */}
        <div onFocus={() => store.setActiveSection("gitignore")}>
          <button
            type="button"
            onClick={() => setGitignoreOpen(!gitignoreOpen)}
            className="flex items-center gap-2 w-full text-left"
          >
            <ChevronDown
              className={`w-4 h-4 text-ctp-subtext0 transition-transform ${
                gitignoreOpen ? "" : "-rotate-90"
              }`}
            />
            <FileText className="w-4 h-4 text-ctp-subtext0" />
            <span className="text-sm font-medium text-ctp-text">
              .gitignore Configuration
            </span>
          </button>
          {gitignoreOpen && (
            <div className="mt-3 ml-6 space-y-3">
              <TemplateChips />
              <button
                type="button"
                onClick={() => store.setIsPickerOpen(!store.isPickerOpen)}
                aria-expanded={store.isPickerOpen}
                className="text-sm px-3 py-2 rounded-md bg-ctp-surface0 text-ctp-text border border-ctp-surface1 hover:bg-ctp-surface1 transition-colors"
              >
                {store.isPickerOpen ? "Hide templates" : "Browse templates"}
              </button>
              {store.isPickerOpen && <TemplatePicker />}
            </div>
          )}
        </div>

        {/* Section 3: README.md */}
        <div onFocus={() => store.setActiveSection("readme")}>
          <button
            type="button"
            onClick={() => setReadmeOpen(!readmeOpen)}
            className="flex items-center gap-2 w-full text-left"
          >
            <ChevronDown
              className={`w-4 h-4 text-ctp-subtext0 transition-transform ${
                readmeOpen ? "" : "-rotate-90"
              }`}
            />
            <FileText className="w-4 h-4 text-ctp-subtext0" />
            <span className="text-sm font-medium text-ctp-text">
              README.md
            </span>
          </button>
          {readmeOpen && (
            <div className="mt-3 ml-6 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={store.readmeEnabled}
                  onChange={(e) => store.setReadmeEnabled(e.target.checked)}
                  className="rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue/50"
                />
                <span className="text-sm text-ctp-text">
                  Generate README.md
                </span>
              </label>
              {store.readmeEnabled && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="readme-name"
                      className="text-xs text-ctp-subtext0"
                    >
                      Project name
                    </label>
                    <input
                      id="readme-name"
                      type="text"
                      value={store.readmeName}
                      onChange={(e) => store.setReadmeName(e.target.value)}
                      className="w-full bg-ctp-surface0 border border-ctp-surface1 rounded-md px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="readme-desc"
                      className="text-xs text-ctp-subtext0"
                    >
                      Description
                    </label>
                    <textarea
                      id="readme-desc"
                      value={store.readmeDescription}
                      onChange={(e) =>
                        store.setReadmeDescription(e.target.value)
                      }
                      placeholder="A brief description of this project"
                      rows={3}
                      className="w-full bg-ctp-surface0 border border-ctp-surface1 rounded-md px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/50 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 4: Initial Commit */}
        <div onFocus={() => store.setActiveSection("commit")}>
          <button
            type="button"
            onClick={() => setCommitOpen(!commitOpen)}
            className="flex items-center gap-2 w-full text-left"
          >
            <ChevronDown
              className={`w-4 h-4 text-ctp-subtext0 transition-transform ${
                commitOpen ? "" : "-rotate-90"
              }`}
            />
            <GitCommitHorizontal className="w-4 h-4 text-ctp-subtext0" />
            <span className="text-sm font-medium text-ctp-text">
              Initial Commit
            </span>
          </button>
          {commitOpen && (
            <div className="mt-3 ml-6 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={store.commitEnabled}
                  onChange={(e) => store.setCommitEnabled(e.target.checked)}
                  className="rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue/50"
                />
                <span className="text-sm text-ctp-text">
                  Create initial commit
                </span>
              </label>
              {store.commitEnabled && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="commit-msg"
                    className="text-xs text-ctp-subtext0"
                  >
                    Commit message
                  </label>
                  <input
                    id="commit-msg"
                    type="text"
                    value={store.commitMessage}
                    onChange={(e) => store.setCommitMessage(e.target.value)}
                    className="w-full bg-ctp-surface0 border border-ctp-surface1 rounded-md px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue/50"
                  />
                  <p className="text-xs text-ctp-subtext0">
                    Commits .gitignore and README.md (if enabled)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {store.initError && (
        <div className="flex items-center gap-2 text-sm text-ctp-red px-6 py-2">
          <span className="shrink-0">Error:</span>
          {store.initError}
        </div>
      )}

      {/* Action bar */}
      <div className="sticky bottom-0 bg-ctp-base border-t border-ctp-surface1 p-4 flex justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={store.isInitializing}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleInitialize}
          disabled={store.isInitializing || !store.directoryPath}
        >
          {store.isInitializing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Initializing...
            </>
          ) : (
            "Initialize Repository"
          )}
        </Button>
      </div>
    </div>
  );
}
