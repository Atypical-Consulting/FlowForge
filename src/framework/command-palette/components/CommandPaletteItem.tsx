import type { Command } from "../commandRegistry";
import { formatShortcut } from "../formatShortcut";
import { highlightMatches } from "../fuzzySearch";

interface CommandPaletteItemProps {
  command: Command;
  isSelected: boolean;
  matchedRanges: [number, number][];
  onClick: () => void;
  index: number;
}

function parseKeys(formatted: string): string[] {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  if (isMac) {
    return formatted.split("");
  }
  return formatted.split("+");
}

export function CommandPaletteItem({
  command,
  isSelected,
  matchedRanges,
  onClick,
  index,
}: CommandPaletteItemProps) {
  const segments = highlightMatches(command.title, matchedRanges);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors duration-75 ${
        isSelected
          ? "bg-ctp-blue/15 text-ctp-text"
          : "text-ctp-subtext1 hover:bg-ctp-surface1/50"
      }`}
      onClick={onClick}
      data-command-index={index}
    >
      {command.icon && (
        <command.icon className="w-5 h-5 text-ctp-overlay0 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">
          {segments.map((seg, i) =>
            seg.highlighted ? (
              <span key={i} className="text-ctp-blue font-medium">
                {seg.text}
              </span>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </div>
        {command.description && (
          <div className="text-xs text-ctp-overlay0 truncate">
            {command.description}
          </div>
        )}
      </div>
      {command.shortcut && (
        <span className="inline-flex items-center gap-0.5 shrink-0">
          {parseKeys(formatShortcut(command.shortcut)).map((key, i) => (
            <kbd
              key={`${key}-${i}`}
              className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[10px] font-mono font-medium rounded bg-ctp-surface0/80 text-ctp-subtext0"
            >
              {key}
            </kbd>
          ))}
        </span>
      )}
    </div>
  );
}
