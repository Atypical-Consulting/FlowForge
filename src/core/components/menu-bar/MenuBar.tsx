import { useCallback } from "react";
import {
  executeCommand,
  getCommandById,
} from "@/framework/command-palette/commandRegistry";
import { MenuBarItem } from "./MenuBarItem";
import type { MenuItemDef } from "./menu-definitions";
import { menuDefinitions } from "./menu-definitions";
import { useMenuBar } from "./useMenuBar";

const menuIds = menuDefinitions.map((m) => m.id);

export function MenuBar() {
  const {
    activeMenu,
    highlightedIndex,
    containerRef,
    toggleMenu,
    closeMenu,
    handleTriggerKeyDown,
    handleItemKeyDown,
    handleTriggerMouseEnter,
    setHighlightedIndex,
  } = useMenuBar(menuIds);

  const handleItemClick = useCallback(
    (item: MenuItemDef) => {
      const command = getCommandById(item.commandId);
      if (!command) return;
      if (command.enabled && !command.enabled()) return;
      closeMenu();
      executeCommand(item.commandId);
    },
    [closeMenu],
  );

  return (
    <nav
      ref={containerRef}
      aria-label="Application menu"
      className="flex items-center"
    >
      {menuDefinitions.map((menu, idx) => (
        <MenuBarItem
          key={menu.id}
          label={menu.label}
          menuId={menu.id}
          isOpen={activeMenu === menu.id}
          items={menu.items}
          highlightedIndex={activeMenu === menu.id ? highlightedIndex : -1}
          tabIndex={idx === 0 ? 0 : -1}
          onToggle={() => toggleMenu(menu.id)}
          onMouseEnter={() => handleTriggerMouseEnter(menu.id)}
          onTriggerKeyDown={(e) => handleTriggerKeyDown(e, menu.id)}
          onItemClick={handleItemClick}
          onItemKeyDown={(e) =>
            handleItemKeyDown(
              e,
              menu.items.filter((i) => i.type === "action").length,
            )
          }
          onSetHighlightedIndex={setHighlightedIndex}
        />
      ))}
    </nav>
  );
}
