import { Users } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/framework/lib/utils";
import type { CommitSummary } from "../../../bindings";

interface AuthorFilterProps {
  commits: CommitSummary[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function AuthorFilter({
  commits,
  value,
  onChange,
  className,
}: AuthorFilterProps) {
  const authors = useMemo(() => {
    const seen = new Map<string, { name: string; email: string }>();
    for (const commit of commits) {
      const key = `${commit.authorName} <${commit.authorEmail}>`;
      if (!seen.has(key)) {
        seen.set(key, { name: commit.authorName, email: commit.authorEmail });
      }
    }
    return Array.from(seen.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, info]) => ({ key, ...info }));
  }, [commits]);

  if (authors.length <= 1) {
    return null;
  }

  return (
    <div className={cn("relative flex items-center gap-1.5", className)}>
      <Users className="w-3.5 h-3.5 text-ctp-overlay0 shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full py-1.5 pl-1 pr-6 text-sm appearance-none",
          "bg-ctp-surface0 border border-ctp-surface1 rounded",
          "text-ctp-text",
          "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue/50",
          "cursor-pointer",
        )}
      >
        <option value="">All Authors ({authors.length} contributors)</option>
        {authors.map((author) => (
          <option key={author.key} value={author.key}>
            {author.name} &lt;{author.email}&gt;
          </option>
        ))}
      </select>
    </div>
  );
}
