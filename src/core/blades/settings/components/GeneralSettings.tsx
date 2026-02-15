import { useBladeRegistry } from "@/framework/layout/bladeRegistry";
import { usePreferencesStore as useSettingsStore } from "../../../stores/domain/preferences";

const tabOptions = [
  { value: "changes", label: "Changes", requiresTopology: false },
  { value: "history", label: "History", requiresTopology: true },
  { value: "topology", label: "Topology", requiresTopology: true },
] as const;

export function GeneralSettings() {
  const { settingsData: settings, updateSetting } = useSettingsStore();
  const blades = useBladeRegistry((s) => s.blades);
  const topologyAvailable = blades.has("topology-graph");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-ctp-text mb-4">General</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
              Default view when opening repository
            </label>
            <div className="flex gap-2">
              {tabOptions.map((option) => {
                const disabled = option.requiresTopology && !topologyAvailable;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    title={disabled ? "Enable the Topology extension to use this option" : undefined}
                    onClick={() =>
                      updateSetting("general", "defaultTab", option.value)
                    }
                    className={`px-4 py-2 rounded-md text-sm transition-colors ${
                      disabled
                        ? "bg-ctp-surface0 text-ctp-overlay0 opacity-50 cursor-not-allowed"
                        : settings.general.defaultTab === option.value
                          ? "bg-ctp-blue text-ctp-base font-medium"
                          : "bg-ctp-surface0 text-ctp-subtext1 hover:bg-ctp-surface1 hover:text-ctp-text"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
