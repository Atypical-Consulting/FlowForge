import { useState, useRef, useEffect } from "react";
import type { ScopeSuggestion } from "../../bindings";
import { cn } from "../../lib/utils";

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

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter((s) =>
    s.scope.toLowerCase().includes(value.toLowerCase()),
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  };

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
      <label className="text-sm font-medium text-gray-300">
        Scope (optional)
      </label>

      {/* Inferred scope banner */}
      {inferredScope && !value && (
        <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-sm">
          <span className="text-gray-300">
            Inferred from files:{" "}
            <strong className="text-green-400">{inferredScope}</strong>
          </span>
          <button
            type="button"
            onClick={() => onApplySuggestion(inferredScope)}
            className="ml-auto text-green-400 hover:text-green-300 text-sm"
          >
            Apply
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="e.g., auth, api, ui"
        className={cn(
          "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded",
          "text-white placeholder:text-gray-500",
          "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
        )}
      />

      {/* Autocomplete dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredSuggestions.map((s, i) => (
            <li
              key={s.scope}
              className={cn(
                "px-3 py-2 cursor-pointer flex justify-between text-sm",
                i === highlightedIndex
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700/50",
              )}
              onClick={() => {
                onApplySuggestion(s.scope);
                setIsOpen(false);
              }}
            >
              <span>{s.scope}</span>
              <span className="text-gray-500">{s.usageCount} uses</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
