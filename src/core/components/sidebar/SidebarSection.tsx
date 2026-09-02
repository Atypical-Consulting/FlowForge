import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import type { MouseEvent, ReactNode, SyntheticEvent } from "react";
import { usePreferencesStore } from "@/core/stores/domain/preferences";

export interface SidebarSectionAction {
  /** Tooltip / accessible name of the header button. */
  title: string;
  onClick: () => void;
  /** Defaults to a "+" icon. */
  icon?: LucideIcon;
}

export interface SidebarSectionProps {
  /** Stable id under which the expanded/collapsed state is persisted. */
  id: string;
  title: string;
  icon: LucideIcon;
  /**
   * Count shown as a badge in the header. `0` is rendered (it tells the user
   * the section is empty without expanding it); `null`/`undefined`/`""` hide
   * the badge.
   */
  count?: number | string | null;
  /** Used until the user has toggled the section once (then the persisted value wins). */
  defaultOpen?: boolean;
  /** Renders an icon button in the header; clicking it never toggles the section. */
  action?: SidebarSectionAction;
  /** Custom header action node (e.g. contributed by an extension). */
  renderAction?: () => ReactNode;
  children: ReactNode;
}

/**
 * Collapsible sidebar section (`<details>`) whose open state is remembered in
 * the preferences store and whose header action is guaranteed to work even
 * when the section is collapsed.
 *
 * Header actions typically render their dialog inside the section body, which
 * the browser hides while the `<details>` is closed — so an action click also
 * expands the section before running.
 */
export function SidebarSection({
  id,
  title,
  icon: Icon,
  count,
  defaultOpen = false,
  action,
  renderAction,
  children,
}: SidebarSectionProps) {
  const isOpen = usePreferencesStore(
    (s) => s.layoutState.sidebarSections[id] ?? defaultOpen,
  );
  const setSidebarSectionOpen = usePreferencesStore(
    (s) => s.setSidebarSectionOpen,
  );

  const handleToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const next = e.currentTarget.open;
    const stored =
      usePreferencesStore.getState().layoutState.sidebarSections[id] ??
      defaultOpen;
    if (next !== stored) void setSidebarSectionOpen(id, next);
  };

  const handleSummaryClick = (e: MouseEvent<HTMLElement>) => {
    // Clicks on a header action button must run the action only — never
    // toggle the section. preventDefault cancels the native <summary>
    // activation; stopPropagation keeps ancestors from reacting.
    if (!(e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) void setSidebarSectionOpen(id, true);
  };

  const ActionIcon = action?.icon ?? Plus;
  const showBadge = count != null && count !== "";

  return (
    <details
      open={isOpen}
      onToggle={handleToggle}
      className="border-b border-ctp-surface0"
      data-section-id={id}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: <summary> is natively interactive; the handler only intercepts clicks on the nested action button. */}
      <summary
        onClick={handleSummaryClick}
        className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg border-b border-ctp-surface0/50"
      >
        <Icon className="w-4 h-4" />
        <span className="font-semibold text-sm flex-1">{title}</span>
        {showBadge && (
          <span
            data-testid="sidebar-section-count"
            className="text-[10px] font-medium text-ctp-subtext0 bg-ctp-surface0 px-1.5 py-0.5 min-w-[18px] text-center rounded"
          >
            {count}
          </span>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text"
            title={action.title}
            aria-label={action.title}
          >
            <ActionIcon className="w-3.5 h-3.5" />
          </button>
        )}
        {renderAction?.()}
      </summary>
      {children}
    </details>
  );
}
