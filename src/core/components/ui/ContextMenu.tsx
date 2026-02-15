import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useContextMenuRegistry } from "@/framework/extension-system/contextMenuRegistry";

export function ContextMenuPortal() {
  const activeMenu = useContextMenuRegistry((s) => s.activeMenu);
  const hideMenu = useContextMenuRegistry((s) => s.hideMenu);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keyboard and click-outside dismissal
  useEffect(() => {
    if (!activeMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hideMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeMenu, hideMenu]);

  // Focus first menu item on mount
  useEffect(() => {
    if (!activeMenu || !menuRef.current) return;
    const firstItem = menuRef.current.querySelector<HTMLButtonElement>(
      '[role="menuitem"]',
    );
    firstItem?.focus();
  }, [activeMenu]);

  if (!activeMenu) return null;

  // Group items by group key
  const groupMap = new Map<string, typeof activeMenu.items>();
  for (const item of activeMenu.items) {
    const group = item.group ?? "__default__";
    if (!groupMap.has(group)) groupMap.set(group, []);
    groupMap.get(group)!.push(item);
  }
  const groups = Array.from(groupMap.entries());

  // Clamp position to viewport
  const menuWidth = 200;
  const menuHeight = Math.min(groups.reduce((acc, [, items]) => acc + items.length * 32, 0) + groups.length * 8, 400);
  const left = Math.min(activeMenu.position.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(activeMenu.position.y, window.innerHeight - menuHeight - 8);

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      onClick={hideMenu}
      onContextMenu={(e) => {
        e.preventDefault();
        hideMenu();
      }}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label="Context menu"
        className="fixed min-w-48 py-1 bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl shadow-black/20 z-[101]"
        style={{ top, left }}
        onClick={(e) => e.stopPropagation()}
      >
        {groups.map(([groupKey, items], groupIndex) => (
          <div key={groupKey}>
            {groupIndex > 0 && (
              <div className="my-1 border-t border-ctp-surface0" />
            )}
            {items.map((item) => (
              <button
                key={item.id}
                role="menuitem"
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ctp-text hover:bg-ctp-surface0 transition-colors text-left"
                onClick={() => {
                  item.execute(activeMenu.context);
                  hideMenu();
                }}
              >
                {item.icon && (
                  <item.icon className="w-4 h-4 text-ctp-overlay1" />
                )}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
