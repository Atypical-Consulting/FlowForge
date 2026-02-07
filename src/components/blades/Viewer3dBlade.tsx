import "@google/model-viewer";
import { Box, Info, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "../../bindings";
import { getErrorMessage } from "../../lib/errors";
import { BladeContentLoading } from "./BladeContentLoading";
import { BladeContentError } from "./BladeContentError";
import { BladeContentEmpty } from "./BladeContentEmpty";

interface Viewer3dBladeProps {
  filePath: string;
}

export function Viewer3dBlade({ filePath }: Viewer3dBladeProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [fileSize, setFileSize] = useState(0);
  const viewerRef = useRef<HTMLElement>(null);
  const retryCount = useRef(0);

  // Load model from git HEAD
  const loadModel = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setProgress(0);
    setModelReady(false);
    setContextLost(false);

    try {
      const result = await commands.readRepoFile(filePath);
      if (result.status !== "ok") {
        setFetchError(getErrorMessage(result.error));
        setLoading(false);
        return;
      }

      const { content, isBinary, size } = result.data;
      setFileSize(size);

      if (!isBinary) {
        // .gltf files are JSON text — handle as text blob
        const ext = filePath.split(".").pop()?.toLowerCase();
        const mime = ext === "gltf" ? "model/gltf+json" : "model/gltf-binary";
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } else {
        // Binary (.glb) — use fetch-based base64 decode (handles large files)
        const ext = filePath.split(".").pop()?.toLowerCase();
        const mime = ext === "gltf" ? "model/gltf+json" : "model/gltf-binary";
        const dataUri = `data:${mime};base64,${content}`;
        const response = await fetch(dataUri);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      }

      setLoading(false);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load model");
      setLoading(false);
    }
  }, [filePath]);

  // Initial load
  useEffect(() => {
    loadModel();
    return () => {
      // Cleanup blob URL on unmount
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadModel]);

  // model-viewer event listeners
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !blobUrl) return;

    const onProgress = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.totalProgress === "number") {
        setProgress(detail.totalProgress);
      }
    };

    const onLoad = () => {
      setModelReady(true);
      // Show interaction hint on first ever load
      const hintKey = "flowforge-3d-hint-seen";
      if (!localStorage.getItem(hintKey)) {
        setShowHint(true);
        localStorage.setItem(hintKey, "true");
      }
    };

    const onError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const sourceError = detail?.sourceError;
      const msg = sourceError?.message || detail?.type || "Failed to render 3D model";
      setFetchError(msg);
    };

    viewer.addEventListener("progress", onProgress);
    viewer.addEventListener("load", onLoad);
    viewer.addEventListener("error", onError);

    return () => {
      viewer.removeEventListener("progress", onProgress);
      viewer.removeEventListener("load", onLoad);
      viewer.removeEventListener("error", onError);
    };
  }, [blobUrl]);

  // WebGL context loss detection
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // model-viewer uses Shadow DOM — access canvas via shadowRoot
    let canvasCleanup: (() => void) | undefined;

    const checkCanvas = () => {
      const canvas = viewer.shadowRoot?.querySelector("canvas");
      if (!canvas) return false;

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };

      const handleContextRestored = () => {
        setContextLost(false);
      };

      canvas.addEventListener("webglcontextlost", handleContextLost);
      canvas.addEventListener("webglcontextrestored", handleContextRestored);

      canvasCleanup = () => {
        canvas.removeEventListener("webglcontextlost", handleContextLost);
        canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      };

      return true;
    };

    // Canvas may not be immediately available — poll until found
    const interval = setInterval(() => {
      if (checkCanvas()) {
        clearInterval(interval);
      }
    }, 200);

    return () => {
      clearInterval(interval);
      canvasCleanup?.();
    };
  }, [blobUrl]);

  // Auto-hide interaction hint
  useEffect(() => {
    if (!showHint) return;
    const timer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(timer);
  }, [showHint]);

  // Hide hint on first interaction
  const handleInteraction = useCallback(() => {
    if (showHint) setShowHint(false);
  }, [showHint]);

  // Retry handler
  const handleRetry = useCallback(() => {
    retryCount.current += 1;
    // Revoke old blob URL
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    loadModel();
  }, [blobUrl, loadModel]);

  if (loading) {
    return <BladeContentLoading />;
  }

  if (fetchError) {
    return (
      <BladeContentError
        message="Failed to load 3D model"
        detail={fetchError}
        onRetry={handleRetry}
      />
    );
  }

  if (!blobUrl) {
    return (
      <BladeContentEmpty
        icon={Box}
        message="3D model not found at HEAD"
        detail={filePath}
      />
    );
  }

  // WebGL context lost state
  if (contextLost) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-ctp-mantle gap-4" role="alert">
        <Box className="w-12 h-12 text-ctp-overlay0" />
        <p className="text-sm text-ctp-subtext0">3D rendering context lost</p>
        <p className="text-xs text-ctp-overlay0">WebGL context was lost</p>
        {retryCount.current > 0 && (
          <p className="text-xs text-ctp-overlay0">
            If this keeps happening, your GPU may not support WebGL
          </p>
        )}
        <button
          type="button"
          onClick={handleRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ctp-subtext1 bg-ctp-surface0 hover:bg-ctp-surface1 rounded transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reload 3D View
        </button>
      </div>
    );
  }

  const fileName = filePath.split("/").pop() || "3D Model";
  const ext = filePath.split(".").pop()?.toLowerCase();
  const formatLabel = ext === "gltf" ? "GLTF (JSON)" : "GLTF Binary (.glb)";

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden h-full relative"
      onPointerDown={handleInteraction}
      onWheel={handleInteraction}
      aria-busy={!modelReady}
    >
      {/* Collapsible metadata panel */}
      {showMetadata && (
        <div className="bg-ctp-crust/90 backdrop-blur-sm border-b border-ctp-surface0 px-4 py-2 shrink-0">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs max-w-md">
            <div>
              <span className="text-ctp-overlay0">Format: </span>
              <span className="text-ctp-subtext1">{formatLabel}</span>
            </div>
            <div>
              <span className="text-ctp-overlay0">Size: </span>
              <span className="text-ctp-subtext1">{formatFileSize(fileSize)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading progress overlay */}
      {!modelReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ctp-mantle z-10">
          <Box className="w-8 h-8 text-ctp-overlay0" />
          <div className="w-48 h-1.5 bg-ctp-surface0 rounded-full overflow-hidden">
            <div
              className="h-full bg-ctp-blue rounded-full transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-ctp-overlay0">Loading model...</p>
        </div>
      )}

      {/* model-viewer element */}
      <model-viewer
        ref={viewerRef as React.Ref<never>}
        src={blobUrl}
        alt={fileName}
        camera-controls
        auto-rotate
        shadow-intensity="1"

        style={{
          width: "100%",
          height: "100%",
          flex: 1,
          background: `linear-gradient(to bottom, var(--catppuccin-color-base), var(--catppuccin-color-mantle))`,
          opacity: modelReady ? 1 : 0,
          transition: "opacity 200ms ease-out",
        }}
      />

      {/* Metadata toggle button (positioned inside the viewport) */}
      {modelReady && (
        <button
          type="button"
          onClick={() => setShowMetadata((v) => !v)}
          className="absolute top-2 right-2 z-20 p-1.5 rounded bg-ctp-surface0/60 hover:bg-ctp-surface0 text-ctp-overlay1 hover:text-ctp-text transition-colors backdrop-blur-sm"
          aria-label={showMetadata ? "Hide metadata" : "Show metadata"}
        >
          <Info className="w-4 h-4" />
        </button>
      )}

      {/* First-time interaction hint */}
      {showHint && modelReady && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 motion-safe:animate-[fadeOut_0.3s_ease-out_3.5s_forwards]">
          <div className="text-xs text-ctp-text/80 bg-ctp-base/60 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-3">
            <span>Drag to orbit</span>
            <span className="text-ctp-overlay0">|</span>
            <span>Scroll to zoom</span>
            <span className="text-ctp-overlay0">|</span>
            <span>Shift+drag to pan</span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
