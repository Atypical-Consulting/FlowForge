import {
  type ToolbarAction,
  TOOLBAR_GROUP_ORDER,
  useToolbarRegistry,
} from "../../../lib/toolbarRegistry";
import { usePreferencesStore as useSettingsStore } from "../../../stores/domain/preferences";
import { formatShortcut } from "../../../hooks/useKeyboardShortcuts";

/**
 * Settings panel for showing/hiding individual toolbar actions.
 * Groups actions by intent group and persists visibility to the Tauri store.
 */
export function ToolbarSettings() {
  const actions = useToolbarRegistry((s) => s.actions);
  const { settingsData, updateSetting } = useSettingsStore();
  const hiddenActions = settingsData.toolbar?.hiddenActions ?? [];

  const grouped = useToolbarRegistry.getState().getGrouped();

  // Get all actions (not filtered by when()) so users can configure
  // visibility of repo-specific actions even when no repo is open
  const allGrouped: Record<string, ToolbarAction[]> = {};
  for (const group of TOOLBAR_GROUP_ORDER) {
    const groupActions: ToolbarAction[] = [];
    for (const action of actions.values()) {
      if (action.group === group) {
        groupActions.push(action);
      }
    }
    groupActions.sort((a, b) => b.priority - a.priority);
    if (groupActions.length > 0) {
      allGrouped[group] = groupActions;
    }
  }

  const toggleAction = (actionId: string) => {
    const isHidden = hiddenActions.includes(actionId);
    const newHidden = isHidden
      ? hiddenActions.filter((id) => id !== actionId)
      : [...hiddenActions, actionId];
    updateSetting("toolbar", "hiddenActions", newHidden);
  };

  const resetToDefaults = () => {
    updateSetting("toolbar", "hiddenActions", []);
  };

  const groupLabels: Record<string, string> = {
    navigation: "Navigation",
    "git-actions": "Git Actions",
    views: "Views",
    app: "Application",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-ctp-text">Toolbar</h3>
        {hiddenActions.length > 0 && (
          <button
            type="button"
            onClick={resetToDefaults}
            className="text-xs text-ctp-blue hover:text-ctp-blue/80 transition-colors"
          >
            Reset to defaults
          </button>
        )}
      </div>

      <p className="text-sm text-ctp-subtext0">
        Choose which actions appear in the toolbar. Hidden actions are still
        accessible via keyboard shortcuts and the command palette.
      </p>

      {TOOLBAR_GROUP_ORDER.map((group) => {
        const groupActions = allGrouped[group];
        if (!groupActions || groupActions.length === 0) return null;

        return (
          <div key={group}>
            <h4 className="text-sm font-medium text-ctp-subtext1 mb-2">
              {groupLabels[group] ?? group}
            </h4>
            <div className="space-y-1">
              {groupActions.map((action) => {
                const Icon = action.icon;
                const isVisible = !hiddenActions.includes(action.id);

                return (
                  <label
                    key={action.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-ctp-surface0 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleAction(action.id)}
                      className="w-4 h-4 rounded border-ctp-surface1 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue/50 focus:ring-offset-0"
                    />
                    <Icon className="w-4 h-4 text-ctp-subtext1 shrink-0" />
                    <span className="text-sm text-ctp-text flex-1">
                      {action.label}
                    </span>
                    {action.shortcut && (
                      <span className="text-xs text-ctp-subtext0 font-mono">
                        {formatShortcut(action.shortcut)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
