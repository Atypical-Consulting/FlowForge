import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/core/test-utils/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      exclude: ["node_modules", "dist", "src-tauri"],
      css: false,
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/bindings.ts",
          "src/core/test-utils/**",
          "src/__mocks__/**",
          "src/vite-env.d.ts",
          "src/**/*.test.{ts,tsx}",
        ],
      },
    },
  }),
);
