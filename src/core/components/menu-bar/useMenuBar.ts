import { useCallback, useEffect, useRef, useState } from "react";
import { usePaletteStore as useUIStore } from "@/framework/command-palette/paletteStore";

export interface UseMenuBarReturn {
  activeMenu: string | null;
  highlightedIndex: number;
  containerRef: React.RefObject<HTMLElement | null>;
  openMenu: (menuId: string) => void;
  closeMenu: () => void;
  toggleMenu: (menuId: string) => void;
  handleTriggerKeyDown: (e: React.KeyboardEvent, menuId: string) => void;
  handleItemKeyDown: (e: React.KeyboardEvent, itemCount: number) => void;
  handleTriggerMouseEnter: (menuId: string) => void;
  setHighlightedIndex: (index: number) => void;
}

export function useMenuBar(menuIds: string[]): UseMenuBarReturn {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLElement | null>(null);

  const openMenu = useCallback((menuId: string) => {
    setActiveMenu(menuId);
    setHighlightedIndex(0);
  }, []);

  const closeMenu = useCallback(() => {
    setActiveMenu(null);
    setHighlightedIndex(-1);
  }, []);

  /**
   * Close the open menu from the keyboard (Escape) and hand focus back to
   * its trigger. The trigger only shows the "open" style while its menu is
   * open; keyboard focus is rendered with the distinct focus-visible ring.
   */
  const closeMenuFromKeyboard = useCallback(() => {
    const menuId = activeMenu;
    closeMenu();
    if (!menuId) return;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-menu-id="${menuId}"]`)
      ?.focus();
  }, [activeMenu, closeMenu]);

  const toggleMenu = useCallback(
    (menuId: string) => {
      if (activeMenu === menuId) {
        closeMenu();
      } else {
        openMenu(menuId);
      }
    },
    [activeMenu, closeMenu, openMenu],
  );

  const handleTriggerMouseEnter = useCallback(
    (menuId: string) => {
      if (activeMenu !== null && activeMenu !== menuId) {
        openMenu(menuId);
      }
    },
    [activeMenu, openMenu],
  );

  const cycleMenu = useCallback(
    (direction: 1 | -1) => {
      const currentIdx = activeMenu ? menuIds.indexOf(activeMenu) : 0;
      const nextIdx =
        (currentIdx + direction + menuIds.length) % menuIds.length;
      openMenu(menuIds[nextIdx]);
    },
    [activeMenu, menuIds, openMenu],
  );

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent, menuId: string) => {
      switch (e.key) {
        case "ArrowDown":
        case "Enter":
        case " ":
          e.preventDefault();
          openMenu(menuId);
          break;
        case "ArrowRight":
          e.preventDefault();
          cycleMenu(1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          cycleMenu(-1);
          break;
        case "Escape":
          if (activeMenu === null) return;
          e.preventDefault();
          // Do not let the global Escape hotkey (pop blade) fire as well.
          e.stopPropagation();
          closeMenuFromKeyboard();
          break;
      }
    },
    [activeMenu, openMenu, closeMenuFromKeyboard, cycleMenu],
  );

  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent, itemCount: number) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, itemCount - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          closeMenuFromKeyboard();
          break;
        case "ArrowRight":
          e.preventDefault();
          cycleMenu(1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          cycleMenu(-1);
          break;
        case "Home":
          e.preventDefault();
          setHighlightedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setHighlightedIndex(itemCount - 1);
          break;
      }
    },
    [closeMenuFromKeyboard, cycleMenu],
  );

  // Click-outside dismissal
  useEffect(() => {
    if (activeMenu === null) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [activeMenu, closeMenu]);

  // Close menu when command palette opens
  useEffect(() => {
    let prevPaletteOpen = useUIStore.getState().paletteIsOpen;
    const unsubscribe = useUIStore.subscribe((state) => {
      if (state.paletteIsOpen && !prevPaletteOpen) {
        setActiveMenu(null);
        setHighlightedIndex(-1);
      }
      prevPaletteOpen = state.paletteIsOpen;
    });
    return unsubscribe;
  }, []);

  return {
    activeMenu,
    highlightedIndex,
    containerRef,
    openMenu,
    closeMenu,
    toggleMenu,
    handleTriggerKeyDown,
    handleItemKeyDown,
    handleTriggerMouseEnter,
    setHighlightedIndex,
  };
}
