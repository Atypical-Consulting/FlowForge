import { getPlatform } from "./platform";

type Platform = ReturnType<typeof getPlatform>;

export interface AppOption {
  label: string;
  value: string;
}

const editorsByPlatform: Record<Platform, AppOption[]> = {
  mac: [
    { label: "VS Code", value: "code" },
    { label: "Cursor", value: "cursor" },
    { label: "Zed", value: "zed" },
    { label: "Sublime Text", value: "subl" },
    { label: "TextMate", value: "mate" },
    { label: "BBEdit", value: "bbedit" },
    { label: "Vim", value: "vim" },
    { label: "Neovim", value: "nvim" },
  ],
  windows: [
    { label: "VS Code", value: "code" },
    { label: "Cursor", value: "cursor" },
    { label: "Notepad++", value: "notepad++" },
    { label: "Sublime Text", value: "subl" },
    { label: "Visual Studio", value: "devenv" },
    { label: "Vim", value: "vim" },
  ],
  linux: [
    { label: "VS Code", value: "code" },
    { label: "Cursor", value: "cursor" },
    { label: "Sublime Text", value: "subl" },
    { label: "Vim", value: "vim" },
    { label: "Neovim", value: "nvim" },
    { label: "Gedit", value: "gedit" },
    { label: "Kate", value: "kate" },
  ],
};

const terminalsByPlatform: Record<Platform, AppOption[]> = {
  mac: [
    { label: "Terminal", value: "terminal" },
    { label: "iTerm2", value: "iterm2" },
    { label: "Warp", value: "warp" },
    { label: "Alacritty", value: "alacritty" },
    { label: "Kitty", value: "kitty" },
    { label: "Hyper", value: "hyper" },
  ],
  windows: [
    { label: "Windows Terminal", value: "wt" },
    { label: "PowerShell", value: "powershell" },
    { label: "Command Prompt", value: "cmd" },
    { label: "Git Bash", value: "git-bash" },
    { label: "Alacritty", value: "alacritty" },
    { label: "Hyper", value: "hyper" },
  ],
  linux: [
    { label: "GNOME Terminal", value: "gnome-terminal" },
    { label: "Konsole", value: "konsole" },
    { label: "Alacritty", value: "alacritty" },
    { label: "Kitty", value: "kitty" },
    { label: "xterm", value: "xterm" },
    { label: "Hyper", value: "hyper" },
  ],
};

export function getEditorOptions(): AppOption[] {
  return editorsByPlatform[getPlatform()];
}

export function getTerminalOptions(): AppOption[] {
  return terminalsByPlatform[getPlatform()];
}
