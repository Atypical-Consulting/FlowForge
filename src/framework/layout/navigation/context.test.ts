/**
 * Regression tests for the production-only "Empty" root blade.
 *
 * In the packaged app the navigation actor's chunk is evaluated *before* the
 * entry chunk registers the workflows (ES module semantics: static imports run
 * first). These tests reproduce that order — obtain the actor before any
 * `registerWorkflow` call — and assert the stack still ends up rooted on the
 * default workflow.
 *
 * `vi.resetModules()` + dynamic imports give every test a fresh module graph so
 * the module-level singleton actor and registry start empty each time.
 */
import { describe, expect, it, vi } from "vitest";
import type { WorkflowConfig } from "./workflowRegistry";

const STAGING: WorkflowConfig = {
  id: "staging",
  label: "Staging",
  rootBlade: {
    type: "staging-changes",
    title: "Changes",
    props: {} as Record<string, never>,
  },
};

const TOPOLOGY: WorkflowConfig = {
  id: "topology",
  label: "Topology",
  rootBlade: {
    type: "topology-graph",
    title: "Topology",
    props: {} as Record<string, never>,
  },
  fallbackBlade: {
    type: "commit-list-fallback",
    title: "History",
    props: {} as Record<string, never>,
  },
};

async function loadFreshNavigation() {
  vi.resetModules();
  const context = await import("./context");
  const registry = await import("./workflowRegistry");
  return { ...context, ...registry };
}

describe("navigation context — production module evaluation order", () => {
  it("re-roots an actor obtained before any workflow was registered", async () => {
    const { getNavigationActor, registerWorkflow, getAllWorkflows } =
      await loadFreshNavigation();
    expect(getAllWorkflows()).toHaveLength(0);

    // Shared chunk evaluates first: something grabs the actor with no workflows.
    const actor = getNavigationActor();
    const before = actor.getSnapshot();
    expect(before.context.activeWorkflow).toBe("");
    expect(before.context.bladeStack[0]?.type).toBe("empty");

    // Entry chunk body runs afterwards and registers the workflows.
    registerWorkflow(STAGING);
    registerWorkflow(TOPOLOGY);

    const snap = actor.getSnapshot();
    expect(snap.value).toBe("navigating");
    expect(snap.context.activeWorkflow).toBe("staging");
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0]?.type).toBe("staging-changes");
    expect(snap.context.bladeStack[0]?.title).toBe("Changes");
    expect(snap.context.bladeStack[0]?.id).toBe("root");
  });

  it("creates the actor lazily, so workflows registered first are seen (dev order)", async () => {
    const { getNavigationActor, registerWorkflow } =
      await loadFreshNavigation();
    registerWorkflow(STAGING);

    const snap = getNavigationActor().getSnapshot();
    expect(snap.context.activeWorkflow).toBe("staging");
    expect(snap.context.bladeStack[0]?.type).toBe("staging-changes");
  });

  it("returns the same singleton on every access", async () => {
    const { getNavigationActor } = await loadFreshNavigation();
    expect(getNavigationActor()).toBe(getNavigationActor());
  });

  it("leaves a healthy stack untouched when more workflows are registered", async () => {
    const { getNavigationActor, registerWorkflow } =
      await loadFreshNavigation();
    registerWorkflow(STAGING);
    const actor = getNavigationActor();
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings" as any,
      title: "Settings",
      props: {},
    });
    const stackBefore = actor.getSnapshot().context.bladeStack;

    registerWorkflow(TOPOLOGY);

    const snap = actor.getSnapshot();
    expect(snap.context.activeWorkflow).toBe("staging");
    expect(snap.context.bladeStack).toBe(stackBefore);
  });

  it("preserves blades pushed on top of the placeholder root when healing", async () => {
    const { getNavigationActor, registerWorkflow } =
      await loadFreshNavigation();
    const actor = getNavigationActor();
    actor.send({
      type: "PUSH_BLADE",
      bladeType: "settings" as any,
      title: "Settings",
      props: {},
    });

    registerWorkflow(STAGING);

    const stack = actor.getSnapshot().context.bladeStack;
    expect(stack).toHaveLength(2);
    expect(stack[0]?.type).toBe("staging-changes");
    expect(stack[1]?.type).toBe("settings");
  });

  it("falls back to the default workflow when a persisted unknown workflow is restored", async () => {
    const { getNavigationActor, registerWorkflow } =
      await loadFreshNavigation();
    registerWorkflow(STAGING);
    const actor = getNavigationActor();

    // e.g. settings restored a workflow whose extension is no longer installed
    actor.send({ type: "SWITCH_WORKFLOW", workflow: "removed-extension" });

    const snap = actor.getSnapshot();
    expect(snap.context.activeWorkflow).toBe("staging");
    expect(snap.context.bladeStack).toHaveLength(1);
    expect(snap.context.bladeStack[0]?.type).toBe("staging-changes");
  });

  it("re-roots via RESET_STACK when the active workflow is unknown", async () => {
    const { getNavigationActor, registerWorkflow, clearWorkflows } =
      await loadFreshNavigation();
    registerWorkflow(TOPOLOGY);
    const actor = getNavigationActor();
    expect(actor.getSnapshot().context.activeWorkflow).toBe("topology");

    // The active workflow disappears and a different default takes its place.
    clearWorkflows();
    registerWorkflow(STAGING);

    const snap = actor.getSnapshot();
    expect(snap.context.activeWorkflow).toBe("staging");
    expect(snap.context.bladeStack[0]?.type).toBe("staging-changes");
  });
});
