import { Search, X } from "lucide-react";
import type { RefObject } from "react";

interface SwitcherSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function SwitcherSearch({
  value,
  onChange,
  placeholder = "Filter branches...",
  inputRef,
}: SwitcherSearchProps) {
  return (
    <div className="relative border-b border-ctp-surface1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ctp-overlay0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-2 text-sm bg-ctp-surface0 text-ctp-text placeholder:text-ctp-overlay0 outline-none"
        autoFocus
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ctp-overlay0 hover:text-ctp-subtext0 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
