import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { getCommandById } from "@/framework/command-palette/commandRegistry";
import { MenuDivider } from "./MenuDivider";
import { MenuItem } from "./MenuItem";
import type { MenuEntryDef, MenuItemDef } from "./menu-definitions";

const slideDown = {
  hidden: { opacity: 0, y: -8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

const noMotion = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

interface MenuDropdownProps {
  items: MenuEntryDef[];
  highlightedIndex: number;
  onItemClick: (item: MenuItemDef) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSetHighlightedIndex: (index: number) => void;
}

export function MenuDropdown({
  items,
  highlightedIndex,
  onItemClick,
  onKeyDown,
  onSetHighlightedIndex,
}: MenuDropdownProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the container on mount for keyboard navigation
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Build action index mapping (skip dividers)
  let actionIndex = 0;

  return (
    <motion.div
      ref={containerRef}
      variants={shouldReduceMotion ? noMotion : slideDown}
      initial="hidden"
      animate="show"
      exit="exit"
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="absolute top-full left-0 z-50 mt-1 min-w-[220px] py-1 bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl shadow-black/20 outline-none"
    >
      {items.map((item) => {
        if (item.type === "divider") {
          return <MenuDivider key={item.id} />;
        }

        const currentActionIndex = actionIndex++;
        const command = getCommandById(item.commandId);
        const isDisabled = command?.enabled ? !command.enabled() : !command;

        return (
          <MenuItem
            key={item.id}
            label={item.label}
            icon={item.icon}
            shortcut={item.shortcut}
            disabled={isDisabled}
            isHighlighted={currentActionIndex === highlightedIndex}
            onClick={() => onItemClick(item)}
            onMouseEnter={() => onSetHighlightedIndex(currentActionIndex)}
          />
        );
      })}
    </motion.div>
  );
}
