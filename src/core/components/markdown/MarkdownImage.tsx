import { useEffect, useState } from "react";
import { commands } from "../../../bindings";
import { resolveRelativePath } from "../../lib/resolveRelativePath";

interface MarkdownImageProps {
  src?: string;
  alt?: string;
  currentFilePath: string;
}

/**
 * Maps a (lower-cased) file extension to the correct image MIME type.
 * Mirrors the backend mime_from_extension mapping so binary image data
 * URIs use registered MIME types (e.g. .ico -> image/x-icon, not image/ico).
 */
const IMAGE_MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  avif: "image/avif",
  tiff: "image/tiff",
  tif: "image/tiff",
};

/**
 * Custom image component for markdown rendering.
 * data: URLs are used directly.
 * External (http/https) URLs are not loaded by default — to avoid leaking
 * a file-open event / IP to attacker-controlled hosts via tracking pixels
 * embedded in untrusted markdown — and require an explicit user opt-in.
 * Relative paths are fetched from git HEAD via readRepoFile.
 */
export function MarkdownImage({
  src,
  alt,
  currentFilePath,
}: MarkdownImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [externalAllowed, setExternalAllowed] = useState(false);

  const isExternal =
    !!src && (src.startsWith("http://") || src.startsWith("https://"));

  // biome-ignore lint/correctness/useExhaustiveDependencies: src is the intended trigger — re-running this effect on each source change is what resets the per-source external opt-in.
  useEffect(() => {
    // Reset the per-source opt-in whenever the source changes.
    setExternalAllowed(false);
  }, [src]);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    // data: URL — safe to use directly (no outbound request)
    if (src.startsWith("data:")) {
      setImageSrc(src);
      setLoading(false);
      return;
    }

    // External http(s) URL — only load after explicit user opt-in
    if (src.startsWith("http://") || src.startsWith("https://")) {
      if (externalAllowed) {
        setImageSrc(src);
      } else {
        setImageSrc(null);
      }
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
            const mime = IMAGE_MIME_TYPES[ext] ?? "application/octet-stream";
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
  }, [src, currentFilePath, externalAllowed]);

  if (loading) {
    return (
      <span className="inline-block w-5 h-5 animate-spin rounded-full border-2 border-ctp-overlay0 border-t-transparent align-middle" />
    );
  }

  // External image not yet loaded — offer an explicit opt-in instead of
  // silently firing an outbound request to an untrusted host.
  if (isExternal && !externalAllowed && !error) {
    return (
      <button
        type="button"
        onClick={() => setExternalAllowed(true)}
        title={src}
        className="text-ctp-blue text-xs italic underline hover:text-ctp-sapphire"
      >
        [load external image: {alt || src}]
      </button>
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
    <img src={imageSrc} alt={alt || ""} className="max-w-full rounded my-2" />
  );
}
