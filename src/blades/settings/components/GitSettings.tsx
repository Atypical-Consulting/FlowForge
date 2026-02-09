import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "../../../bindings";
import { useSettingsStore } from "../../../stores/settings";
import { SettingsField } from "./SettingsField";

const GIT_CONFIG_DEBOUNCE_MS = 500;

type SaveStatus = "idle" | "saving" | "saved" | "error";

const inputClassName =
  "w-full max-w-xs px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-md text-sm text-ctp-text placeholder-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue focus:border-transparent disabled:opacity-50";

export function GitSettings() {
  const { settingsData: settings, updateSetting } = useSettingsStore();
  const autoFetchEnabled = settings.git.autoFetchInterval !== null;

  // Git global config state
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Debounce timer refs
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const branchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load global git config on mount
  useEffect(() => {
    async function loadConfig() {
      const result = await commands.getGitGlobalConfig();
      if (result.status === "ok") {
        setUserName(result.data.userName ?? "");
        setUserEmail(result.data.userEmail ?? "");
        setDefaultBranch(result.data.defaultBranch ?? "");
      } else {
        setConfigError("Failed to load global git configuration.");
      }
      setConfigLoading(false);
    }
    loadConfig();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      if (branchTimerRef.current) clearTimeout(branchTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const saveGitConfig = useCallback(
    (
      key: string,
      value: string,
      timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
    ) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        const result = await commands.setGitGlobalConfig(key, value);
        if (result.status === "ok") {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }

        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      }, GIT_CONFIG_DEBOUNCE_MS);
    },
    []
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUserName(e.target.value);
      saveGitConfig("user.name", e.target.value, nameTimerRef);
    },
    [saveGitConfig]
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUserEmail(e.target.value);
      saveGitConfig("user.email", e.target.value, emailTimerRef);
    },
    [saveGitConfig]
  );

  const handleBranchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDefaultBranch(e.target.value);
      saveGitConfig("init.defaultBranch", e.target.value, branchTimerRef);
    },
    [saveGitConfig]
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-medium text-ctp-text">Git Identity</h3>
          <span
            aria-live="polite"
            className={
              saveStatus === "saving"
                ? "text-xs text-ctp-overlay0"
                : saveStatus === "saved"
                  ? "text-xs text-ctp-green"
                  : saveStatus === "error"
                    ? "text-xs text-ctp-red"
                    : "text-xs text-transparent"
            }
          >
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved"
                : saveStatus === "error"
                  ? "Save failed"
                  : ""}
          </span>
        </div>

        {configError && (
          <div className="p-3 mb-4 bg-ctp-red/10 border border-ctp-red/30 rounded-md">
            <p className="text-sm text-ctp-red">{configError}</p>
          </div>
        )}

        <div className="space-y-4">
          <SettingsField
            label="User name"
            description="Your name for git commits (user.name)"
            htmlFor="git-user-name"
          >
            <input
              id="git-user-name"
              type="text"
              value={userName}
              onChange={handleNameChange}
              disabled={configLoading}
              className={inputClassName}
              placeholder="Jane Doe"
            />
          </SettingsField>

          <SettingsField
            label="User email"
            description="Your email for git commits (user.email)"
            htmlFor="git-user-email"
          >
            <input
              id="git-user-email"
              type="email"
              value={userEmail}
              onChange={handleEmailChange}
              disabled={configLoading}
              className={inputClassName}
              placeholder="jane@example.com"
            />
          </SettingsField>

          <SettingsField
            label="Default branch"
            description="Branch name for new repositories (init.defaultBranch)"
            htmlFor="git-default-branch"
          >
            <input
              id="git-default-branch"
              type="text"
              value={defaultBranch}
              onChange={handleBranchChange}
              disabled={configLoading}
              className={inputClassName}
              placeholder="main"
            />
          </SettingsField>
        </div>
      </div>

      <div className="border-t border-ctp-surface1" />

      <div>
        <h3 className="text-lg font-medium text-ctp-text mb-4">
          Repository Defaults
        </h3>

        <div className="space-y-4">
          <SettingsField label="Default remote" htmlFor="git-default-remote">
            <input
              id="git-default-remote"
              type="text"
              value={settings.git.defaultRemote}
              onChange={(e) =>
                updateSetting("git", "defaultRemote", e.target.value)
              }
              className={inputClassName}
              placeholder="origin"
            />
          </SettingsField>

          <SettingsField label="Auto-fetch interval">
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
          </SettingsField>
        </div>
      </div>
    </div>
  );
}
