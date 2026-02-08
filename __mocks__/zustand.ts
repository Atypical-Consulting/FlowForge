import { act } from "@testing-library/react";
import type { StateCreator } from "zustand";

const { create: actualCreate, createStore: actualCreateStore } =
  await vi.importActual<typeof import("zustand")>("zustand");

export const storeResetFns = new Set<() => void>();

const createUncurried = <T>(stateCreator: StateCreator<T>) => {
  const store = actualCreate(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => {
    store.setState(initialState, true);
  });
  return store;
};

export const create = <T>(stateCreator?: StateCreator<T>) => {
  if (typeof stateCreator === "function") {
    return createUncurried(stateCreator);
  }
  return createUncurried;
};

const createStoreUncurried = <T>(stateCreator: StateCreator<T>) => {
  const store = actualCreateStore(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => {
    store.setState(initialState, true);
  });
  return store;
};

export const createStore = <T>(stateCreator?: StateCreator<T>) => {
  if (typeof stateCreator === "function") {
    return createStoreUncurried(stateCreator);
  }
  return createStoreUncurried;
};

afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => {
      resetFn();
    });
  });
});
