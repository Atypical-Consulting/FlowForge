import { createActor } from "xstate";
import { describe, it, expect, vi } from "vitest";
import { navigationMachine } from "./navigationMachine";

function createTestActor() {
  const actor = createActor(navigationMachine);
  actor.start();
  return actor;
}

describe("navigationMachine", () => {
  // --- Basic State ---

  it("1. starts in navigating with staging root blade", () => {
    const actor = createTestActor();
    const snap = actor.getSnapshot();

    expect(snap.value).toBe("navigating");
    expect(snap.context.activeProcess).toBe("staging");
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0].type).toBe("staging-changes");
    expect(snap.context.bladeStack[0].id).toBe("root");
    expect(snap.context.lastAction).toBe("init");
    expect(snap.context.dirtyBladeIds).toEqual({});
    expect(snap.context.pendingEvent).toBeNull();

    actor.stop();
  });

  // --- Push ---

  it("2. PUSH_BLADE adds blade and sets lastAction='push'", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "commit-details",
      title: "Commit abc",
      props: { oid: "abc123" },
    });

    const snap = actor.getSnapshot();
    expect(snap.context.bladeStack).toHaveLength(2);
    expect(snap.context.bladeStack[1].type).toBe("commit-details");
    expect(snap.context.bladeStack[1].title).toBe("Commit abc");
    expect(snap.context.bladeStack[1].props).toEqual({ oid: "abc123" });
    expect(snap.context.bladeStack[1].id).not.toBe("root");
    expect(snap.context.lastAction).toBe("push");

    actor.stop();
  });

  // --- Pop ---

  it("3. POP_BLADE removes top blade when stack > 1 and sets lastAction='pop'", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });
    actor.send({ type: "POP_BLADE" });

    const snap = actor.getSnapshot();
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.lastAction).toBe("pop");

    actor.stop();
  });

  it("4. POP_BLADE is no-op when only root blade exists", () => {
    const actor = createTestActor();
    actor.send({ type: "POP_BLADE" });

    expect(actor.getSnapshot().context.bladeStack).toHaveLength(1);
    expect(actor.getSnapshot().context.lastAction).toBe("init"); // unchanged

    actor.stop();
  });

  // --- Pop to index ---

  it("5. POP_TO_INDEX slices stack to given index", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "changelog",
      title: "Changelog",
      props: {} as Record<string, never>,
    });
    actor.send({ type: "POP_TO_INDEX", index: 0 });

    const snap = actor.getSnapshot();
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0].type).toBe("staging-changes");
    expect(snap.context.lastAction).toBe("pop");

    actor.stop();
  });

  // --- Replace ---

  it("6. REPLACE_BLADE swaps top blade and sets lastAction='replace'", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });
    actor.send({
      type: "REPLACE_BLADE",
      bladeType: "changelog",
      title: "Changelog",
      props: {} as Record<string, never>,
    });

    const snap = actor.getSnapshot();
    expect(snap.context.bladeStack).toHaveLength(2);
    expect(snap.context.bladeStack[1].type).toBe("changelog");
    expect(snap.context.lastAction).toBe("replace");

    actor.stop();
  });

  // --- Reset ---

  it("7. RESET_STACK returns to single root blade", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "changelog",
      title: "Changelog",
      props: {} as Record<string, never>,
    });
    actor.send({ type: "RESET_STACK" });

    const snap = actor.getSnapshot();
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0].type).toBe("staging-changes");
    expect(snap.context.lastAction).toBe("reset");

    actor.stop();
  });

  // --- Switch process ---

  it("8. SWITCH_PROCESS changes process and resets to new root", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "commit-details",
      title: "Commit",
      props: { oid: "abc" },
    });
    actor.send({ type: "SWITCH_PROCESS", process: "topology" });

    const snap = actor.getSnapshot();
    expect(snap.context.activeProcess).toBe("topology");
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0].type).toBe("topology-graph");
    expect(snap.context.lastAction).toBe("reset");

    actor.stop();
  });

  // --- Singleton guard ---

  it("9. Singleton guard blocks duplicate settings push", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });

    expect(actor.getSnapshot().context.bladeStack).toHaveLength(2); // not 3

    actor.stop();
  });

  it("10. Singleton guard allows non-singleton duplicates", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff 1",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff 2",
      props: { source: { mode: "staging", filePath: "b.ts", staged: false } },
    });

    expect(actor.getSnapshot().context.bladeStack).toHaveLength(3);

    actor.stop();
  });

  // --- Max stack depth ---

  it("11. Max stack depth guard blocks push at limit", () => {
    const actor = createTestActor();

    // Default maxStackDepth is 8, already have 1 root blade
    for (let i = 0; i < 10; i++) {
      actor.send({
        type: "PUSH_BLADE",
        bladeType: "diff",
        title: `Diff ${i}`,
        props: {
          source: { mode: "staging", filePath: `file${i}.ts`, staged: false },
        },
      });
    }

    expect(actor.getSnapshot().context.bladeStack.length).toBeLessThanOrEqual(
      8,
    );

    actor.stop();
  });

  // --- Dirty state ---

  it("12. MARK_DIRTY adds blade ID to dirtyBladeIds", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });

    expect(actor.getSnapshot().context.dirtyBladeIds[bladeId]).toBe(true);

    actor.stop();
  });

  it("13. MARK_CLEAN removes blade ID from dirtyBladeIds", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "MARK_CLEAN", bladeId });

    expect(actor.getSnapshot().context.dirtyBladeIds[bladeId]).toBeUndefined();

    actor.stop();
  });

  // --- Dirty-form guard flow ---

  it("14. POP_BLADE on dirty top blade enters confirmingDiscard with pendingEvent", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "POP_BLADE" });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("confirmingDiscard");
    expect(snap.context.pendingEvent).toEqual({ type: "POP_BLADE" });
    // Stack unchanged
    expect(snap.context.bladeStack).toHaveLength(2);

    actor.stop();
  });

  it("15. CONFIRM_DISCARD from confirmingDiscard pops blade and returns to navigating", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "POP_BLADE" });
    actor.send({ type: "CONFIRM_DISCARD" });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("navigating");
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.pendingEvent).toBeNull();
    expect(Object.keys(snap.context.dirtyBladeIds)).toHaveLength(0);

    actor.stop();
  });

  it("16. CANCEL_DISCARD returns to navigating with no stack change", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "POP_BLADE" });
    actor.send({ type: "CANCEL_DISCARD" });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("navigating");
    expect(snap.context.bladeStack).toHaveLength(2);
    expect(snap.context.pendingEvent).toBeNull();
    // Dirty state preserved — user chose to stay
    expect(snap.context.dirtyBladeIds[bladeId]).toBe(true);

    actor.stop();
  });

  it("17. SWITCH_PROCESS with dirty blades enters confirmingDiscard", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "SWITCH_PROCESS", process: "topology" });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("confirmingDiscard");
    expect(snap.context.pendingEvent).toEqual({
      type: "SWITCH_PROCESS",
      process: "topology",
    });
    // Still on staging
    expect(snap.context.activeProcess).toBe("staging");

    actor.stop();
  });

  it("18. RESET_STACK with dirty blades enters confirmingDiscard", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "RESET_STACK" });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("confirmingDiscard");
    expect(snap.context.pendingEvent).toEqual({ type: "RESET_STACK" });
    expect(snap.context.bladeStack).toHaveLength(2); // unchanged

    actor.stop();
  });

  it("19. PUSH_BLADE does NOT trigger confirmingDiscard (pushing doesn't discard)", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("navigating");
    expect(snap.context.bladeStack).toHaveLength(3);

    actor.stop();
  });

  it("20. Popped blade IDs are removed from dirtyBladeIds", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    // Pop without dirty guard (mark clean first)
    actor.send({ type: "MARK_CLEAN", bladeId });
    actor.send({ type: "POP_BLADE" });

    // The dirty entry should be removed
    expect(
      actor.getSnapshot().context.dirtyBladeIds[bladeId],
    ).toBeUndefined();

    actor.stop();
  });

  it("21. machine.provide() can override guards for testing", () => {
    const testMachine = navigationMachine.provide({
      guards: {
        isNotSingleton: () => true,
      },
    });

    const actor = createActor(testMachine);
    actor.start();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings 2",
      props: {} as Record<string, never>,
    });

    // Guard overridden: duplicate allowed
    expect(actor.getSnapshot().context.bladeStack).toHaveLength(3);

    actor.stop();
  });

  // --- Additional dirty-form scenarios ---

  it("CONFIRM_DISCARD after SWITCH_PROCESS performs the switch", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "SWITCH_PROCESS", process: "topology" });
    actor.send({ type: "CONFIRM_DISCARD" });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("navigating");
    expect(snap.context.activeProcess).toBe("topology");
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0].type).toBe("topology-graph");

    actor.stop();
  });

  it("CONFIRM_DISCARD after RESET_STACK performs the reset", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "RESET_STACK" });
    actor.send({ type: "CONFIRM_DISCARD" });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("navigating");
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0].type).toBe("staging-changes");

    actor.stop();
  });

  it("REPLACE_BLADE with dirty top blade enters confirmingDiscard", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({
      type: "REPLACE_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });

    expect(actor.getSnapshot().value).toBe("confirmingDiscard");

    actor.stop();
  });

  it("POP_TO_INDEX with dirty blade above index enters confirmingDiscard", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff 1",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff 2",
      props: { source: { mode: "staging", filePath: "b.ts", staged: false } },
    });

    const bladeId = actor.getSnapshot().context.bladeStack[2].id;
    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "POP_TO_INDEX", index: 0 });

    expect(actor.getSnapshot().value).toBe("confirmingDiscard");
    expect(actor.getSnapshot().context.bladeStack).toHaveLength(3); // unchanged

    actor.stop();
  });

  it("RESET_STACK clears all dirty entries", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    // Mark dirty, then clean so we can reset without confirmation
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;
    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "MARK_CLEAN", bladeId });

    actor.send({ type: "RESET_STACK" });

    expect(
      Object.keys(actor.getSnapshot().context.dirtyBladeIds),
    ).toHaveLength(0);

    actor.stop();
  });

  it("pendingEvent is cleared after CANCEL_DISCARD", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "POP_BLADE" });

    expect(actor.getSnapshot().context.pendingEvent).not.toBeNull();

    actor.send({ type: "CANCEL_DISCARD" });

    expect(actor.getSnapshot().context.pendingEvent).toBeNull();

    actor.stop();
  });

  it("CONFIRM_DISCARD after REPLACE_BLADE performs the replace", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    const bladeId = actor.getSnapshot().context.bladeStack[1].id;

    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({
      type: "REPLACE_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });
    actor.send({ type: "CONFIRM_DISCARD" });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("navigating");
    expect(snap.context.bladeStack).toHaveLength(2);
    expect(snap.context.bladeStack[1].type).toBe("settings");
    expect(snap.context.pendingEvent).toBeNull();
    expect(Object.keys(snap.context.dirtyBladeIds)).toHaveLength(0);

    actor.stop();
  });

  it("CONFIRM_DISCARD after POP_TO_INDEX performs the pop", () => {
    const actor = createTestActor();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff 1",
      props: { source: { mode: "staging", filePath: "a.ts", staged: false } },
    });
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "diff",
      title: "Diff 2",
      props: { source: { mode: "staging", filePath: "b.ts", staged: false } },
    });

    const bladeId = actor.getSnapshot().context.bladeStack[2].id;
    actor.send({ type: "MARK_DIRTY", bladeId });
    actor.send({ type: "POP_TO_INDEX", index: 0 });
    actor.send({ type: "CONFIRM_DISCARD" });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("navigating");
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0].type).toBe("staging-changes");

    actor.stop();
  });

  it("switching process clears dirty state", () => {
    const actor = createTestActor();

    actor.send({
      type: "SWITCH_PROCESS",
      process: "topology",
    });

    expect(Object.keys(actor.getSnapshot().context.dirtyBladeIds)).toHaveLength(0);
    expect(actor.getSnapshot().context.activeProcess).toBe("topology");

    actor.stop();
  });

  it("singleton duplicate push triggers notifySingletonExists (not silently dropped)", () => {
    const notifyFn = vi.fn();
    const testMachine = navigationMachine.provide({
      actions: {
        notifySingletonExists: notifyFn,
      },
    });

    const actor = createActor(testMachine);
    actor.start();

    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings",
      title: "Settings",
      props: {} as Record<string, never>,
    });

    // Stack should still be 2 (root + settings, not 3)
    expect(actor.getSnapshot().context.bladeStack).toHaveLength(2);
    // But the action should have been called
    expect(notifyFn).toHaveBeenCalled();

    actor.stop();
  });

  it("notifyMaxDepth action is called when push is blocked at max depth", () => {
    const notifyFn = vi.fn();
    const testMachine = navigationMachine.provide({
      actions: {
        notifyMaxDepth: notifyFn,
      },
    });

    const actor = createActor(testMachine);
    actor.start();

    // Fill to max depth (default 8)
    for (let i = 0; i < 8; i++) {
      actor.send({
        type: "PUSH_BLADE",
        bladeType: "diff",
        title: `Diff ${i}`,
        props: {
          source: { mode: "staging", filePath: `f${i}.ts`, staged: false },
        },
      });
    }

    // This should trigger notifyMaxDepth
    expect(notifyFn).toHaveBeenCalled();

    actor.stop();
  });
});
