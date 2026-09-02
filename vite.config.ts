import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [svgr(), react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Anchor the ignore patterns to the project root: a bare `**/.claude/**`
      // also matches the root itself when the checkout lives under a
      // `.claude/worktrees/` directory, which silently disables HMR there.
      ignored: [
        `${fileURLToPath(new URL("./src-tauri", import.meta.url))}/**`,
        `${fileURLToPath(new URL("./.claude", import.meta.url))}/**`,
      ],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  optimizeDeps: {
    include: ["dagre-d3-es", "monaco-editor"],
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  worker: {
    format: "es",
  },
});
