// --- Types ---

export type EventHandler = (payload?: unknown) => void;

interface HandlerEntry {
  handler: EventHandler;
  source: string;
}

// --- ExtensionEventBus ---

/**
 * Singleton pub/sub event bus for inter-extension communication.
 *
 * Events are keyed by a fully-qualified name (e.g. "ext:github:pr-merged").
 * Each subscription tracks its source extension ID so bulk cleanup is possible
 * when an extension is deactivated.
 */
export class ExtensionEventBus {
  /** Map<eventName, Map<source, Set<HandlerEntry>>> */
  private handlers = new Map<string, Map<string, Set<HandlerEntry>>>();

  /**
   * Emit an event to all registered listeners.
   */
  emit(event: string, payload?: unknown): void {
    const bySource = this.handlers.get(event);
    if (!bySource) return;

    for (const entries of bySource.values()) {
      for (const entry of entries) {
        try {
          entry.handler(payload);
        } catch (err) {
          console.error(
            `[ExtensionEventBus] Error in handler for "${event}" (source: ${entry.source}):`,
            err,
          );
        }
      }
    }
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on(event: string, handler: EventHandler, source: string): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Map());
    }
    const bySource = this.handlers.get(event)!;
    if (!bySource.has(source)) {
      bySource.set(source, new Set());
    }

    const entry: HandlerEntry = { handler, source };
    bySource.get(source)!.add(entry);

    return () => {
      this.off(event, entry);
    };
  }

  /**
   * Remove a specific handler entry for an event.
   */
  private off(event: string, entry: HandlerEntry): void {
    const bySource = this.handlers.get(event);
    if (!bySource) return;

    const entries = bySource.get(entry.source);
    if (!entries) return;

    entries.delete(entry);

    // Clean up empty containers
    if (entries.size === 0) {
      bySource.delete(entry.source);
    }
    if (bySource.size === 0) {
      this.handlers.delete(event);
    }
  }

  /**
   * Remove ALL subscriptions originating from a given source extension.
   * Called during extension deactivation to prevent memory leaks.
   */
  removeAllForSource(source: string): void {
    for (const [event, bySource] of this.handlers) {
      bySource.delete(source);
      if (bySource.size === 0) {
        this.handlers.delete(event);
      }
    }
  }
}

export const extensionEventBus = new ExtensionEventBus();
