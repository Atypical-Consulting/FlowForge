import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../../core/lib/utils";

interface CommitSearchProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CommitSearch({ value, onChange, className }: CommitSearchProps) {
  const [localValue, setLocalValue] = useState(value);

  // Debounce the onChange callback
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ctp-overlay0" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder="Search commits..."
        className={cn(
          "w-full pl-7 pr-7 py-1.5 text-sm",
          "bg-ctp-surface0 border border-ctp-surface1 rounded",
          "text-ctp-text placeholder:text-ctp-overlay0",
          "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue/50",
        )}
      />
      {localValue && (
        <button
          type="button"
          onClick={() => {
            setLocalValue("");
            onChange("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-ctp-surface1 rounded"
        >
          <X className="w-3 h-3 text-ctp-overlay0" />
        </button>
      )}
    </div>
  );
}
