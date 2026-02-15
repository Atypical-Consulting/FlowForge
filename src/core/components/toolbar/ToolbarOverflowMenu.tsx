import { MoreHorizontal } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ToolbarAction } from "@/framework/extension-system/toolbarRegistry";
import { formatShortcut } from "../../hooks/useKeyboardShortcuts";
import { Button } from "../ui/button";

interface ToolbarOverflowMenuProps {
  actions: ToolbarAction[];
  count: number;
}

/**
 * Overflow dropdown showing actions that don't fit inline.
 * Trigger has a count badge and participates in roving tabindex
 * via `data-toolbar-item`.
 */
export const ToolbarOverflowMenu = memo(function ToolbarOverflowMenu({
  actions,
  count,
}: ToolbarOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

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
        aria-label={`${count} more actions`}
        aria-haspopup="true"
        aria-expanded={open}
        data-toolbar-item
      >
        <MoreHorizontal className="w-4 h-4" />
        <span className="absolute -top-1 -right-1 bg-ctp-blue text-ctp-base text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
          {count}
        </span>
      </Button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-48 rounded-md border border-ctp-surface0 bg-ctp-mantle/95 backdrop-blur-sm shadow-lg py-1 z-50"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            const loading = action.isLoading?.() ?? false;

            return (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                disabled={loading}
                onClick={() => {
                  action.execute();
                  setOpen(false);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text disabled:opacity-50 transition-colors"
              >
                <Icon
                  className={`w-4 h-4 shrink-0${loading ? " animate-spin" : ""}`}
                />
                <span className="flex-1 text-left">{action.label}</span>
                {action.shortcut && (
                  <span className="text-xs text-ctp-subtext0 font-mono ml-4">
                    {formatShortcut(action.shortcut)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
