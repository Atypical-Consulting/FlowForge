import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ExtensionInfo } from "../../../extensions/extensionTypes";
import { ToggleSwitch } from "../../../extensions/github/components/ToggleSwitch";
import { PermissionBadge } from "../../../extensions/github/components/PermissionBadge";
import { useExtensionHost } from "../../../extensions/ExtensionHost";
import { Button } from "../../../components/ui/button";
import { toast } from "../../../stores/toast";
import { cn } from "../../../lib/utils";

interface ExtensionCardProps {
  extension: ExtensionInfo;
  onUninstall?: (id: string) => void;
}

export function ExtensionCard({ extension, onUninstall }: ExtensionCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const { activateExtension, deactivateExtension } = useExtensionHost();

  const isActive = extension.status === "active";
  const isBuiltIn = extension.builtIn === true;
  const isError = extension.status === "error";

  // Count contributions from manifest
  const contributes = extension.manifest.contributes;
  const bladeCount = contributes?.blades?.length ?? 0;
  const commandCount = contributes?.commands?.length ?? 0;
  const toolbarCount = contributes?.toolbar?.length ?? 0;

  const permissions = extension.manifest.permissions ?? [];

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      if (isActive) {
        await deactivateExtension(extension.id);
        toast.info(`${extension.name} disabled`);
      } else {
        await activateExtension(extension.id);
        toast.success(`${extension.name} enabled`);
      }
    } catch (e) {
      toast.error(`Failed to toggle: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        isError
          ? "border-ctp-red/30 bg-ctp-red/5"
          : "border-ctp-surface1 bg-ctp-surface0",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left side */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ctp-text truncate">
              {extension.name}
            </span>
            <span className="text-xs text-ctp-overlay0">{extension.version}</span>
            {isBuiltIn && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ctp-surface1 text-ctp-subtext0 font-medium">
                Built-in
              </span>
            )}
          </div>

          {extension.manifest.description && (
            <p className="text-xs text-ctp-overlay0 truncate mt-0.5">
              {extension.manifest.description}
            </p>
          )}

          {isError && extension.error && (
            <p className="text-xs text-ctp-red mt-0.5">{extension.error}</p>
          )}

          {/* Contribution counts */}
          {(bladeCount > 0 || commandCount > 0 || toolbarCount > 0) && (
            <div className="flex gap-3 mt-2 text-[10px] text-ctp-overlay0">
              {bladeCount > 0 && <span>Blades: {bladeCount}</span>}
              {commandCount > 0 && <span>Commands: {commandCount}</span>}
              {toolbarCount > 0 && <span>Toolbar: {toolbarCount}</span>}
            </div>
          )}

          {/* Permission badges */}
          {permissions.length > 0 && (
            <div className="flex gap-1 mt-2">
              {permissions.map((perm) => (
                <PermissionBadge key={perm} permission={perm} />
              ))}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {!isError && (
            <ToggleSwitch
              checked={isActive}
              onChange={handleToggle}
              loading={isToggling}
              aria-label={`Toggle ${extension.name}`}
            />
          )}
          {!isBuiltIn && onUninstall && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUninstall(extension.id)}
              className="text-ctp-red hover:text-ctp-red hover:bg-ctp-red/10"
              aria-label={`Uninstall ${extension.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
