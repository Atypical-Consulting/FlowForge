import { AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import type { MenuEntryDef, MenuItemDef } from "./menu-definitions";
import { MenuDropdown } from "./MenuDropdown";

interface MenuBarItemProps {
  label: string;
  menuId: string;
  isOpen: boolean;
  items: MenuEntryDef[];
  highlightedIndex: number;
  tabIndex: number;
  onToggle: () => void;
  onMouseEnter: () => void;
  onTriggerKeyDown: (e: React.KeyboardEvent) => void;
  onItemClick: (item: MenuItemDef) => void;
  onItemKeyDown: (e: React.KeyboardEvent) => void;
  onSetHighlightedIndex: (index: number) => void;
}

export function MenuBarItem({
  label,
  menuId,
  isOpen,
  items,
  highlightedIndex,
  tabIndex,
  onToggle,
  onMouseEnter,
  onTriggerKeyDown,
  onItemClick,
  onItemKeyDown,
  onSetHighlightedIndex,
}: MenuBarItemProps) {
  return (
    <div className="relative">
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        tabIndex={tabIndex}
        className={cn(
          "px-3 py-1 text-sm rounded-md transition-colors",
          isOpen
            ? "bg-ctp-surface0 text-ctp-text"
            : "text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text",
        )}
        onClick={onToggle}
        onMouseEnter={onMouseEnter}
        onKeyDown={onTriggerKeyDown}
        data-menu-id={menuId}
      >
        {label}
      </button>
      <AnimatePresence>
        {isOpen && (
          <MenuDropdown
            items={items}
            highlightedIndex={highlightedIndex}
            onItemClick={onItemClick}
            onKeyDown={onItemKeyDown}
            onSetHighlightedIndex={onSetHighlightedIndex}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
