import {
  AlertTriangle,
  Blocks,
  BookOpen,
  Command,
  Info,
  Layers,
  LayoutGrid,
  MonitorCog,
  PanelLeft,
  Power,
  PowerOff,
  Shield,
  Trash2,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { getCommands } from "@/framework/command-palette/commandRegistry";
import { useContextMenuRegistry } from "@/framework/extension-system/contextMenuRegistry";
import { useExtensionHost } from "@/framework/extension-system/ExtensionHost";
import { useStatusBarRegistry } from "@/framework/extension-system/statusBarRegistry";
import { useToolbarRegistry } from "@/framework/extension-system/toolbarRegistry";
import type { TrustLevel } from "@/framework/extension-system/types";
import { getAllBladeTypes } from "@/framework/layout/bladeRegistry";
import { useSidebarPanelRegistry } from "@/framework/layout/sidebarPanelRegistry";
import { toast } from "@/framework/stores/toast";
import { getExtensionReadme } from "../../../extensions/extensionReadme";
import { MarkdownRenderer } from "../../components/markdown/MarkdownRenderer";
import { Button } from "../../components/ui/button";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { cn } from "../../lib/utils";

interface ExtensionDetailBladeProps {
  extensionId: string;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-ctp-green/15 text-ctp-green border-ctp-green/30",
  },
  disabled: {
    label: "Disabled",
    className: "bg-ctp-surface1/50 text-ctp-overlay0 border-ctp-surface2",
  },
  deactivated: {
    label: "Deactivated",
    className: "bg-ctp-surface1/50 text-ctp-overlay0 border-ctp-surface2",
  },
  error: {
    label: "Error",
    className: "bg-ctp-red/15 text-ctp-red border-ctp-red/30",
  },
  discovered: {
    label: "Discovered",
    className: "bg-ctp-blue/15 text-ctp-blue border-ctp-blue/30",
  },
  activating: {
    label: "Activating...",
    className: "bg-ctp-yellow/15 text-ctp-yellow border-ctp-yellow/30",
  },
};

const TRUST_STYLES: Record<TrustLevel, { label: string; className: string }> = {
  "built-in": { label: "Built-in", className: "text-ctp-green" },
  "user-trusted": { label: "User Trusted", className: "text-ctp-blue" },
  sandboxed: { label: "Sandboxed", className: "text-ctp-yellow" },
};

export function ExtensionDetailBlade({
  extensionId,
}: ExtensionDetailBladeProps) {
  const [isToggling, setIsToggling] = useState(false);
  const { extensions, activateExtension, deactivateExtension } =
    useExtensionHost();
  const toolbarActions = useToolbarRegistry((s) => s.items);
  const contextMenuItems = useContextMenuRegistry((s) => s.items);
  const sidebarPanels = useSidebarPanelRegistry((s) => s.items);
  const statusBarItems = useStatusBarRegistry((s) => s.items);

  const extension = extensions.get(extensionId);

  if (!extension) {
    return (
      <div className="flex items-center justify-center h-full text-ctp-red text-sm">
        Extension not found: {extensionId}
      </div>
    );
  }

  const isActive = extension.status === "active";
  const isError = extension.status === "error";
  const isBuiltIn = extension.builtIn === true;
  const statusStyle =
    STATUS_STYLES[extension.status] ?? STATUS_STYLES.discovered;
  const trustStyle =
    TRUST_STYLES[extension.trustLevel] ?? TRUST_STYLES.sandboxed;

  // Gather live contributions from registries
  const extSource = `ext:${extensionId}`;
  const extPrefix = `ext:${extensionId}:`;

  const registeredBlades = getAllBladeTypes().filter(
    (t) => t.startsWith(extPrefix) || t === extensionId,
  );
  const registeredCommands = getCommands().filter(
    (c) => c.source === extSource,
  );
  const registeredToolbar = Array.from(toolbarActions.values()).filter(
    (a) => a.source === extSource,
  );
  const registeredContextMenu = Array.from(contextMenuItems.values()).filter(
    (i) => i.source === extSource,
  );
  const registeredSidebar = Array.from(sidebarPanels.values()).filter(
    (p) => p.source === extSource,
  );
  const registeredStatusBar = Array.from(statusBarItems.values()).filter(
    (i) => i.source === extSource,
  );

  const hasContributions =
    registeredBlades.length > 0 ||
    registeredCommands.length > 0 ||
    registeredToolbar.length > 0 ||
    registeredContextMenu.length > 0 ||
    registeredSidebar.length > 0 ||
    registeredStatusBar.length > 0;

  // Manifest-declared contributions (static)
  const contributes = extension.manifest.contributes;
  const manifestBlades = contributes?.blades ?? [];
  const manifestCommands = contributes?.commands ?? [];
  const manifestToolbar = contributes?.toolbar ?? [];
  const permissions = extension.manifest.permissions ?? [];

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      if (isActive) {
        await deactivateExtension(extensionId);
        toast.info(`${extension.name} disabled`);
      } else {
        await activateExtension(extensionId);
        toast.success(`${extension.name} enabled`);
      }
    } catch (e) {
      toast.error(
        `Failed to toggle: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <Blocks className="w-5 h-5 text-ctp-mauve shrink-0" />
            <h2 className="text-lg font-semibold text-ctp-text truncate">
              {extension.name}
            </h2>
            <span className="text-xs text-ctp-overlay0 font-mono">
              v{extension.version}
            </span>
          </div>

          {extension.manifest.description && (
            <p className="text-sm text-ctp-subtext0 mt-1.5">
              {extension.manifest.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isError && (
            <ToggleSwitch
              checked={isActive}
              onChange={handleToggle}
              loading={isToggling}
              aria-label={`Toggle ${extension.name}`}
            />
          )}
        </div>
      </div>

      {/* Status + metadata row */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full border",
            statusStyle.className,
          )}
        >
          {statusStyle.label}
        </span>

        {isBuiltIn && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ctp-surface1 text-ctp-subtext0 font-medium border border-ctp-surface2">
            Built-in
          </span>
        )}

        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            trustStyle.className,
          )}
        >
          <Shield className="w-3 h-3" />
          {trustStyle.label}
        </span>

        <span className="text-xs text-ctp-overlay0 flex items-center gap-1">
          <Info className="w-3 h-3" />
          API v{extension.manifest.apiVersion}
        </span>
      </div>

      {/* Error details */}
      {isError && extension.error && (
        <div className="p-3 rounded-lg border border-ctp-red/30 bg-ctp-red/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-ctp-red shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ctp-red">
                Activation Error
              </p>
              <p className="text-xs text-ctp-red/80 mt-1">{extension.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Permissions */}
      {permissions.length > 0 && (
        <Section title="Permissions" icon={Shield}>
          <div className="flex flex-wrap gap-1.5">
            {permissions.map((perm) => (
              <Chip key={perm} label={perm} />
            ))}
          </div>
        </Section>
      )}

      {/* Live contributions (from registries) */}
      {hasContributions && (
        <Section title="Active Contributions" icon={Layers}>
          <div className="space-y-3">
            {registeredBlades.length > 0 && (
              <ContributionGroup
                icon={LayoutGrid}
                label="Blades"
                items={registeredBlades.map((t) => t.replace(extPrefix, ""))}
              />
            )}
            {registeredCommands.length > 0 && (
              <ContributionGroup
                icon={Command}
                label="Commands"
                items={registeredCommands.map((c) => c.title)}
              />
            )}
            {registeredToolbar.length > 0 && (
              <ContributionGroup
                icon={Wrench}
                label="Toolbar Actions"
                items={registeredToolbar.map((a) => a.label)}
              />
            )}
            {registeredContextMenu.length > 0 && (
              <ContributionGroup
                icon={Layers}
                label="Context Menu Items"
                items={registeredContextMenu.map((i) => i.label)}
              />
            )}
            {registeredSidebar.length > 0 && (
              <ContributionGroup
                icon={PanelLeft}
                label="Sidebar Panels"
                items={registeredSidebar.map((p) => p.title)}
              />
            )}
            {registeredStatusBar.length > 0 && (
              <ContributionGroup
                icon={MonitorCog}
                label="Status Bar Items"
                items={registeredStatusBar.map((i) =>
                  i.id.replace(extPrefix, ""),
                )}
              />
            )}
          </div>
        </Section>
      )}

      {/* Manifest-declared contributions (static, from manifest JSON) */}
      {(manifestBlades.length > 0 ||
        manifestCommands.length > 0 ||
        manifestToolbar.length > 0) && (
        <Section title="Manifest Contributions" icon={Blocks}>
          <div className="space-y-3">
            {manifestBlades.length > 0 && (
              <ContributionGroup
                icon={LayoutGrid}
                label="Blades"
                items={manifestBlades.map((b) => `${b.type} — ${b.title}`)}
              />
            )}
            {manifestCommands.length > 0 && (
              <ContributionGroup
                icon={Command}
                label="Commands"
                items={manifestCommands.map((c) => c.title)}
              />
            )}
            {manifestToolbar.length > 0 && (
              <ContributionGroup
                icon={Wrench}
                label="Toolbar"
                items={manifestToolbar.map((t) => t.label)}
              />
            )}
          </div>
        </Section>
      )}

      {/* Documentation (README) */}
      {(() => {
        const readmeContent = getExtensionReadme(extensionId);
        return readmeContent ? (
          <Section title="Documentation" icon={BookOpen}>
            <div className="max-h-[500px] overflow-y-auto rounded-lg border border-ctp-surface1 bg-ctp-mantle p-3">
              <MarkdownRenderer content={readmeContent} className="prose-sm" />
            </div>
          </Section>
        ) : null;
      })()}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-ctp-surface1">
        {isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggle}
            disabled={isToggling}
            className="gap-1.5"
          >
            <PowerOff className="w-3.5 h-3.5" />
            Disable
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggle}
            disabled={isToggling || isError}
            className="gap-1.5"
          >
            <Power className="w-3.5 h-3.5" />
            Enable
          </Button>
        )}

        {!isBuiltIn && (
          <Button
            variant="ghost"
            size="sm"
            className="text-ctp-red hover:text-ctp-red hover:bg-ctp-red/10 gap-1.5"
            aria-label={`Uninstall ${extension.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Uninstall
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-ctp-subtext0 uppercase tracking-wider flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function ContributionGroup({
  icon: Icon,
  label,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-ctp-subtext1 mb-1">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
        <span className="text-ctp-overlay0">({items.length})</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Chip key={item} label={item} />
        ))}
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-md bg-ctp-surface0 text-ctp-subtext1 border border-ctp-surface1">
      {label}
    </span>
  );
}
