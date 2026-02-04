import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import type { ChangelogOutput } from "../../stores/changelogStore";

interface ChangelogPreviewProps {
  changelog: ChangelogOutput;
}

export function ChangelogPreview({ changelog }: ChangelogPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(changelog.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <span>{changelog.commitCount} commits</span>
        <span>{changelog.groups.length} groups</span>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm border rounded",
          "transition-colors",
          copied
            ? "border-green-500/30 text-green-400 bg-green-500/10"
            : "border-gray-700 text-gray-300 hover:bg-gray-800",
        )}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy to clipboard
          </>
        )}
      </button>

      {/* Markdown preview */}
      <div className="p-4 bg-gray-950 border border-gray-700 rounded max-h-75 overflow-y-auto">
        <pre className="text-sm font-mono whitespace-pre-wrap text-gray-300">
          {changelog.markdown}
        </pre>
      </div>

      {/* Group breakdown */}
      {changelog.groups.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">Breakdown</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {changelog.groups.map((group) => (
              <div
                key={group.commitType}
                className="flex justify-between p-2 bg-gray-800/50 rounded"
              >
                <span className="text-gray-300">{group.title}</span>
                <span className="text-gray-500">{group.commits.length}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
