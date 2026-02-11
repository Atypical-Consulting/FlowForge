import { useEffect, useState } from "react";
import { commands } from "../../../bindings";
import { resolveRelativePath } from "../../lib/resolveRelativePath";

interface MarkdownImageProps {
  src?: string;
  alt?: string;
  currentFilePath: string;
}

/**
 * Custom image component for markdown rendering.
 * External/data URLs are used directly.
 * Relative paths are fetched from git HEAD via readRepoFile.
 */
export function MarkdownImage({ src, alt, currentFilePath }: MarkdownImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    // External or data URL — use directly
    if (
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:")
    ) {
      setImageSrc(src);
      setLoading(false);
      return;
    }

    // Relative path — fetch from git HEAD
    let cancelled = false;
    const load = async () => {
      try {
        const resolvedPath = resolveRelativePath(currentFilePath, src);
        const result = await commands.readRepoFile(resolvedPath);
        if (cancelled) return;

        if (result.status === "ok") {
          const { content, isBinary } = result.data;
          const ext = resolvedPath.split(".").pop()?.toLowerCase() || "png";

          if (isBinary) {
            // Binary image: content is base64
            const mime =
              ext === "svg"
                ? "image/svg+xml"
                : `image/${ext === "jpg" ? "jpeg" : ext}`;
            setImageSrc(`data:${mime};base64,${content}`);
          } else if (ext === "svg") {
            // SVG is text, not binary — encode as data URI
            const encoded = btoa(unescape(encodeURIComponent(content)));
            setImageSrc(`data:image/svg+xml;base64,${encoded}`);
          } else {
            // Unexpected text content for an image
            setError(true);
          }
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [src, currentFilePath]);

  if (loading) {
    return (
      <span className="inline-block w-5 h-5 animate-spin rounded-full border-2 border-ctp-overlay0 border-t-transparent align-middle" />
    );
  }

  if (error || !imageSrc) {
    return (
      <span className="text-ctp-overlay0 text-xs italic">
        [image: {alt || "unavailable"}]
      </span>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt || ""}
      className="max-w-full rounded my-2"
    />
  );
}
