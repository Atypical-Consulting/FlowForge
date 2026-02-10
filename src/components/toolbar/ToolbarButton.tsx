import { memo } from "react";
import type { ToolbarAction } from "../../lib/toolbarRegistry";
import { ShortcutTooltip } from "../ui/ShortcutTooltip";
import { Button } from "../ui/button";

interface ToolbarButtonProps {
  action: ToolbarAction;
  tabIndex?: number;
}

/**
 * Individual toolbar action button with icon-only rendering and
 * ShortcutTooltip. Participates in roving tabindex via
 * `data-toolbar-item` attribute.
 */
export const ToolbarButton = memo(function ToolbarButton({
  action,
  tabIndex = 0,
}: ToolbarButtonProps) {
  const loading = action.isLoading?.() ?? false;
  const Icon = action.icon;

  return (
    <ShortcutTooltip shortcut={action.shortcut ?? ""} label={action.label}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => action.execute()}
        disabled={loading}
        aria-label={action.label}
        data-toolbar-item
        tabIndex={tabIndex}
      >
        <Icon className={`w-4 h-4${loading ? " animate-spin" : ""}`} />
      </Button>
    </ShortcutTooltip>
  );
});
