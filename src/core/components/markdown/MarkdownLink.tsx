import { openUrl } from "@tauri-apps/plugin-opener";
import type { AnchorHTMLAttributes } from "react";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { resolveRelativePath } from "../../lib/resolveRelativePath";

interface MarkdownLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Current file path for resolving relative links */
  currentFilePath: string;
}

export function MarkdownLink({
  href,
  children,
  currentFilePath,
  ...props
}: MarkdownLinkProps) {
  const { replaceBlade, pushBlade } = useBladeNavigation();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!href) return;

    // Anchor links (same page)
    if (href.startsWith("#")) {
      return;
    }

    // External links
    if (href.startsWith("http://") || href.startsWith("https://")) {
      await openUrl(href);
      return;
    }

    // Relative links
    const resolvedPath = resolveRelativePath(currentFilePath, href);

    if (href.endsWith(".md") || href.endsWith(".mdx")) {
      // Markdown link → replace current blade
      replaceBlade({
        type: "viewer-markdown",
        title: resolvedPath.split("/").pop() || "Markdown",
        props: { filePath: resolvedPath },
      });
    } else {
      // Other file/directory → push repo browser
      pushBlade({
        type: "repo-browser",
        title: resolvedPath.split("/").pop() || "Browser",
        props: { path: resolvedPath },
      });
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-ctp-blue hover:text-ctp-sapphire underline underline-offset-2 cursor-pointer"
      {...props}
    >
      {children}
    </a>
  );
}
