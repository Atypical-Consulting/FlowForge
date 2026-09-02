import { MoreHorizontal } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  type ToolbarAction,
  useToolbarActionShortcut,
} from "@/framework/extension-system/toolbarRegistry";
import { formatShortcut } from "../../hooks/useKeyboardShortcuts";
import { Button } from "../ui/button";

interface ToolbarOverflowMenuProps {
  actions: ToolbarAction[];
}

interface OverflowMenuItemProps {
  action: ToolbarAction;
  onSelect: () => void;
}

function OverflowMenuItem({ action, onSelect }: OverflowMenuItemProps) {
  const Icon = action.icon;
  const loading = action.isLoading?.() ?? false;
  const shortcut = useToolbarActionShortcut(action);

  return (
    <button
      type="button"
      role="menuitem"
      disabled={loading}
      onClick={() => {
        action.execute();
        onSelect();
      }}
      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text disabled:opacity-50 transition-colors"
    >
      <Icon className={`w-4 h-4 shrink-0${loading ? " animate-spin" : ""}`} />
      <span className="flex-1 text-left whitespace-nowrap">{action.label}</span>
      {shortcut && (
        <span className="ml-8 shrink-0 whitespace-nowrap text-xs text-ctp-subtext0 font-mono">
          {formatShortcut(shortcut)}
        </span>
      )}
    </button>
  );
}

/**
 * Overflow dropdown showing actions that don't fit inline.
 *
 * The trigger is a plain "more" button: the number of collapsed actions is
 * layout trivia, not a notification, so it is not surfaced as a badge.
 * The trigger participates in roving tabindex via `data-toolbar-item` and is
 * tagged `data-toolbar-overflow-trigger` so overflow measurement can tell it
 * apart from real actions.
 */
export const ToolbarOverflowMenu = memo(function ToolbarOverflowMenu({
  actions,
}: ToolbarOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        onClick={toggle}
        aria-label="More actions"
        title="More actions"
        aria-haspopup="true"
        aria-expanded={open}
        data-toolbar-item
        data-toolbar-overflow-trigger
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full mt-1 w-max min-w-48 rounded-md border border-ctp-surface0 bg-ctp-mantle/95 backdrop-blur-sm shadow-lg py-1 z-50"
        >
          {actions.map((action) => (
            <OverflowMenuItem
              key={action.id}
              action={action}
              onSelect={close}
            />
          ))}
        </div>
      )}
    </div>
  );
});
