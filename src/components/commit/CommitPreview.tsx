import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { parseConventionalMessage } from "../../lib/conventional-utils";
import {
  COMMIT_TYPE_THEME,
  type ConventionalCommitType,
} from "../../lib/commit-type-theme";
import { cn } from "../../lib/utils";

interface CommitPreviewProps {
  message: string;
  variant?: "compact" | "full";
}

/**
 * Commit message preview with compact (sidebar) and full (blade) variants.
 *
 * Compact: max-h-32, plain text, sidebar-sized.
 * Full: min-h-[300px], syntax-highlighted segments, column-72 ruler, copy button.
 */
export function CommitPreview({
  message,
  variant = "compact",
}: CommitPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message]);

  if (!message) return null;

  if (variant === "compact") {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-ctp-subtext1">
          Preview
        </label>
        <pre
          className={cn(
            "p-3 text-sm bg-ctp-mantle border border-ctp-surface0 rounded",
            "text-ctp-subtext1 font-mono whitespace-pre-wrap break-words",
            "max-h-32 overflow-y-auto",
          )}
          aria-live="polite"
        >
          {message}
        </pre>
      </div>
    );
  }

  // Full variant with syntax highlighting
  const lines = message.split("\n");
  const subjectLine = lines[0] || "";
  const subjectLength = subjectLine.length;

  return (
    <div className="space-y-2 flex flex-col flex-1">
      {/* Header with copy button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-ctp-overlay1 hover:text-ctp-blue transition-colors"
          title="Copy commit message"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-ctp-green" />
              <span className="text-ctp-green">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Preview with ruler */}
      <div className="relative flex-1 min-h-[300px]">
        {/* Column-72 ruler */}
        <div
          className="absolute top-0 bottom-0 border-l border-dashed border-ctp-surface2 pointer-events-none z-10"
          style={{ left: "calc(72ch + 0.75rem)" }}
        >
          <span className="absolute -top-0.5 -left-2 text-[10px] text-ctp-surface2">
            72
          </span>
        </div>

        <pre
          className={cn(
            "p-3 text-sm bg-ctp-mantle border border-ctp-surface0 rounded",
            "font-mono whitespace-pre-wrap break-words",
            "h-full overflow-y-auto",
          )}
          aria-live="polite"
        >
          <HighlightedMessage lines={lines} />
        </pre>
      </div>

      {/* Subject character count */}
      <div className="text-xs">
        <span
          className={cn(
            "font-mono",
            subjectLength <= 50
              ? "text-ctp-green"
              : subjectLength <= 72
                ? "text-ctp-yellow"
                : "text-ctp-red",
          )}
        >
          Subject: {subjectLength}/72 characters
        </span>
      </div>
    </div>
  );
}

/**
 * Renders commit message lines with syntax highlighting on the subject.
 */
function HighlightedMessage({ lines }: { lines: string[] }) {
  const subjectLine = lines[0] || "";
  const parsed = parseConventionalMessage(subjectLine);

  return (
    <>
      {/* Subject line — syntax highlighted if CC format */}
      {parsed ? (
        <HighlightedSubject subject={subjectLine} parsed={parsed} />
      ) : (
        <span className="text-ctp-text">{subjectLine}</span>
      )}

      {/* Remaining lines */}
      {lines.slice(1).map((line, i) => (
        <span key={i}>
          {"\n"}
          <HighlightedBodyLine line={line} />
        </span>
      ))}
    </>
  );
}

function HighlightedSubject({
  subject,
  parsed,
}: {
  subject: string;
  parsed: ReturnType<typeof parseConventionalMessage> & {};
}) {
  if (!parsed) return <span className="text-ctp-text">{subject}</span>;

  const theme = COMMIT_TYPE_THEME[parsed.commitType as ConventionalCommitType];
  const typeColor = theme?.color || "text-ctp-text";

  return (
    <>
      <span className={typeColor}>{parsed.commitType}</span>
      {parsed.scope && (
        <span className="text-ctp-teal">({parsed.scope})</span>
      )}
      {parsed.isBreaking && (
        <span className="text-ctp-red font-bold">!</span>
      )}
      <span className="text-ctp-overlay1">: </span>
      <span className="text-ctp-text">{parsed.description}</span>
    </>
  );
}

function HighlightedBodyLine({ line }: { line: string }) {
  if (line.startsWith("BREAKING CHANGE: ")) {
    return (
      <>
        <span className="text-ctp-red font-bold">BREAKING CHANGE: </span>
        <span className="text-ctp-subtext1">
          {line.slice("BREAKING CHANGE: ".length)}
        </span>
      </>
    );
  }
  if (line.startsWith("BREAKING-CHANGE: ")) {
    return (
      <>
        <span className="text-ctp-red font-bold">BREAKING-CHANGE: </span>
        <span className="text-ctp-subtext1">
          {line.slice("BREAKING-CHANGE: ".length)}
        </span>
      </>
    );
  }
  return <span className="text-ctp-subtext1">{line}</span>;
}
