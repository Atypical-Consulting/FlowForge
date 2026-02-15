import { open } from "@tauri-apps/plugin-dialog";
import { motion } from "framer-motion";
import { AlertCircle, FolderOpen, GitFork } from "lucide-react";
import appIcon from "../../../../src-tauri/icons/icon.png";
import { Suspense, useCallback, useEffect, useState } from "react";
import { commands } from "../../../bindings";
import { useRecentRepos } from "../../../core/hooks/useRecentRepos";
import { fadeInUp, staggerContainer, staggerItem } from "@/framework/theme/animations";
import { useBladeRegistry } from "@/framework/layout/bladeRegistry";
import { modKeyLabel } from "../../../core/lib/platform";
import { useGitOpsStore as useRepositoryStore } from "../../../core/stores/domain/git-ops";
import { CloneForm } from "../../../extensions/repository/components/CloneForm";
import { Button } from "../../../core/components/ui/button";
import { AnimatedGradientBg } from "./AnimatedGradientBg";
import { GitInitBanner } from "./GitInitBanner";
import { GitInitFallbackBanner } from "./GitInitFallbackBanner";
import { RecentRepos } from "./RecentRepos";

export function WelcomeContent() {
  const { openRepository, repoIsLoading: isLoading, repoError: error, clearRepoError: clearError } = useRepositoryStore();
  const { addRecentRepo } = useRecentRepos();
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [pendingInitPath, setPendingInitPath] = useState<string | null>(null);
  const [showInitRepo, setShowInitRepo] = useState(false);

  const initRepoRegistration = useBladeRegistry((s) => s.items.get("init-repo"));

  // Mid-session disable recovery: if user is viewing Init Repo blade
  // and the extension is disabled, reset to prevent stuck loading screen
  useEffect(() => {
    if (showInitRepo && !initRepoRegistration) {
      setShowInitRepo(false);
    }
  }, [showInitRepo, initRepoRegistration]);

  const openDialog = useCallback(async () => {
    try {
      clearError();
      setPendingInitPath(null);
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Git Repository",
      });

      if (selected && typeof selected === "string") {
        const isRepo = await commands.isGitRepository(selected);
        if (isRepo.status === "ok" && isRepo.data) {
          await openRepository(selected);
          await addRecentRepo(selected);
        } else {
          setPendingInitPath(selected);
        }
      }
    } catch (e) {
      console.error("Failed to open repository:", e);
    }
  }, [openRepository, addRecentRepo, clearError]);

  // Listen for keyboard shortcut event
  useEffect(() => {
    const handler = () => openDialog();
    document.addEventListener("open-repository-dialog", handler);
    return () =>
      document.removeEventListener("open-repository-dialog", handler);
  }, [openDialog]);

  // Listen for clone dialog event from header
  useEffect(() => {
    const handler = () => setShowCloneForm(true);
    document.addEventListener("clone-repository-dialog", handler);
    return () =>
      document.removeEventListener("clone-repository-dialog", handler);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      clearError();

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;

      // Try to get the path from the dropped item
      const item = items[0];
      if (item.kind !== "file") return;

      const file = item.getAsFile();
      if (!file) return;

      // In Tauri, dropped files have a path property
      const path = (file as File & { path?: string }).path;
      if (!path) {
        console.error("Could not get path from dropped item");
        return;
      }

      try {
        const isRepo = await commands.isGitRepository(path);
        if (isRepo.status === "ok" && isRepo.data) {
          await openRepository(path);
          await addRecentRepo(path);
        } else {
          setPendingInitPath(path);
        }
      } catch (e) {
        console.error("Failed to open dropped repository:", e);
      }
    },
    [openRepository, addRecentRepo, clearError],
  );

  // Show Init Repo blade in standalone mode
  if (showInitRepo && pendingInitPath) {
    if (!initRepoRegistration) {
      // Defensive fallback: blade not yet registered (race condition guard)
      return (
        <div className="h-[calc(100vh-3.5rem)] bg-ctp-base flex items-center justify-center">
          <p className="text-ctp-subtext0">Preparing repository setup...</p>
        </div>
      );
    }

    const InitComponent = initRepoRegistration.component;
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-ctp-base">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center">
              <p className="text-ctp-subtext0">Loading...</p>
            </div>
          }
        >
          <InitComponent
            directoryPath={pendingInitPath}
            onCancel={() => setShowInitRepo(false)}
            onComplete={async (path: string) => {
              await openRepository(path);
              await addRecentRepo(path);
              setShowInitRepo(false);
              setPendingInitPath(null);
            }}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-8 transition-colors ${
        isDragOver ? "bg-ctp-blue/10" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Animated background */}
      <AnimatedGradientBg />

      {/* Drag overlay */}
      {isDragOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-ctp-blue/10 pointer-events-none flex items-center justify-center z-50"
        >
          <div className="text-xl font-medium text-ctp-blue bg-ctp-mantle/90 px-8 py-4 rounded-xl border border-ctp-blue/30">
            Drop folder to open repository
          </div>
        </motion.div>
      )}

      {/* Content with stagger animation */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-md w-full space-y-8"
      >
        {/* Main action */}
        <motion.div variants={staggerItem} className="text-center space-y-4">
          <div className="inline-flex rounded-full bg-ctp-surface0/50 backdrop-blur-sm overflow-hidden">
            <img src={appIcon} alt="FlowForge" className="w-16 h-16" />
          </div>
          <h2 className="text-2xl font-bold text-ctp-text">
            Welcome to FlowForge
          </h2>
          <p className="text-ctp-subtext0">
            Open a repository to start forging your workflow.
          </p>
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="flex flex-col items-center gap-3"
        >
          {showCloneForm ? (
            <div className="w-full max-w-sm bg-ctp-surface0/50 backdrop-blur-sm rounded-lg p-4">
              <CloneForm onCancel={() => setShowCloneForm(false)} />
            </div>
          ) : (
            <>
              <Button
                size="lg"
                onClick={openDialog}
                disabled={isLoading}
                className="gap-2"
              >
                <FolderOpen className="w-5 h-5" />
                {isLoading ? "Opening..." : "Open Repository"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowCloneForm(true)}
                className="gap-2"
              >
                <GitFork className="w-5 h-5" />
                Clone Repository
              </Button>
              <p className="text-xs text-ctp-subtext0">
                or press{" "}
                <kbd className="px-1.5 py-0.5 bg-ctp-surface0 rounded text-ctp-subtext1 font-mono text-xs">
                  {modKeyLabel}+O
                </kbd>
              </p>
            </>
          )}
        </motion.div>

        {/* Error display */}
        {error && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            className="flex items-start gap-3 p-4 bg-ctp-red/10 border border-ctp-red/30 rounded-lg"
          >
            <AlertCircle className="w-5 h-5 text-ctp-red shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-ctp-red">
                Failed to open repository
              </div>
              <div className="text-sm text-ctp-red/80 mt-1">{error}</div>
            </div>
          </motion.div>
        )}

        {pendingInitPath && !error && !showInitRepo && (
          initRepoRegistration ? (
            <GitInitBanner
              path={pendingInitPath}
              onDismiss={() => setPendingInitPath(null)}
              onSetup={() => setShowInitRepo(true)}
            />
          ) : (
            <GitInitFallbackBanner
              path={pendingInitPath}
              onDismiss={() => setPendingInitPath(null)}
              onComplete={async (path) => {
                await openRepository(path);
                await addRecentRepo(path);
                setPendingInitPath(null);
              }}
            />
          )
        )}

        {/* Recent repos */}
        <motion.div variants={staggerItem}>
          <RecentRepos />
        </motion.div>
      </motion.div>
    </div>
  );
}
