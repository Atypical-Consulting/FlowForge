import type { BranchScopeDefinition } from "../../lib/branchScopes";
import { cn } from "../../lib/utils";

interface BranchScopeSelectorProps {
  scopes: BranchScopeDefinition[];
  activeScopeId: string;
  onChange: (scopeId: string) => void;
}

export function BranchScopeSelector({ scopes, activeScopeId, onChange }: BranchScopeSelectorProps) {
  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % scopes.length;
      onChange(scopes[next].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (idx - 1 + scopes.length) % scopes.length;
      onChange(scopes[prev].id);
    }
  };

  return (
    <div role="radiogroup" aria-label="Branch scope" className="flex bg-ctp-surface0 rounded-md p-0.5 mx-2 mb-2">
      {scopes.map((scope, idx) => {
        const active = scope.id === activeScopeId;
        return (
          <button
            key={scope.id}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(scope.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            tabIndex={active ? 0 : -1}
            className={cn(
              "flex-1 text-xs font-medium rounded-sm py-1 px-2 transition-all",
              active
                ? "bg-ctp-surface1 text-ctp-text shadow-sm"
                : "text-ctp-overlay1 hover:text-ctp-subtext0"
            )}
          >
            {scope.label}
          </button>
        );
      })}
    </div>
  );
}
