import { useCallback } from "react";
import {
  ClipboardCheck,
  GitBranch,
  PanelTop,
  Palette,
  Settings,
  Wrench,
} from "lucide-react";
import type { SettingsCategory } from "../../stores/domain/preferences/settings.slice";
import { usePreferencesStore as useSettingsStore } from "../../stores/domain/preferences";
import { AppearanceSettings } from "./components/AppearanceSettings";
import { GeneralSettings } from "./components/GeneralSettings";
import { GitSettings } from "./components/GitSettings";
import { IntegrationsSettings } from "./components/IntegrationsSettings";
import { ReviewSettings } from "./components/ReviewSettings";
import { ToolbarSettings } from "./components/ToolbarSettings";

interface SettingsTab {
  id: SettingsCategory;
  label: string;
  icon: React.ReactNode;
  panel: React.ReactNode;
}

const settingsTabs: SettingsTab[] = [
  {
    id: "general",
    label: "General",
    icon: <Settings className="w-4 h-4" />,
    panel: <GeneralSettings />,
  },
  {
    id: "git",
    label: "Git",
    icon: <GitBranch className="w-4 h-4" />,
    panel: <GitSettings />,
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: <Wrench className="w-4 h-4" />,
    panel: <IntegrationsSettings />,
  },
  {
    id: "review",
    label: "Review",
    icon: <ClipboardCheck className="w-4 h-4" />,
    panel: <ReviewSettings />,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <Palette className="w-4 h-4" />,
    panel: <AppearanceSettings />,
  },
  {
    id: "toolbar",
    label: "Toolbar",
    icon: <PanelTop className="w-4 h-4" />,
    panel: <ToolbarSettings />,
  },
];

export function SettingsBlade() {
  const { settingsActiveCategory: activeCategory, setSettingsCategory: setCategory } = useSettingsStore();

  const activeTab =
    settingsTabs.find((t) => t.id === activeCategory) ?? settingsTabs[0];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = settingsTabs.findIndex(
        (t) => t.id === activeCategory,
      );
      let nextIndex = currentIndex;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % settingsTabs.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex =
          (currentIndex - 1 + settingsTabs.length) % settingsTabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = settingsTabs.length - 1;
      } else {
        return;
      }

      setCategory(settingsTabs[nextIndex].id);
    },
    [activeCategory, setCategory],
  );

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-45 border-r border-ctp-surface0 bg-ctp-base p-2 flex flex-col gap-1">
        <div
          role="tablist"
          aria-label="Settings categories"
          aria-orientation="vertical"
          onKeyDown={handleKeyDown}
        >
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={activeCategory === tab.id}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={activeCategory === tab.id ? 0 : -1}
              onClick={() => setCategory(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors w-full ${
                activeCategory === tab.id
                  ? "bg-ctp-blue text-ctp-base font-medium"
                  : "text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`settings-panel-${activeTab.id}`}
        aria-labelledby={`settings-tab-${activeTab.id}`}
        className="flex-1 p-6 overflow-y-auto"
      >
        {activeTab.panel}
      </div>
    </div>
  );
}
