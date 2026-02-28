import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/framework/lib/utils";
import type { ScopeSuggestion } from "../../../bindings";

interface ScopeAutocompleteProps {
  value: string;
  onChange: (scope: string) => void;
  suggestions: ScopeSuggestion[];
  inferredScope: string | null;
  onApplySuggestion: (scope: string) => void;
}

export function ScopeAutocomplete({
  value,
  onChange,
  suggestions,
  inferredScope,
  onApplySuggestion,
}: ScopeAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const isMouseDownRef = useRef(false);

  // Suggestions are already filtered by the parent hook, use directly
  const filteredSuggestions = suggestions;

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown") {
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) =>
            Math.min(i + 1, filteredSuggestions.length - 1),
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
            onApplySuggestion(filteredSuggestions[highlightedIndex].scope);
            setIsOpen(false);
          }
          break;
        case "Escape":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, filteredSuggestions, highlightedIndex, onApplySuggestion],
  );

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setIsOpen(true);
    },
    [onChange],
  );

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Handle input blur - delay to allow click on dropdown items
  const handleBlur = useCallback(() => {
    // Don't close if mouse is down on the dropdown
    if (isMouseDownRef.current) return;
    // Small delay to allow click events to fire first
    setTimeout(() => {
      if (!isMouseDownRef.current) {
        setIsOpen(false);
      }
    }, 150);
  }, []);

  // Handle mouse down on dropdown items
  const handleListMouseDown = useCallback(() => {
    isMouseDownRef.current = true;
  }, []);

  // Handle mouse up on dropdown items
  const handleListMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
  }, []);

  // Handle item click
  const handleItemClick = useCallback(
    (scope: string) => {
      onApplySuggestion(scope);
      setIsOpen(false);
      isMouseDownRef.current = false;
    },
    [onApplySuggestion],
  );

  // Handle apply inferred scope
  const handleApplyInferred = useCallback(() => {
    if (inferredScope) {
      onApplySuggestion(inferredScope);
    }
  }, [inferredScope, onApplySuggestion]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2 relative">
      <label className="text-sm font-medium text-ctp-subtext1">
        Scope (optional)
      </label>

      {/* Inferred scope banner */}
      {inferredScope && !value && (
        <div className="flex items-center gap-2 p-2 bg-ctp-green/10 border border-ctp-green/20 rounded text-sm">
          <span className="text-ctp-subtext1">
            Inferred from files:{" "}
            <strong className="text-ctp-green">{inferredScope}</strong>
          </span>
          <button
            type="button"
            onClick={handleApplyInferred}
            className="ml-auto text-ctp-green hover:text-ctp-teal text-sm"
          >
            Apply
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="e.g., auth, api, ui"
        className={cn(
          "w-full px-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded",
          "text-ctp-text placeholder:text-ctp-overlay0",
          "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
        )}
      />

      {/* Autocomplete dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <ul
          ref={listRef}
          onMouseDown={handleListMouseDown}
          onMouseUp={handleListMouseUp}
          onMouseLeave={handleListMouseUp}
          className="absolute z-10 w-full mt-1 bg-ctp-surface0 border border-ctp-surface1 rounded shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredSuggestions.map((s, i) => (
            <li
              key={s.scope}
              className={cn(
                "px-3 py-2 cursor-pointer flex justify-between text-sm",
                i === highlightedIndex
                  ? "bg-ctp-surface1 text-ctp-text"
                  : "text-ctp-subtext1 hover:bg-ctp-surface1/50",
              )}
              onMouseDown={() => handleItemClick(s.scope)}
            >
              <span>{s.scope}</span>
              <span className="text-ctp-overlay0">{s.usageCount} uses</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
