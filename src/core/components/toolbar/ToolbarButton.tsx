import { memo } from "react";
import type { ToolbarAction } from "@/framework/extension-system/toolbarRegistry";
import { Button } from "../ui/button";
import { ShortcutTooltip } from "../ui/ShortcutTooltip";

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

  const badgeValue = action.badge?.() ?? null;
  const showBadge = badgeValue != null && badgeValue !== 0 && badgeValue !== "";

  return (
    <ShortcutTooltip shortcut={action.shortcut ?? ""} label={action.label}>
      <div className="relative">
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
        {showBadge && (
          <span className="absolute -top-1 -right-1 bg-ctp-blue text-ctp-base text-[10px] font-medium px-1 min-w-[16px] text-center rounded-full pointer-events-none">
            {badgeValue}
          </span>
        )}
      </div>
    </ShortcutTooltip>
  );
});
