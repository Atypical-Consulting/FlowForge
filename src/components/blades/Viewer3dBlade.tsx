import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  animFrameId: number;
  resizeObserver: ResizeObserver;
}

export function Viewer3dBlade({ filePath }: Viewer3dBladeProps) {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [fileSize, setFileSize] = useState(0);
  const retryCount = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);

  // Load model from git HEAD
  const loadModel = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setModelReady(false);
    setContextLost(false);

    // WebGL capability check
    try {
      const testCanvas = document.createElement("canvas");
      const gl =
        testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
      if (!gl) {
        setFetchError("WebGL is not supported by your browser or GPU");
        setLoading(false);
        return;
      }
    } catch {
      console.warn(
        "[Viewer3dBlade] WebGL detection failed, proceeding anyway",
      );
    }

    try {
      const result = await commands.readRepoFile(filePath);
      if (result.status !== "ok") {
        setFetchError(getErrorMessage(result.error));
        setLoading(false);
        return;
      }

      const { content, isBinary, size } = result.data;
      setFileSize(size);

      let arrayBuffer: ArrayBuffer;

      if (isBinary) {
        // Binary (.glb) — decode base64 via atob + Uint8Array
        try {
          const binaryString = atob(content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer as ArrayBuffer;
        } catch (decodeErr) {
          console.error("[Viewer3dBlade] Base64 decode failed:", decodeErr);
          setFetchError(
            decodeErr instanceof Error
              ? decodeErr.message
              : "Base64 decode failed",
          );
          setLoading(false);
          return;
        }
      } else {
        // Text (.gltf) — encode to ArrayBuffer
        arrayBuffer = new TextEncoder().encode(content)
          .buffer as ArrayBuffer;
      }

      // Store the buffer for the Three.js effect to pick up
      bufferRef.current = arrayBuffer;
      setLoading(false);
    } catch (err) {
      console.error("[Viewer3dBlade] Model load failed:", err);
      setFetchError(
        err instanceof Error ? err.message : "Failed to load model",
      );
      setLoading(false);
    }
  }, [filePath]);

  // Ref to pass the loaded ArrayBuffer to the Three.js setup effect
  const bufferRef = useRef<ArrayBuffer | null>(null);

  // Initial load
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Three.js scene setup and model parsing
  useEffect(() => {
    if (loading || fetchError || !bufferRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const arrayBuffer = bufferRef.current;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);

    // Create camera
    const aspect = rect.width / rect.height || 1;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 1, 3);

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e2e); // Catppuccin base

    // Create controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 7.5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-5, 5, -5);
    scene.add(dirLight2);

    // Animation loop
    let animFrameId = 0;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ResizeObserver for responsive canvas
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(container);

    // WebGL context loss/restore handling
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    // Store refs for cleanup
    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      animFrameId,
      resizeObserver,
    };

    // Parse the GLTF/GLB model
    const loader = new GLTFLoader();
    loader.parse(
      arrayBuffer,
      "",
      (gltf) => {
        // Center and scale the model to fit the viewport
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 2 / maxDim : 1;
        gltf.scene.scale.multiplyScalar(scale);
        gltf.scene.position.sub(center.multiplyScalar(scale));
        scene.add(gltf.scene);

        camera.position.set(0, 1, 3);
        controls.target.set(0, 0, 0);
        controls.update();

        setModelReady(true);

        // Show interaction hint on first ever load
        const hintKey = "flowforge-3d-hint-seen";
        if (!localStorage.getItem(hintKey)) {
          setShowHint(true);
          localStorage.setItem(hintKey, "true");
        }
      },
      (error) => {
        console.error("[Viewer3dBlade] GLTF parse error:", error);
        setFetchError(
          error instanceof Error ? error.message : "Failed to parse 3D model",
        );
      },
    );

    // Keep animFrameId up to date in the ref
    const updateAnimId = () => {
      if (sceneRef.current) {
        sceneRef.current.animFrameId = animFrameId;
      }
    };
    updateAnimId();

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      controls.dispose();

      // Traverse and dispose all geometries and materials
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              for (const material of object.material) {
                disposeMaterial(material);
              }
            } else {
              disposeMaterial(object.material);
            }
          }
        }
      });

      renderer.dispose();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      sceneRef.current = null;
    };
  }, [loading, fetchError]);

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

  // Retry handler — dispose old Three.js scene, reset state, reload
  const handleRetry = useCallback(() => {
    retryCount.current += 1;

    // Dispose old scene if it exists
    if (sceneRef.current) {
      const { renderer, scene, controls, animFrameId, resizeObserver } =
        sceneRef.current;
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              for (const material of object.material) {
                disposeMaterial(material);
              }
            } else {
              disposeMaterial(object.material);
            }
          }
        }
      });
      renderer.dispose();
      sceneRef.current = null;
    }

    bufferRef.current = null;
    loadModel();
  }, [loadModel]);

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

  if (!bufferRef.current) {
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
      <div
        className="flex-1 flex flex-col items-center justify-center bg-ctp-mantle gap-4"
        role="alert"
      >
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
      aria-label={`3D viewer: ${fileName}`}
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
              <span className="text-ctp-subtext1">
                {formatFileSize(fileSize)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Canvas container */}
      <div className="h-full overflow-hidden relative" ref={containerRef}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            opacity: modelReady ? 1 : 0,
            transition: "opacity 200ms ease-out",
          }}
        />

        {/* Loading overlay (pulsing animation — GLTFLoader.parse doesn't report progress for in-memory data) */}
        {!modelReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ctp-mantle z-10">
            <Box className="w-8 h-8 text-ctp-overlay0 animate-pulse" />
            <div className="w-48 h-1.5 bg-ctp-surface0 rounded-full overflow-hidden">
              <div className="h-full bg-ctp-blue rounded-full w-full animate-pulse" />
            </div>
            <p className="text-xs text-ctp-overlay0">Loading model...</p>
          </div>
        )}
      </div>

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

/** Dispose a Three.js material and its textures. */
function disposeMaterial(material: THREE.Material) {
  // Dispose all texture properties
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
