import type { AnyActorRef, AnyStateMachine } from "xstate";
import { createActor } from "xstate";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface MachineRegistryEntry {
  id: string;
  actor: AnyActorRef;
  machine: AnyStateMachine;
  /** "core" for built-in machines, "ext:{extensionId}" for extension machines */
  source: string;
  /** Machine category for grouping (e.g. "workflow", "dialog", "process") */
  category: string;
  description?: string;
}

// --- Store ---

export interface MachineRegistryState {
  machines: Map<string, MachineRegistryEntry>;
  register: (entry: MachineRegistryEntry) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  get: (id: string) => MachineRegistryEntry | undefined;
  getActor: (id: string) => AnyActorRef | undefined;
  getAll: () => MachineRegistryEntry[];
  getByCategory: (category: string) => MachineRegistryEntry[];
}

export const useMachineRegistry = create<MachineRegistryState>()(
  devtools(
    (set, get) => ({
      machines: new Map<string, MachineRegistryEntry>(),

      register: (entry) => {
        const prev = get().machines;
        if (prev.has(entry.id)) {
          console.warn(
            `[MachineRegistry] Machine "${entry.id}" already registered`,
          );
          return;
        }
        const next = new Map(prev);
        next.set(entry.id, entry);
        set({ machines: next }, false, "machine-registry/register");
      },

      unregister: (id) => {
        const prev = get().machines;
        const entry = prev.get(id);
        if (!entry) return;
        entry.actor.stop();
        const next = new Map(prev);
        next.delete(id);
        set({ machines: next }, false, "machine-registry/unregister");
      },

      unregisterBySource: (source) => {
        const prev = get().machines;
        const next = new Map(prev);
        for (const [id, entry] of next) {
          if (entry.source === source) {
            entry.actor.stop();
            next.delete(id);
          }
        }
        set({ machines: next }, false, "machine-registry/unregisterBySource");
      },

      get: (id) => get().machines.get(id),

      getActor: (id) => get().machines.get(id)?.actor,

      getAll: () => Array.from(get().machines.values()),

      getByCategory: (category) =>
        Array.from(get().machines.values()).filter(
          (entry) => entry.category === category,
        ),
    }),
    { name: "machine-registry", enabled: import.meta.env.DEV },
  ),
);

// --- Backward-compatible function exports ---

export function registerMachine(
  id: string,
  machine: AnyStateMachine,
  source = "core",
  category = "workflow",
): AnyActorRef {
  const existing = useMachineRegistry.getState().get(id);
  if (existing) return existing.actor;

  const actor = createActor(machine);
  actor.start();
  useMachineRegistry.getState().register({
    id,
    actor,
    machine,
    source,
    category,
  });
  return actor;
}

export function unregisterMachine(id: string): void {
  useMachineRegistry.getState().unregister(id);
}

export function unregisterMachinesBySource(source: string): void {
  useMachineRegistry.getState().unregisterBySource(source);
}

export function getMachineActor(id: string): AnyActorRef | undefined {
  return useMachineRegistry.getState().getActor(id);
}
