import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatShortcut } from "../../hooks/useKeyboardShortcuts";

interface MenuItemProps {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  isHighlighted?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

export function MenuItem({
  label,
  icon: Icon,
  shortcut,
  disabled = false,
  isHighlighted = false,
  onClick,
  onMouseEnter,
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left transition-colors",
        disabled
          ? "text-ctp-overlay0 cursor-default"
          : "text-ctp-text cursor-pointer",
        !disabled && isHighlighted && "bg-ctp-surface0",
        !disabled && !isHighlighted && "hover:bg-ctp-surface0",
      )}
      onClick={() => {
        if (!disabled) onClick();
      }}
      onMouseEnter={onMouseEnter}
    >
      {Icon && (
        <Icon
          className={cn(
            "w-4 h-4 shrink-0",
            disabled ? "text-ctp-surface2" : "text-ctp-overlay1",
          )}
        />
      )}
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-ctp-subtext0 font-mono ml-auto pl-4">
          {formatShortcut(shortcut)}
        </span>
      )}
    </button>
  );
}
