import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import { cn } from "../../lib/utils";
import { CopyCodeButton } from "./CopyCodeButton";
import { MarkdownImage } from "./MarkdownImage";
import { MarkdownLink } from "./MarkdownLink";

/**
 * Create Catppuccin-styled component overrides for react-markdown.
 *
 * @param currentFilePath - The file being rendered (for resolving relative links/images)
 */
export function createMarkdownComponents(currentFilePath: string): Components {
  return {
    // Headings
    h1: ({ children, ...props }) => (
      <h1
        className="text-2xl font-bold text-ctp-text mt-6 mb-3 pb-2 border-b border-ctp-surface1"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2
        className="text-xl font-semibold text-ctp-text mt-5 mb-2 pb-1 border-b border-ctp-surface0"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        className="text-lg font-semibold text-ctp-subtext1 mt-4 mb-2"
        {...props}
      >
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4
        className="text-base font-semibold text-ctp-subtext1 mt-3 mb-1"
        {...props}
      >
        {children}
      </h4>
    ),
    h5: ({ children, ...props }) => (
      <h5
        className="text-sm font-semibold text-ctp-subtext0 mt-3 mb-1"
        {...props}
      >
        {children}
      </h5>
    ),
    h6: ({ children, ...props }) => (
      <h6
        className="text-sm font-medium text-ctp-overlay1 mt-2 mb-1"
        {...props}
      >
        {children}
      </h6>
    ),

    // Paragraphs
    p: ({ children, ...props }) => (
      <p className="text-sm text-ctp-text leading-relaxed mb-3" {...props}>
        {children}
      </p>
    ),

    // Tables
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-ctp-surface0 text-ctp-subtext1" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }) => (
      <th
        className="px-3 py-2 text-left font-medium border border-ctp-surface1"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        className="px-3 py-2 border border-ctp-surface0 text-ctp-subtext0"
        {...props}
      >
        {children}
      </td>
    ),
    tr: ({ children, ...props }) => (
      <tr className="even:bg-ctp-surface0/30" {...props}>
        {children}
      </tr>
    ),

    // Code blocks with copy button
    pre: ({ children, ...props }) => {
      const codeText = extractTextContent(children);
      return (
        <div className="relative group my-3">
          <pre
            className="bg-ctp-crust rounded-md p-4 overflow-x-auto text-sm"
            {...props}
          >
            {children}
          </pre>
          <CopyCodeButton code={codeText} />
        </div>
      );
    },

    // Inline and block code
    code: ({ children, className, ...props }) => {
      const isBlock =
        className?.includes("hljs") || className?.includes("language-");
      if (isBlock) {
        return (
          <code className={cn("font-mono", className)} {...props}>
            {children}
          </code>
        );
      }
      return (
        <code
          className="bg-ctp-surface0 text-ctp-peach px-1.5 py-0.5 rounded text-xs font-mono"
          {...props}
        >
          {children}
        </code>
      );
    },

    // Blockquote
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="border-l-4 border-ctp-blue pl-4 my-3 text-ctp-subtext0 italic"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Lists
    ul: ({ children, ...props }) => (
      <ul
        className="list-disc pl-6 mb-3 space-y-1 text-sm text-ctp-text"
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        className="list-decimal pl-6 mb-3 space-y-1 text-sm text-ctp-text"
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="text-ctp-subtext1" {...props}>
        {children}
      </li>
    ),

    // Task list items (GFM)
    input: ({ type, checked, ...props }) => {
      if (type === "checkbox") {
        return (
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="mr-2 accent-ctp-blue align-middle"
            {...props}
          />
        );
      }
      return <input type={type} {...props} />;
    },

    // Horizontal rule
    hr: (props) => <hr className="my-6 border-ctp-surface1" {...props} />,

    // Strong/em
    strong: ({ children, ...props }) => (
      <strong className="font-semibold text-ctp-text" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em className="italic text-ctp-subtext1" {...props}>
        {children}
      </em>
    ),

    // Links — custom handler
    a: ({ href, children, ...props }) => (
      <MarkdownLink href={href} currentFilePath={currentFilePath} {...props}>
        {children}
      </MarkdownLink>
    ),

    // Images — custom handler
    img: ({ src, alt, ...props }) => (
      <MarkdownImage
        src={src}
        alt={alt}
        currentFilePath={currentFilePath}
        {...(props as any)}
      />
    ),
  };
}

/**
 * Extract text content from React children (for code block copy button).
 */
function extractTextContent(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractTextContent((children as any).props?.children);
  }
  return "";
}
