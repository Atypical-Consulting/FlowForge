import { describe, it, expect, beforeEach } from "vitest";
import { setup } from "xstate";
import { useMachineRegistry } from "@/framework/extension-system/machineRegistry";

// Minimal test machine
const testMachine = setup({
  types: {
    context: {} as { count: number },
    events: {} as { type: "INC" },
  },
  actions: {
    increment: ({ context }) => ({ count: context.count + 1 }),
  },
}).createMachine({
  id: "test",
  initial: "idle",
  context: { count: 0 },
  states: { idle: {} },
});

describe("machineRegistry", () => {
  beforeEach(() => {
    // Clean up all registered machines
    const state = useMachineRegistry.getState();
    for (const entry of state.getAll()) {
      state.unregister(entry.id);
    }
  });

  it("registers a machine and returns it via get()", () => {
    const { register, get } = useMachineRegistry.getState();
    const { createActor } = require("xstate");
    const actor = createActor(testMachine);
    actor.start();

    register({
      id: "core:test",
      actor,
      machine: testMachine,
      source: "core",
      category: "workflow",
    });

    const entry = get("core:test");
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("core:test");
    expect(entry!.source).toBe("core");
    expect(entry!.category).toBe("workflow");
  });

  it("getActor returns the actor reference", () => {
    const { register, getActor } = useMachineRegistry.getState();
    const { createActor } = require("xstate");
    const actor = createActor(testMachine);
    actor.start();

    register({
      id: "core:test",
      actor,
      machine: testMachine,
      source: "core",
      category: "workflow",
    });

    expect(getActor("core:test")).toBe(actor);
    expect(getActor("nonexistent")).toBeUndefined();
  });

  it("unregister removes a machine and stops the actor", () => {
    const { register, unregister, get } = useMachineRegistry.getState();
    const { createActor } = require("xstate");
    const actor = createActor(testMachine);
    actor.start();

    register({
      id: "core:test",
      actor,
      machine: testMachine,
      source: "core",
      category: "workflow",
    });

    unregister("core:test");
    expect(get("core:test")).toBeUndefined();
  });

  it("unregisterBySource removes all machines from that source", () => {
    const { register, unregisterBySource, getAll } =
      useMachineRegistry.getState();
    const { createActor } = require("xstate");

    const actor1 = createActor(testMachine);
    actor1.start();
    const actor2 = createActor(testMachine);
    actor2.start();
    const actor3 = createActor(testMachine);
    actor3.start();

    register({
      id: "ext:github:a",
      actor: actor1,
      machine: testMachine,
      source: "ext:github",
      category: "workflow",
    });
    register({
      id: "ext:github:b",
      actor: actor2,
      machine: testMachine,
      source: "ext:github",
      category: "dialog",
    });
    register({
      id: "core:nav",
      actor: actor3,
      machine: testMachine,
      source: "core",
      category: "workflow",
    });

    unregisterBySource("ext:github");
    const remaining = getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("core:nav");
  });

  it("getAll returns all registered machines", () => {
    const { register, getAll } = useMachineRegistry.getState();
    const { createActor } = require("xstate");

    const actor1 = createActor(testMachine);
    actor1.start();
    const actor2 = createActor(testMachine);
    actor2.start();

    register({
      id: "core:a",
      actor: actor1,
      machine: testMachine,
      source: "core",
      category: "workflow",
    });
    register({
      id: "core:b",
      actor: actor2,
      machine: testMachine,
      source: "core",
      category: "dialog",
    });

    expect(getAll()).toHaveLength(2);
  });

  it("getByCategory filters machines by category", () => {
    const { register, getByCategory } = useMachineRegistry.getState();
    const { createActor } = require("xstate");

    const actor1 = createActor(testMachine);
    actor1.start();
    const actor2 = createActor(testMachine);
    actor2.start();

    register({
      id: "core:a",
      actor: actor1,
      machine: testMachine,
      source: "core",
      category: "workflow",
    });
    register({
      id: "core:b",
      actor: actor2,
      machine: testMachine,
      source: "core",
      category: "dialog",
    });

    expect(getByCategory("workflow")).toHaveLength(1);
    expect(getByCategory("workflow")[0].id).toBe("core:a");
    expect(getByCategory("dialog")).toHaveLength(1);
    expect(getByCategory("nonexistent")).toHaveLength(0);
  });

  it("warns on duplicate registration", () => {
    const { register, getAll } = useMachineRegistry.getState();
    const { createActor } = require("xstate");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const actor1 = createActor(testMachine);
    actor1.start();
    const actor2 = createActor(testMachine);
    actor2.start();

    register({
      id: "core:test",
      actor: actor1,
      machine: testMachine,
      source: "core",
      category: "workflow",
    });
    register({
      id: "core:test",
      actor: actor2,
      machine: testMachine,
      source: "core",
      category: "workflow",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("already registered"),
    );
    expect(getAll()).toHaveLength(1);
    warnSpy.mockRestore();
  });
});
