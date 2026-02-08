// Global test setup - runs before every test file
import "@testing-library/jest-dom/vitest";
import { MotionGlobalConfig } from "framer-motion";

// Skip framer-motion animations in tests (official solution)
MotionGlobalConfig.skipAnimations = true;

// Enable Zustand auto-mocking (works with __mocks__/zustand.ts)
vi.mock("zustand");

// Polyfill crypto.randomUUID for jsdom
// Used by: blades store (pushBlade), toast store (addToast)
if (!globalThis.crypto?.randomUUID) {
  const nodeCrypto = await import("node:crypto");
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...globalThis.crypto,
      getRandomValues: (buffer: Uint8Array) =>
        nodeCrypto.randomFillSync(buffer),
      randomUUID: () => nodeCrypto.randomUUID(),
      subtle: globalThis.crypto?.subtle ?? {},
    },
  });
}

// Mock @tauri-apps/api/event globally (used by App.tsx for file watcher)
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  once: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

// Mock @tauri-apps/api/core (Channel class used by sync operations)
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  Channel: vi.fn().mockImplementation(() => ({
    onmessage: vi.fn(),
  })),
}));

// Mock @tauri-apps/plugin-store globally (used by 5 stores via getStore())
vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock @tauri-apps/plugin-dialog (used by repository open dialogs)
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
  ask: vi.fn(),
  confirm: vi.fn(),
  message: vi.fn(),
}));

// Mock @tauri-apps/plugin-opener
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
  openPath: vi.fn(),
}));
