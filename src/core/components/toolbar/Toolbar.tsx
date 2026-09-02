import { useMemo } from "react";
import {
  getGroupedToolbarActions,
  TOOLBAR_GROUP_ORDER,
  type ToolbarAction,
  useToolbarRegistry,
} from "@/framework/extension-system/toolbarRegistry";
import { useGitOpsStore as useRepositoryStore } from "../../stores/domain/git-ops";
import { usePreferencesStore } from "../../stores/domain/preferences";
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
  // Inputs that invalidate the action list. `when()` conditions read stores
  // imperatively, so the subscriptions below are re-render triggers AND memo
  // dependencies: registry contents, the registry's visibility tick
  // (refreshVisibility() for conditions outside the repo store) and
  // repoStatus (open/close). Subscribing without listing them as deps is not
  // enough -- that used to freeze the list computed on the welcome screen
  // (3 core actions) for the whole session.
  const actions = useToolbarRegistry((s) => s.items);
  const visibilityTick = useToolbarRegistry((s) => s.visibilityTick);
  const repoStatus = useRepositoryStore((s) => s.repoStatus);
  const hiddenActions = usePreferencesStore(
    (s) => s.settingsData.toolbar?.hiddenActions ?? [],
  );

  // Build the flattened ordered action list
  // biome-ignore lint/correctness/useExhaustiveDependencies: actions/visibilityTick/repoStatus are read imperatively by getGroupedToolbarActions() and the when() callbacks; they must invalidate the memo.
  const { orderedActions, groupBoundaries } = useMemo(() => {
    const grouped = getGroupedToolbarActions();
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
  }, [actions, visibilityTick, repoStatus, hiddenActions]);

  const { containerRef, visibleCount } = useToolbarOverflow(orderedActions);

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
      // Width comes from the header (flex-1 min-w-0), never from the content:
      // overflow measurement relies on it (see useToolbarOverflow).
      className="flex flex-1 min-w-0 items-center justify-end gap-1"
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
        <ToolbarOverflowMenu actions={overflowedActions} />
      )}
    </div>
  );
}
