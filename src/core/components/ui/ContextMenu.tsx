import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useContextMenuRegistry } from "@/framework/extension-system/contextMenuRegistry";

/** Fallback dimensions used before the menu has been measured. */
const ESTIMATED_MENU_WIDTH = 200;
const ESTIMATED_ITEM_HEIGHT = 32;
const ESTIMATED_GROUP_GAP = 8;
const VIEWPORT_MARGIN = 8;

/**
 * Keep the menu fully inside the viewport. Prefers the requested position;
 * when it would overflow, shifts the menu back so its far edge touches the
 * viewport margin; never returns a negative offset.
 */
export function clampMenuPosition(
  position: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const maxLeft = viewport.width - size.width - VIEWPORT_MARGIN;
  const maxTop = viewport.height - size.height - VIEWPORT_MARGIN;
  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(position.x, maxLeft)),
    top: Math.max(VIEWPORT_MARGIN, Math.min(position.y, maxTop)),
  };
}

export function ContextMenuPortal() {
  const activeMenu = useContextMenuRegistry((s) => s.activeMenu);
  const hideMenu = useContextMenuRegistry((s) => s.hideMenu);
  const menuRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Keyboard, scroll and resize dismissal (click-outside is handled by the
  // full-screen backdrop below)
  useEffect(() => {
    if (!activeMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hideMenu();
      }
    };
    const handleScroll = () => hideMenu();
    const handleResize = () => hideMenu();

    document.addEventListener("keydown", handleKeyDown);
    // Capture phase: scroll events do not bubble, so this is the only way to
    // observe scrolling inside any nested panel.
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [activeMenu, hideMenu]);

  // Measure the real menu size once rendered so the clamp uses actual
  // dimensions instead of the estimate; focus the first item.
  useLayoutEffect(() => {
    setMeasured(null);
    if (!activeMenu || !menuRef.current) return;
    const { offsetWidth, offsetHeight } = menuRef.current;
    if (offsetWidth > 0 && offsetHeight > 0) {
      setMeasured({ width: offsetWidth, height: offsetHeight });
    }
    const firstItem =
      menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [activeMenu]);

  if (!activeMenu) return null;

  // Group items by group key
  const groupMap = new Map<string, typeof activeMenu.items>();
  for (const item of activeMenu.items) {
    const group = item.group ?? "__default__";
    if (!groupMap.has(group)) groupMap.set(group, []);
    groupMap.get(group)?.push(item);
  }
  const groups = Array.from(groupMap.entries());

  // Clamp position to viewport
  const size = measured ?? {
    width: ESTIMATED_MENU_WIDTH,
    height: Math.min(
      activeMenu.items.length * ESTIMATED_ITEM_HEIGHT +
        groups.length * ESTIMATED_GROUP_GAP,
      400,
    ),
  };
  const { left, top } = clampMenuPosition(activeMenu.position, size, {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      onClick={hideMenu}
      onWheel={hideMenu}
      onContextMenu={(e) => {
        e.preventDefault();
        hideMenu();
      }}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label="Context menu"
        className="fixed w-max min-w-48 py-1 bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl shadow-black/20 z-[101]"
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
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
