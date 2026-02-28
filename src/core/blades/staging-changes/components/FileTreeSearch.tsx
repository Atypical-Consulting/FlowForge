import { Search, X } from "lucide-react";
import { cn } from "../../../lib/utils";

interface FileTreeSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FileTreeSearch({
  value,
  onChange,
  placeholder = "Filter files...",
}: FileTreeSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ctp-overlay0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full pl-8 pr-8 py-1.5 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded",
          "text-ctp-text placeholder:text-ctp-overlay0",
          "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ctp-overlay0 hover:text-ctp-subtext1 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
