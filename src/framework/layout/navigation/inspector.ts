/**
 * Dev-mode XState inspector setup.
 *
 * Provides createBrowserInspector from @statelyai/inspect for visualizing
 * the navigation FSM state, events, and transitions in real time.
 *
 * Usage: Import getInspector() and pass the result to createActor's inspect option.
 * The inspector is only loaded in dev mode and is tree-shaken from production builds.
 *
 * Note: The NavigationProvider currently creates the actor without the inspector.
 * To enable it, modify context.tsx to call getInspector() and pass it when creating
 * the actor. This is intentionally opt-in to avoid popup blockers in dev.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let inspectorInstance: any = null;

export async function getInspector() {
  if (!import.meta.env.DEV) return undefined;

  if (!inspectorInstance) {
    try {
      const { createBrowserInspector } = await import("@statelyai/inspect");
      inspectorInstance = createBrowserInspector({
        filter: (inspEvent: { type: string; event?: { type: string } }) => {
          // Filter out high-frequency dirty state events
          if (inspEvent.type === "@xstate.event") {
            const eventType = inspEvent.event?.type;
            return eventType !== "MARK_DIRTY" && eventType !== "MARK_CLEAN";
          }
          return true;
        },
      });
    } catch {
      // @statelyai/inspect not installed — inspector unavailable
      return undefined;
    }
  }

  return inspectorInstance?.inspect;
}
