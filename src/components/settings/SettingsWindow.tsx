import { GitBranch, Palette, Settings } from "lucide-react";
import { type SettingsCategory, useSettingsStore } from "../../stores/settings";
import { Dialog, DialogContent } from "../ui/dialog";
import { AppearanceSettings } from "./AppearanceSettings";
import { GeneralSettings } from "./GeneralSettings";
import { GitSettings } from "./GitSettings";

const categories: {
  id: SettingsCategory;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "general",
    label: "General",
    icon: <Settings className="w-4 h-4" />,
  },
  { id: "git", label: "Git", icon: <GitBranch className="w-4 h-4" /> },
  {
    id: "appearance",
    label: "Appearance",
    icon: <Palette className="w-4 h-4" />,
  },
];

export function SettingsWindow() {
  const { isOpen, closeSettings, activeCategory, setCategory } =
    useSettingsStore();

  const renderContent = () => {
    switch (activeCategory) {
      case "general":
        return <GeneralSettings />;
      case "git":
        return <GitSettings />;
      case "appearance":
        return <AppearanceSettings />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent className="max-w-2xl h-[500px] p-0 flex overflow-hidden">
        <div className="w-[180px] border-r border-ctp-surface0 bg-ctp-base p-2 flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-ctp-text px-3 py-2">
            Settings
          </h2>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                activeCategory === cat.id
                  ? "bg-ctp-blue text-ctp-base font-medium"
                  : "text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text"
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-6 overflow-y-auto">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
}
