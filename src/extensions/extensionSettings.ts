import { getStore } from "../core/lib/store";

/**
 * Key prefix used for all extension settings in the store.
 * Full key format: `ext:{extensionId}:settings:{key}`
 */
const SETTINGS_PREFIX = "ext:";
const SETTINGS_INFIX = ":settings:";

function makeKey(extensionId: string, key: string): string {
  return `${SETTINGS_PREFIX}${extensionId}${SETTINGS_INFIX}${key}`;
}

function keyPrefix(extensionId: string): string {
  return `${SETTINGS_PREFIX}${extensionId}${SETTINGS_INFIX}`;
}

/**
 * Namespaced settings accessor for a single extension.
 *
 * All keys are stored as `ext:{extensionId}:settings:{key}` in the
 * shared tauri-plugin-store instance, keeping each extension's data
 * isolated.
 */
export class ExtensionSettings {
  private extensionId: string;

  constructor(extensionId: string) {
    this.extensionId = extensionId;
  }

  /**
   * Retrieve a setting value, returning `defaultValue` when the key
   * does not exist.
   */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const store = await getStore();
    const value = await store.get<T>(makeKey(this.extensionId, key));
    return value ?? defaultValue;
  }

  /**
   * Store a setting value and persist to disk.
   */
  async set(key: string, value: unknown): Promise<void> {
    const store = await getStore();
    await store.set(makeKey(this.extensionId, key), value);
    await store.save();
  }

  /**
   * Delete a single setting and persist to disk.
   */
  async remove(key: string): Promise<void> {
    const store = await getStore();
    await store.delete(makeKey(this.extensionId, key));
    await store.save();
  }

  /**
   * Return all settings stored for this extension as a plain object.
   */
  async getAll(): Promise<Record<string, unknown>> {
    const store = await getStore();
    const prefix = keyPrefix(this.extensionId);
    const entries = await store.entries<unknown>();
    const result: Record<string, unknown> = {};

    for (const [fullKey, value] of entries) {
      if (fullKey.startsWith(prefix)) {
        const shortKey = fullKey.slice(prefix.length);
        result[shortKey] = value;
      }
    }

    return result;
  }

  /**
   * Remove ALL settings for this extension. Called during uninstall /
   * full cleanup.
   */
  async clear(): Promise<void> {
    const store = await getStore();
    const prefix = keyPrefix(this.extensionId);
    const entries = await store.entries<unknown>();

    for (const [fullKey] of entries) {
      if (fullKey.startsWith(prefix)) {
        await store.delete(fullKey);
      }
    }

    await store.save();
  }
}
