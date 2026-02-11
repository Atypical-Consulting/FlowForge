import { useState, useMemo } from "react";
import { Plus, Search, Puzzle } from "lucide-react";
import { useExtensionHost } from "../../extensions/ExtensionHost";
import { useGitOpsStore as useRepositoryStore } from "../../stores/domain/git-ops";
import { commands } from "../../bindings";
import { toast } from "../../stores/toast";
import { Button } from "../../components/ui/button";
import { ExtensionCard } from "./components/ExtensionCard";
import { InstallExtensionDialog } from "./components/InstallExtensionDialog";

export function ExtensionManagerBlade() {
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const extensions = useExtensionHost((s) => s.extensions);
  const discoverExtensions = useExtensionHost((s) => s.discoverExtensions);
  const repoPath = useRepositoryStore((s) => s.repoStatus?.repoPath ?? "");

  const extensionsDir = repoPath ? repoPath + "/.flowforge/extensions" : "";

  // Convert Map to sorted array, filtered by search
  const { builtInExts, installedExts } = useMemo(() => {
    const all = Array.from(extensions.values());
    const query = searchQuery.toLowerCase();
    const filtered = query
      ? all.filter(
          (ext) =>
            ext.name.toLowerCase().includes(query) ||
            (ext.manifest.description ?? "").toLowerCase().includes(query),
        )
      : all;

    return {
      builtInExts: filtered.filter((ext) => ext.builtIn).sort((a, b) => a.name.localeCompare(b.name)),
      installedExts: filtered.filter((ext) => !ext.builtIn).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [extensions, searchQuery]);

  const handleUninstall = async (extensionId: string) => {
    if (!extensionsDir) return;
    try {
      const result = await commands.extensionUninstall(extensionId, extensionsDir);
      if (result.status === "error") {
        toast.error(`Uninstall failed: ${result.error}`);
        return;
      }
      toast.success("Extension uninstalled");
      // Re-discover to update the list
      if (repoPath) {
        await discoverExtensions(repoPath);
      }
    } catch (e) {
      toast.error(`Uninstall failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleInstalled = async () => {
    // Re-discover extensions after install
    if (repoPath) {
      await discoverExtensions(repoPath);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-ctp-surface0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ctp-overlay0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search extensions..."
            className="w-full bg-ctp-mantle border border-ctp-surface1 rounded pl-8 pr-3 py-1.5 text-xs text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:border-ctp-blue"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setInstallDialogOpen(true)}
          disabled={!extensionsDir}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Install
        </Button>
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Installed section */}
        {installedExts.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-ctp-subtext1 mb-2 flex items-center gap-1.5">
              Installed
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ctp-surface1 text-ctp-overlay0">
                {installedExts.length}
              </span>
            </h3>
            <div className="space-y-2">
              {installedExts.map((ext) => (
                <ExtensionCard
                  key={ext.id}
                  extension={ext}
                  onUninstall={handleUninstall}
                />
              ))}
            </div>
          </section>
        )}

        {/* Built-in section */}
        {builtInExts.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-ctp-subtext1 mb-2 flex items-center gap-1.5">
              Built-in
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ctp-surface1 text-ctp-overlay0">
                {builtInExts.length}
              </span>
            </h3>
            <div className="space-y-2">
              {builtInExts.map((ext) => (
                <ExtensionCard key={ext.id} extension={ext} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {builtInExts.length === 0 && installedExts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-ctp-overlay0">
            <Puzzle className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">
              {searchQuery ? "No extensions match your search" : "No extensions found"}
            </p>
          </div>
        )}
      </div>

      {/* Install dialog */}
      <InstallExtensionDialog
        open={installDialogOpen}
        onOpenChange={setInstallDialogOpen}
        onInstalled={handleInstalled}
        extensionsDir={extensionsDir}
      />
    </div>
  );
}
