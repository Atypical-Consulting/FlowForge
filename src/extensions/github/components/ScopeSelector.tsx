/**
 * Scope profile selector for the GitHub sign-in wizard.
 *
 * Shows 3 profile cards (Basic, Full Access, Custom) and an
 * expandable custom scope checkbox section.
 */

import { Eye, Shield, Settings } from "lucide-react";
import { SCOPE_PROFILES, CUSTOM_SCOPES } from "../types";
import { cn } from "@/framework/lib/utils";

interface ScopeSelectorProps {
  selectedProfile: string;
  onSelect: (profileId: string) => void;
  customScopes?: string[];
  onCustomScopesChange?: (scopes: string[]) => void;
}

const PROFILE_ICONS: Record<string, typeof Eye> = {
  basic: Eye,
  full: Shield,
  custom: Settings,
};

export function ScopeSelector({
  selectedProfile,
  onSelect,
  customScopes = [],
  onCustomScopesChange,
}: ScopeSelectorProps) {
  const handleScopeToggle = (scopeId: string) => {
    if (!onCustomScopesChange) return;
    if (customScopes.includes(scopeId)) {
      onCustomScopesChange(customScopes.filter((s) => s !== scopeId));
    } else {
      onCustomScopesChange([...customScopes, scopeId]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {SCOPE_PROFILES.map((profile) => {
          const Icon = PROFILE_ICONS[profile.id] ?? Settings;
          const isSelected = selectedProfile === profile.id;

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.id)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors cursor-pointer",
                isSelected
                  ? "border-ctp-blue bg-ctp-blue/5"
                  : "border-ctp-surface1 bg-ctp-base hover:border-ctp-surface2",
              )}
            >
              {profile.recommended && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-medium bg-ctp-blue text-ctp-base rounded-full">
                  Recommended
                </span>
              )}
              <Icon className={cn(
                "w-6 h-6",
                isSelected ? "text-ctp-blue" : "text-ctp-overlay1",
              )} />
              <span className={cn(
                "text-sm font-medium",
                isSelected ? "text-ctp-blue" : "text-ctp-text",
              )}>
                {profile.name}
              </span>
              <span className="text-xs text-ctp-subtext0 text-center leading-tight">
                {profile.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom scope checkboxes */}
      {selectedProfile === "custom" && (
        <div className="mt-4 p-4 bg-ctp-surface0 rounded-lg border border-ctp-surface1 space-y-2">
          <p className="text-xs font-medium text-ctp-subtext1 mb-3">
            Select individual permissions:
          </p>
          {CUSTOM_SCOPES.map((scope) => (
            <label
              key={scope.id}
              className="flex items-start gap-3 py-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={customScopes.includes(scope.id)}
                onChange={() => handleScopeToggle(scope.id)}
                className="mt-0.5 rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-ctp-text">{scope.label}</span>
                <span className="block text-xs text-ctp-subtext0">
                  {scope.description}
                </span>
              </div>
              <code className="text-xs text-ctp-overlay0 font-mono shrink-0">
                {scope.id}
              </code>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
