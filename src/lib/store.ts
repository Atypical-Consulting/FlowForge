import { Store } from "@tauri-apps/plugin-store";

let storeInstance: Store | null = null;

/**
 * Get the persistent store instance.
 * Uses lazy initialization to avoid issues during SSR/initial load.
 */
export async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await Store.load("flowforge-settings.json");
  }
  return storeInstance;
}
