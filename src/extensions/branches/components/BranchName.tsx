import { cn } from "@/framework/lib/utils";

/**
 * Split a branch name into its directory-like prefix and its last path
 * segment: `"origin/feature/login"` → `{ prefix: "origin/feature/", leaf: "login" }`.
 * Names without a slash have an empty prefix.
 */
export function splitBranchName(name: string): {
  prefix: string;
  leaf: string;
} {
  const idx = name.lastIndexOf("/");
  if (idx === -1 || idx === name.length - 1) return { prefix: "", leaf: name };
  return { prefix: name.slice(0, idx + 1), leaf: name.slice(idx + 1) };
}

interface BranchNameProps {
  name: string;
  className?: string;
}

/**
 * Branch name that fills the free space of its flex row and, when space is
 * truly insufficient, truncates the *start* of the name first so the last
 * path segment (the distinctive part) stays visible: `…/login`, not
 * `origin/…`. The full name is always available in the `title` tooltip.
 */
export function BranchName({ name, className }: BranchNameProps) {
  const { prefix, leaf } = splitBranchName(name);

  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-baseline overflow-hidden whitespace-nowrap",
        className,
      )}
      title={name}
      data-testid="branch-name"
    >
      {prefix && (
        // `dir="rtl"` moves the ellipsis to the leading edge; the trailing
        // U+200E (LRM) keeps the final "/" on the LTR run. The large shrink
        // factor makes the prefix give up its width before the leaf does.
        <span
          className="min-w-0 shrink-[1000] truncate text-left"
          dir="rtl"
          data-testid="branch-name-prefix"
        >
          {prefix}
          {"\u200E"}
        </span>
      )}
      <span className="min-w-0 truncate" data-testid="branch-name-leaf">
        {leaf}
      </span>
    </span>
  );
}
