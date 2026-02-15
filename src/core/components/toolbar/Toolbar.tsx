import { useMemo } from "react";
import {
  type ToolbarAction,
  TOOLBAR_GROUP_ORDER,
  useToolbarRegistry,
} from "@/framework/extension-system/toolbarRegistry";
import { usePreferencesStore } from "../../stores/domain/preferences";
import { useGitOpsStore as useRepositoryStore } from "../../stores/domain/git-ops";
import { ToolbarButton } from "./ToolbarButton";
import { ToolbarGroup } from "./ToolbarGroup";
import { ToolbarOverflowMenu } from "./ToolbarOverflowMenu";
import { useRovingTabindex } from "./useRovingTabindex";
import { useToolbarOverflow } from "./useToolbarOverflow";

/**
 * Main toolbar component. Reads all actions from the ToolbarRegistry,
 * filters by visibility (when() + hiddenActions preferences), groups
 * by intent, and renders with overflow + roving tabindex.
 *
 * This component contains NO business logic -- all logic lives in the
 * registered action execute/when/isLoading functions.
 */
export function Toolbar() {
  // Subscribe to registry changes for reactivity
  const actions = useToolbarRegistry((s) => s.actions);
  const visibilityTick = useToolbarRegistry((s) => s.visibilityTick);
  const hiddenActions = usePreferencesStore(
    (s) => s.settingsData.toolbar?.hiddenActions ?? [],
  );
  // Subscribe to repoStatus so when() conditions re-evaluate on repo change
  const repoStatus = useRepositoryStore((s) => s.repoStatus);

  const { containerRef, visibleCount } = useToolbarOverflow();

  // Build the flattened ordered action list
  const { orderedActions, groupBoundaries } = useMemo(() => {
    const grouped = useToolbarRegistry.getState().getGrouped();
    const ordered: ToolbarAction[] = [];
    const boundaries: { group: string; startIndex: number }[] = [];

    for (const group of TOOLBAR_GROUP_ORDER) {
      const groupActions = (grouped[group] ?? []).filter(
        (a) => !hiddenActions.includes(a.id),
      );
      if (groupActions.length === 0) continue;
      boundaries.push({ group, startIndex: ordered.length });
      ordered.push(...groupActions);
    }

    return { orderedActions: ordered, groupBoundaries: boundaries };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repoStatus + visibilityTick trigger when() re-eval
  }, [actions, hiddenActions, repoStatus, visibilityTick]);

  // Split into inline and overflowed
  const inlineActions = orderedActions.slice(0, visibleCount);
  const overflowedActions =
    visibleCount < orderedActions.length
      ? orderedActions.slice(visibleCount)
      : [];

  // Count items for roving tabindex (inline items + overflow button if any)
  const inlineItemCount =
    inlineActions.length + (overflowedActions.length > 0 ? 1 : 0);
  const { getTabIndex, handleKeyDown } = useRovingTabindex(inlineItemCount);

  // Build group ranges for inline actions
  let globalIndex = 0;
  let isFirstVisibleGroup = true;

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Main toolbar"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className="flex items-center gap-1"
    >
      {groupBoundaries.map(({ group, startIndex }, groupIdx) => {
        // Determine which actions from this group are still inline
        const nextBoundary = groupBoundaries[groupIdx + 1];
        const groupEnd = nextBoundary
          ? nextBoundary.startIndex
          : orderedActions.length;
        const groupInline = inlineActions.slice(
          Math.min(startIndex, inlineActions.length),
          Math.min(groupEnd, inlineActions.length),
        );

        if (groupInline.length === 0) return null;

        const showDivider = !isFirstVisibleGroup;
        isFirstVisibleGroup = false;

        const startGlobal = globalIndex;
        globalIndex += groupInline.length;

        return (
          <ToolbarGroup key={group} showDivider={showDivider}>
            {groupInline.map((action, i) => {
              const itemIndex = startGlobal + i;

              // Custom widget rendering (used by ThemeToggle, extension badges, etc.)
              if (action.renderCustom) {
                return (
                  <div key={action.id} data-toolbar-item>
                    {action.renderCustom(action, getTabIndex(itemIndex))}
                  </div>
                );
              }

              return (
                <ToolbarButton
                  key={action.id}
                  action={action}
                  tabIndex={getTabIndex(itemIndex)}
                />
              );
            })}
          </ToolbarGroup>
        );
      })}

      {overflowedActions.length > 0 && (
        <ToolbarOverflowMenu
          actions={overflowedActions}
          count={overflowedActions.length}
        />
      )}
    </div>
  );
}
