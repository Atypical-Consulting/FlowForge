import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
// Variable-based variant: follows the active flavour via the --ctp-* variables
// mapped in src/index.css (Latte in light mode, Mocha in dark mode).
import "@catppuccin/highlightjs/css/catppuccin-variables.css";
import { useMemo } from "react";
import { createMarkdownComponents } from "./markdownComponents";

/**
 * Sanitize schema that allows highlight.js class names.
 * Based on GitHub's default schema with hljs-* and language-* classes allowed.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code || []),
      ["className", /^hljs-/, /^language-/],
    ],
    span: [...(defaultSchema.attributes?.span || []), ["className", /^hljs-/]],
  },
};

interface MarkdownRendererProps {
  /** Markdown content string */
  content: string;
  /** Current file path for resolving relative links/images. Empty string if not file-based. */
  currentFilePath?: string;
  /** Additional CSS class for the wrapper */
  className?: string;
}

/**
 * Reusable markdown renderer with GFM support, syntax highlighting,
 * XSS sanitization, and Catppuccin-themed styling.
 *
 * Used by:
 * - ViewerMarkdownBlade (standalone markdown file preview)
 * - DiffBlade (markdown toggle preview)
 */
export function MarkdownRenderer({
  content,
  currentFilePath = "",
  className,
}: MarkdownRendererProps) {
  const components = useMemo(
    () => createMarkdownComponents(currentFilePath),
    [currentFilePath],
  );

  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
}
