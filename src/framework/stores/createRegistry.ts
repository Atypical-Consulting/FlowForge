import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { UseBoundStore, StoreApi } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimum shape for a registry item -- must have a source tag for cleanup. */
export interface RegistryItem {
  source?: string;
}

/** The base state every registry gets for free. */
export interface BaseRegistryState<TItem extends RegistryItem> {
  /** Internal map keyed by item ID. */
  items: Map<string, TItem>;
  /** Register a single item. */
  register: (item: TItem) => void;
  /** Register many items at once (single Map clone). */
  registerMany: (items: TItem[]) => void;
  /** Remove a single item by key. Returns true if it existed. */
  unregister: (id: string) => boolean;
  /** Remove all items matching the given source tag. */
  unregisterBySource: (source: string) => void;
  /** Remove all items whose key does NOT start with "ext:". */
  clearCoreRegistrations: () => void;
  /** Get a single item by key. */
  get: (id: string) => TItem | undefined;
  /** Get all items as an array. */
  getAll: () => TItem[];
}

/** Optional visibility-tick mixin for registries with `when()` conditions. */
export interface VisibilityMixin {
  visibilityTick: number;
  refreshVisibility: () => void;
}

/** Options for createRegistry. */
export interface CreateRegistryOptions<TItem extends RegistryItem> {
  /** Zustand devtools name. */
  name: string;
  /** Function to extract the key from an item (defaults to `(item) => item.id`). */
  getKey?: (item: TItem) => string;
  /** Include a monotonic `visibilityTick` counter + `refreshVisibility()`. */
  withVisibilityTick?: boolean;
}

// ---------------------------------------------------------------------------
// Factory overloads
// ---------------------------------------------------------------------------

/** With visibility tick enabled. */
export function createRegistry<TItem extends RegistryItem>(
  options: CreateRegistryOptions<TItem> & { withVisibilityTick: true },
): UseBoundStore<StoreApi<BaseRegistryState<TItem> & VisibilityMixin>>;

/** Without visibility tick (default). */
export function createRegistry<TItem extends RegistryItem>(
  options: CreateRegistryOptions<TItem>,
): UseBoundStore<StoreApi<BaseRegistryState<TItem>>>;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Creates a Zustand-based reactive registry with Map storage, devtools,
 * source-based cleanup, and optional visibility tick.
 *
 * Usage:
 * ```ts
 * interface MyItem extends RegistryItem { id: string; label: string; }
 * const useMyRegistry = createRegistry<MyItem>({ name: "my-registry" });
 * ```
 */
export function createRegistry<TItem extends RegistryItem>(
  options: CreateRegistryOptions<TItem>,
): UseBoundStore<StoreApi<BaseRegistryState<TItem> & Partial<VisibilityMixin>>> {
  const {
    name,
    getKey = (item: TItem) => (item as TItem & { id: string }).id,
    withVisibilityTick = false,
  } = options;

  return create<any>()(
    devtools(
      (set: any, get: any) => ({
        items: new Map<string, TItem>(),

        ...(withVisibilityTick
          ? {
              visibilityTick: 0,
              refreshVisibility: () => {
                set(
                  { visibilityTick: get().visibilityTick + 1 },
                  false,
                  `${name}/refreshVisibility`,
                );
              },
            }
          : {}),

        register: (item: TItem) => {
          const next = new Map(get().items);
          next.set(getKey(item), item);
          set({ items: next }, false, `${name}/register`);
        },

        registerMany: (items: TItem[]) => {
          const next = new Map(get().items);
          for (const item of items) {
            next.set(getKey(item), item);
          }
          set({ items: next }, false, `${name}/registerMany`);
        },

        unregister: (id: string) => {
          const prev = get().items;
          if (!prev.has(id)) return false;
          const next = new Map(prev);
          next.delete(id);
          set({ items: next }, false, `${name}/unregister`);
          return true;
        },

        unregisterBySource: (source: string) => {
          const next = new Map(get().items);
          for (const [id, item] of next) {
            if ((item as RegistryItem).source === source) {
              next.delete(id);
            }
          }
          set({ items: next }, false, `${name}/unregisterBySource`);
        },

        clearCoreRegistrations: () => {
          const next = new Map<string, TItem>(get().items);
          for (const key of Array.from(next.keys())) {
            if (!key.startsWith("ext:")) {
              next.delete(key);
            }
          }
          set({ items: next }, false, `${name}/clearCoreRegistrations`);
        },

        get: (id: string) => get().items.get(id),

        getAll: () => Array.from(get().items.values()),
      }),
      { name, enabled: import.meta.env.DEV },
    ),
  ) as any;
}
