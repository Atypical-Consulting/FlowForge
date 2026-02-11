import { useState } from "react";
import { CheckCircle, Download, Loader2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { PermissionBadge } from "../../../extensions/github/components/PermissionBadge";
import { commands } from "../../../bindings";

type Step = "input" | "fetching" | "review" | "installing" | "success" | "error";

interface InstallExtensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled: () => void;
  extensionsDir: string;
}

export function InstallExtensionDialog({
  open,
  onOpenChange,
  onInstalled,
  extensionsDir,
}: InstallExtensionDialogProps) {
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [manifestJson, setManifestJson] = useState("");
  const [tempPath, setTempPath] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const reset = () => {
    setStep("input");
    setUrl("");
    setManifestJson("");
    setTempPath("");
    setErrorMessage("");
  };

  const handleClose = () => {
    // Clean up temp path if mid-flow
    if (tempPath && step !== "success") {
      commands.extensionCancelInstall(tempPath).catch(() => {});
    }
    reset();
    onOpenChange(false);
  };

  const handleFetch = async () => {
    if (!url.trim()) return;
    setStep("fetching");
    try {
      const result = await commands.extensionFetchManifest(url.trim());
      if (result.status === "error") {
        setErrorMessage(result.error);
        setStep("error");
        return;
      }
      setManifestJson(result.data.manifestJson);
      setTempPath(result.data.tempPath);
      setStep("review");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  const handleInstall = async () => {
    setStep("installing");
    try {
      const result = await commands.extensionInstall(tempPath, extensionsDir);
      if (result.status === "error") {
        setErrorMessage(result.error);
        setStep("error");
        return;
      }
      setStep("success");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  const handleDone = () => {
    onInstalled();
    reset();
    onOpenChange(false);
  };

  // Parse manifest for display
  let manifest: Record<string, unknown> | null = null;
  try {
    if (manifestJson) manifest = JSON.parse(manifestJson);
  } catch { /* ignore */ }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-ctp-blue" />
            <DialogTitle>Install Extension</DialogTitle>
          </div>
        </DialogHeader>

        {/* Step: Input */}
        {step === "input" && (
          <div className="space-y-4">
            <div>
              <label htmlFor="ext-url" className="block text-xs font-medium text-ctp-subtext1 mb-1">
                Git Repository URL
              </label>
              <input
                id="ext-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/user/flowforge-ext-example"
                autoFocus
                className="w-full bg-ctp-mantle border border-ctp-surface1 rounded px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:border-ctp-blue"
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleFetch} disabled={!url.trim()}>
                Fetch Manifest
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Fetching */}
        {step === "fetching" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-ctp-blue" />
            <p className="text-sm text-ctp-overlay0">Fetching manifest...</p>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && manifest && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-ctp-surface1 bg-ctp-surface0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ctp-text">
                  {(manifest.name as string) ?? "Unknown"}
                </span>
                <span className="text-xs text-ctp-overlay0">
                  v{(manifest.version as string) ?? "?"}
                </span>
              </div>
              {typeof manifest.description === "string" && (
                <p className="text-xs text-ctp-overlay0">{manifest.description}</p>
              )}

              {/* Permissions */}
              {(() => {
                const perms = Array.isArray(manifest.permissions) ? (manifest.permissions as string[]) : [];
                return perms.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-ctp-subtext1">Permissions</p>
                    <div className="flex gap-1 flex-wrap">
                      {perms.map((perm) => (
                        <PermissionBadge key={perm} permission={perm} />
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Contributions */}
              {(() => {
                if (!manifest.contributes) return null;
                const c = manifest.contributes as Record<string, unknown>;
                const bladeCount = Array.isArray(c.blades) ? c.blades.length : 0;
                const cmdCount = Array.isArray(c.commands) ? c.commands.length : 0;
                return (bladeCount > 0 || cmdCount > 0) ? (
                  <div className="text-[10px] text-ctp-overlay0 flex gap-3">
                    {bladeCount > 0 && <span>Blades: {bladeCount}</span>}
                    {cmdCount > 0 && <span>Commands: {cmdCount}</span>}
                  </div>
                ) : null;
              })()}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleInstall}>Install &amp; Activate</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Installing */}
        {step === "installing" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-ctp-blue" />
            <p className="text-sm text-ctp-overlay0">Installing...</p>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle className="w-10 h-10 text-ctp-green" />
              <p className="text-sm text-ctp-text font-medium">
                {manifest?.name ? `${manifest.name as string} installed` : "Extension installed"}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Error */}
        {step === "error" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 gap-3">
              <XCircle className="w-10 h-10 text-ctp-red" />
              <p className="text-sm text-ctp-red">{errorMessage}</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={reset}>Try Again</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
