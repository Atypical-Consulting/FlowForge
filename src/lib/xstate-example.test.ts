// XState v5 machine testing pattern for Phase 26.
// This file demonstrates HOW to test machines with guards and transitions.
// Phase 26 will replace this with the actual navigation FSM tests.

import { setup, assign, createActor } from "xstate";

const navigationMachine = setup({
  types: {
    context: {} as {
      repoPath: string | null;
      bladeStack: string[];
    },
    events: {} as
      | { type: "OPEN_REPO"; path: string }
      | { type: "CLOSE_REPO" }
      | { type: "PUSH_BLADE"; bladeType: string }
      | { type: "POP_BLADE" },
  },
  guards: {
    isRepoOpen: ({ context }) => context.repoPath !== null,
    hasMultipleBlades: ({ context }) => context.bladeStack.length > 1,
  },
}).createMachine({
  id: "navigation",
  initial: "idle",
  context: {
    repoPath: null,
    bladeStack: [],
  },
  states: {
    idle: {
      on: {
        OPEN_REPO: {
          target: "repoOpen",
          actions: assign({
            repoPath: ({ event }) => event.path,
            bladeStack: () => ["staging-changes"],
          }),
        },
      },
    },
    repoOpen: {
      on: {
        PUSH_BLADE: {
          guard: "isRepoOpen",
          actions: assign({
            bladeStack: ({ context, event }) => [
              ...context.bladeStack,
              event.bladeType,
            ],
          }),
        },
        POP_BLADE: {
          guard: "hasMultipleBlades",
          actions: assign({
            bladeStack: ({ context }) => context.bladeStack.slice(0, -1),
          }),
        },
        CLOSE_REPO: {
          target: "idle",
          actions: assign({
            repoPath: () => null,
            bladeStack: () => [],
          }),
        },
      },
    },
  },
});

describe("XState navigation machine (example)", () => {
  it("starts in idle state", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    expect(actor.getSnapshot().value).toBe("idle");
    expect(actor.getSnapshot().context.repoPath).toBeNull();
    expect(actor.getSnapshot().context.bladeStack).toEqual([]);

    actor.stop();
  });

  it("transitions to repoOpen on OPEN_REPO", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    actor.send({ type: "OPEN_REPO", path: "/test/repo" });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("repoOpen");
    expect(snapshot.context.repoPath).toBe("/test/repo");
    expect(snapshot.context.bladeStack).toEqual(["staging-changes"]);

    actor.stop();
  });

  it("PUSH_BLADE adds to stack when repo is open (guard passes)", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    actor.send({ type: "OPEN_REPO", path: "/test/repo" });
    actor.send({ type: "PUSH_BLADE", bladeType: "commit-details" });

    expect(actor.getSnapshot().context.bladeStack).toEqual([
      "staging-changes",
      "commit-details",
    ]);

    actor.stop();
  });

  it("POP_BLADE removes from stack when multiple blades exist (guard passes)", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    actor.send({ type: "OPEN_REPO", path: "/test/repo" });
    actor.send({ type: "PUSH_BLADE", bladeType: "diff" });
    actor.send({ type: "POP_BLADE" });

    expect(actor.getSnapshot().context.bladeStack).toEqual([
      "staging-changes",
    ]);

    actor.stop();
  });

  it("POP_BLADE does nothing when only one blade (guard blocks)", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    actor.send({ type: "OPEN_REPO", path: "/test/repo" });
    actor.send({ type: "POP_BLADE" });

    expect(actor.getSnapshot().context.bladeStack).toEqual([
      "staging-changes",
    ]);

    actor.stop();
  });

  it("CLOSE_REPO returns to idle and clears context", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    actor.send({ type: "OPEN_REPO", path: "/test/repo" });
    actor.send({ type: "PUSH_BLADE", bladeType: "settings" });
    actor.send({ type: "CLOSE_REPO" });

    const snapshot = actor.getSnapshot();
    expect(snapshot.value).toBe("idle");
    expect(snapshot.context.repoPath).toBeNull();
    expect(snapshot.context.bladeStack).toEqual([]);

    actor.stop();
  });

  it("ignores PUSH_BLADE in idle state (no transition defined)", () => {
    const actor = createActor(navigationMachine);
    actor.start();

    actor.send({ type: "PUSH_BLADE", bladeType: "settings" });

    expect(actor.getSnapshot().value).toBe("idle");
    expect(actor.getSnapshot().context.bladeStack).toEqual([]);

    actor.stop();
  });
});
