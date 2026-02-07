import { useCallback } from "react";
import { GitBranch, Palette, Settings, Wrench } from "lucide-react";
import { type SettingsCategory, useSettingsStore } from "../../stores/settings";
import { Dialog, DialogContent } from "../ui/dialog";
import { AppearanceSettings } from "./AppearanceSettings";
import { GeneralSettings } from "./GeneralSettings";
import { GitSettings } from "./GitSettings";

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
    id: "appearance",
    label: "Appearance",
    icon: <Palette className="w-4 h-4" />,
    panel: <AppearanceSettings />,
  },
  // Uncomment when Plan 19-04 is complete:
  // {
  //   id: "integrations" as SettingsCategory,
  //   label: "Integrations",
  //   icon: <Wrench className="w-4 h-4" />,
  //   panel: null,
  // },
];

// Wrench is imported for the Integrations tab (Plan 19-04)
void Wrench;

export function SettingsWindow() {
  const { isOpen, closeSettings, activeCategory, setCategory } =
    useSettingsStore();

  const activeTab = settingsTabs.find((t) => t.id === activeCategory) ?? settingsTabs[0];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = settingsTabs.findIndex((t) => t.id === activeCategory);
      let nextIndex = currentIndex;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % settingsTabs.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + settingsTabs.length) % settingsTabs.length;
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent className="max-w-2xl h-[500px] p-0 flex overflow-hidden">
        <div className="w-[180px] border-r border-ctp-surface0 bg-ctp-base p-2 flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-ctp-text px-3 py-2">
            Settings
          </h2>
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
      </DialogContent>
    </Dialog>
  );
}
