import { Loader2 } from "lucide-react";
import { cn } from "../../../core/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  loading?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  loading,
  disabled,
  "aria-label": ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => !disabled && !loading && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
        "focus-visible:ring-1 focus-visible:ring-ctp-overlay0 focus-visible:outline-none",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        checked ? "bg-ctp-green" : "bg-ctp-surface2",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-ctp-text shadow-sm transition-transform duration-150 mt-0.5",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      >
        {loading && (
          <Loader2 className="w-3 h-3 animate-spin absolute inset-0 m-auto text-ctp-base" />
        )}
      </span>
    </button>
  );
}
