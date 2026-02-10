import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { getEnabledCommands, getOrderedCategories } from "../../lib/commandRegistry";
import type { CommandCategory } from "../../lib/commandRegistry";
import { searchCommands } from "../../lib/fuzzySearch";
import { useCommandPaletteStore } from "../../stores/commandPalette";
import { CommandPaletteItem } from "./CommandPaletteItem";

export function CommandPalette() {
  const {
    paletteIsOpen: isOpen,
    paletteQuery: query,
    paletteSelectedIndex: selectedIndex,
    closePalette: close,
    setPaletteQuery: setQuery,
    setPaletteSelectedIndex: setSelectedIndex,
  } = useCommandPaletteStore();

  const previousFocusRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const enabledCommands = useMemo(() => getEnabledCommands(), [isOpen]);
  const results = useMemo(
    () => searchCommands(query, enabledCommands),
    [query, enabledCommands],
  );

  // Group by category when query is empty
  const groupedResults = useMemo(() => {
    if (query.trim()) return null;
    const groups = new Map<CommandCategory, typeof results>();
    for (const item of results) {
      const cat = item.command.category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    // Sort groups by category order (core first, then extension alphabetically)
    return getOrderedCategories().filter((cat) => groups.has(cat as CommandCategory)).map((cat) => ({
      category: cat,
      items: groups.get(cat)!,
    }));
  }, [results, query]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Small delay to ensure the input is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Scroll selected into view
  useEffect(() => {
    if (!isOpen) return;
    const el = document.querySelector(
      `[data-command-index="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(
          results.length > 0 ? (selectedIndex + 1) % results.length : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(
          results.length > 0
            ? (selectedIndex - 1 + results.length) % results.length
            : 0,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].command.action();
          close();
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        e.preventDefault();
        break;
    }
  };

  const handleItemClick = (index: number) => {
    results[index].command.action();
    close();
  };

  if (!isOpen) return null;

  // Flat index tracker for grouped rendering
  let flatIndex = 0;

  const duration = shouldReduceMotion ? 0 : 0.15;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            key="palette"
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration, ease: "easeOut" as const }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-140"
          >
            <div className="bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-ctp-surface0">
                <Search className="w-4 h-4 text-ctp-overlay0 shrink-0" />
                <input
                  ref={inputRef}
                  role="combobox"
                  aria-expanded={true}
                  aria-controls="command-palette-list"
                  aria-activedescendant={
                    results[selectedIndex]
                      ? `cmd-${results[selectedIndex].command.id}`
                      : undefined
                  }
                  aria-autocomplete="list"
                  aria-label="Search commands"
                  className="w-full bg-transparent text-ctp-text placeholder:text-ctp-overlay0 outline-none text-sm"
                  placeholder="Type a command..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              {/* Results list */}
              <ul
                id="command-palette-list"
                role="listbox"
                aria-label="Commands"
                className="max-h-80 overflow-y-auto py-1"
              >
                {results.length > 0 ? (
                  groupedResults ? (
                    // Grouped by category when no query
                    groupedResults.map((group) => (
                      <li key={group.category} role="presentation">
                        <div className="text-xs text-ctp-overlay0 uppercase tracking-wider px-3 pt-2 pb-1">
                          {group.category}
                        </div>
                        <ul role="group" aria-label={group.category}>
                          {group.items.map((scored) => {
                            const currentIndex = flatIndex++;
                            return (
                              <li
                                key={scored.command.id}
                                role="option"
                                id={`cmd-${scored.command.id}`}
                                aria-selected={currentIndex === selectedIndex}
                              >
                                <CommandPaletteItem
                                  command={scored.command}
                                  isSelected={currentIndex === selectedIndex}
                                  matchedRanges={scored.matchedRanges}
                                  onClick={() => handleItemClick(currentIndex)}
                                  index={currentIndex}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))
                  ) : (
                    // Flat results when query is active
                    results.map((scored, i) => (
                      <li
                        key={scored.command.id}
                        role="option"
                        id={`cmd-${scored.command.id}`}
                        aria-selected={i === selectedIndex}
                      >
                        <CommandPaletteItem
                          command={scored.command}
                          isSelected={i === selectedIndex}
                          matchedRanges={scored.matchedRanges}
                          onClick={() => handleItemClick(i)}
                          index={i}
                        />
                      </li>
                    ))
                  )
                ) : (
                  <li className="px-4 py-8 text-center text-sm text-ctp-overlay0">
                    No matching commands
                  </li>
                )}
              </ul>

              {/* Screen reader result count */}
              <div aria-live="polite" className="sr-only">
                {results.length} {results.length === 1 ? "command" : "commands"}{" "}
                available
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
