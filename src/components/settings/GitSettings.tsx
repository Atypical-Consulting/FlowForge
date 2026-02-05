import { useSettingsStore } from "../../stores/settings";

export function GitSettings() {
  const { settings, updateSetting } = useSettingsStore();
  const autoFetchEnabled = settings.git.autoFetchInterval !== null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-ctp-text mb-4">Git</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
              Default remote
            </label>
            <input
              type="text"
              value={settings.git.defaultRemote}
              onChange={(e) =>
                updateSetting("git", "defaultRemote", e.target.value)
              }
              className="w-full max-w-xs px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-md text-sm text-ctp-text placeholder-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
              placeholder="origin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
              Auto-fetch interval
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFetchEnabled}
                  onChange={(e) =>
                    updateSetting(
                      "git",
                      "autoFetchInterval",
                      e.target.checked ? 5 : null
                    )
                  }
                  className="w-4 h-4 rounded border-ctp-surface1 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue focus:ring-offset-0"
                />
                <span className="text-sm text-ctp-subtext1">
                  Enable auto-fetch
                </span>
              </label>
              {autoFetchEnabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.git.autoFetchInterval ?? 5}
                    onChange={(e) =>
                      updateSetting(
                        "git",
                        "autoFetchInterval",
                        parseInt(e.target.value) || 5
                      )
                    }
                    className="w-20 px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-md text-sm text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-blue focus:border-transparent"
                  />
                  <span className="text-sm text-ctp-subtext0">minutes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
