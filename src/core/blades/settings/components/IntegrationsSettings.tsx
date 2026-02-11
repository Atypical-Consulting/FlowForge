import { useMemo, useState } from "react";
import { usePreferencesStore as useSettingsStore } from "../../../stores/domain/preferences";
import {
  type AppOption,
  getEditorOptions,
  getTerminalOptions,
} from "../../../lib/integrations-options";
import { SettingsField } from "./SettingsField";

const CUSTOM_SENTINEL = "__custom__";

const selectClassName =
  "w-full max-w-xs px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-md text-sm text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-blue focus:border-transparent";

const inputClassName =
  "w-full max-w-xs px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-md text-sm text-ctp-text focus:outline-none focus:ring-2 focus:ring-ctp-blue focus:border-transparent";

interface SettingsSelectWithCustomProps {
  label: string;
  description: string;
  htmlFor: string;
  options: AppOption[];
  value: string;
  onChange: (value: string) => void;
}

function SettingsSelectWithCustom({
  label,
  description,
  htmlFor,
  options,
  value,
  onChange,
}: SettingsSelectWithCustomProps) {
  const isPreset = value === "" || options.some((o) => o.value === value);
  const [isCustom, setIsCustom] = useState(!isPreset && value !== "");

  const selectValue = useMemo(() => {
    if (isCustom) return CUSTOM_SENTINEL;
    return value;
  }, [isCustom, value]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === CUSTOM_SENTINEL) {
      setIsCustom(true);
      onChange("");
    } else {
      setIsCustom(false);
      onChange(selected);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleUsePreset = () => {
    setIsCustom(false);
    onChange("");
  };

  return (
    <SettingsField label={label} description={description} htmlFor={htmlFor}>
      <select
        id={htmlFor}
        value={selectValue}
        onChange={handleSelectChange}
        className={selectClassName}
      >
        <option value="">None</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        <option value={CUSTOM_SENTINEL}>Custom path...</option>
      </select>

      {isCustom && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={handleCustomChange}
            placeholder="/usr/local/bin/my-app"
            className={inputClassName}
          />
          <button
            type="button"
            onClick={handleUsePreset}
            className="text-xs text-ctp-subtext0 hover:text-ctp-text transition-colors"
          >
            Use preset
          </button>
        </div>
      )}
    </SettingsField>
  );
}

export function IntegrationsSettings() {
  const { settingsData: settings, updateSetting } = useSettingsStore();
  const editorOptions = useMemo(() => getEditorOptions(), []);
  const terminalOptions = useMemo(() => getTerminalOptions(), []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-ctp-text mb-1">
          Integrations
        </h3>
        <p className="text-sm text-ctp-subtext0 mb-4">
          Configure which external editor and terminal to open from FlowForge.
        </p>
      </div>

      <div className="space-y-4">
        <SettingsSelectWithCustom
          label="External editor"
          description="Editor to use when opening files from the diff view"
          htmlFor="integrations-editor"
          options={editorOptions}
          value={settings.integrations.editor}
          onChange={(v) => updateSetting("integrations", "editor", v)}
        />

        <SettingsSelectWithCustom
          label="External terminal"
          description="Terminal to use when opening a shell in the repository"
          htmlFor="integrations-terminal"
          options={terminalOptions}
          value={settings.integrations.terminal}
          onChange={(v) => updateSetting("integrations", "terminal", v)}
        />
      </div>

      <div className="border-t border-ctp-surface1 pt-4 mt-6">
        <p className="text-xs text-ctp-overlay0">
          These preferences will be used when launching external applications
          from toolbar actions. Support for "Open in editor" and "Open terminal"
          buttons is planned for a future update.
        </p>
      </div>
    </div>
  );
}
