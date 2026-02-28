import type { StoreApi } from "zustand";

const storeResetFns = new Set<() => void>();

export function resetAllStores(): void {
  storeResetFns.forEach((resetFn) => resetFn());
}

export function registerStoreForReset<T>(store: StoreApi<T>): void {
  storeResetFns.add(() => {
    store.setState(store.getInitialState(), true);
  });
}
