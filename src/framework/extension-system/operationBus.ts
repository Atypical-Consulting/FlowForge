// ---------------------------------------------------------------------------
// Generic OperationBus — typed pre/post lifecycle hooks
// ---------------------------------------------------------------------------

/**
 * Result returned by a "will" (pre-operation) handler.
 * Return `{ cancel: true, reason: "..." }` to veto the operation.
 */
export interface WillHookResult {
  cancel?: boolean;
  reason?: string;
}

export type DidHandler<TCtx> = (ctx: TCtx) => void | Promise<void>;
export type WillHandler<TCtx> = (
  ctx: TCtx,
) => WillHookResult | Promise<WillHookResult | void> | void;

interface HandlerEntry<H> {
  handler: H;
  priority: number;
  source: string;
}

/**
 * Generic operation bus for pre/post lifecycle hooks.
 *
 * Usage:
 * ```ts
 * type FileOp = "save" | "delete" | "rename";
 * interface FileOpCtx { operation: FileOp; filePath: string; }
 *
 * const fileOpBus = new OperationBus<FileOp, FileOpCtx>("FileOpBus");
 * fileOpBus.onDid("save", (ctx) => console.log(`Saved ${ctx.filePath}`), "logger");
 * ```
 */
export class OperationBus<
  TOperation extends string,
  TContext extends { operation: TOperation },
> {
  private didHandlers = new Map<
    TOperation,
    Set<HandlerEntry<DidHandler<TContext>>>
  >();
  private willHandlers = new Map<
    TOperation,
    Set<HandlerEntry<WillHandler<TContext>>>
  >();
  private reentryDepth = 0;

  constructor(private readonly name: string = "OperationBus") {}

  onDid(
    operation: TOperation,
    handler: DidHandler<TContext>,
    source: string,
    priority = 0,
  ): () => void {
    if (!this.didHandlers.has(operation)) {
      this.didHandlers.set(operation, new Set());
    }
    const entry: HandlerEntry<DidHandler<TContext>> = {
      handler,
      priority,
      source,
    };
    this.didHandlers.get(operation)!.add(entry);

    return () => {
      this.didHandlers.get(operation)?.delete(entry);
    };
  }

  onWill(
    operation: TOperation,
    handler: WillHandler<TContext>,
    source: string,
    priority = 0,
  ): () => void {
    if (!this.willHandlers.has(operation)) {
      this.willHandlers.set(operation, new Set());
    }
    const entry: HandlerEntry<WillHandler<TContext>> = {
      handler,
      priority,
      source,
    };
    this.willHandlers.get(operation)!.add(entry);

    return () => {
      this.willHandlers.get(operation)?.delete(entry);
    };
  }

  async emitDid(
    operation: TOperation,
    ctx?: Omit<TContext, "operation">,
  ): Promise<void> {
    if (this.reentryDepth > 0) return;

    this.reentryDepth++;
    try {
      const fullCtx = { operation, ...ctx } as TContext;
      const entries = this.didHandlers.get(operation);
      if (!entries || entries.size === 0) return;

      await Promise.allSettled(
        [...entries].map(async (entry) => {
          try {
            await entry.handler(fullCtx);
          } catch (err) {
            console.error(
              `[${this.name}] Error in onDid handler for "${operation}" (source: ${entry.source}):`,
              err,
            );
          }
        }),
      );
    } finally {
      this.reentryDepth--;
    }
  }

  async emitWill(
    operation: TOperation,
    ctx?: Omit<TContext, "operation">,
  ): Promise<WillHookResult> {
    const fullCtx = { operation, ...ctx } as TContext;
    const entries = this.willHandlers.get(operation);
    if (!entries || entries.size === 0) return {};

    // Sort by priority descending
    const sorted = [...entries].sort((a, b) => b.priority - a.priority);

    for (const entry of sorted) {
      try {
        const result = await entry.handler(fullCtx);
        if (result?.cancel) {
          return result;
        }
      } catch (err) {
        console.error(
          `[${this.name}] Error in onWill handler for "${operation}" (source: ${entry.source}):`,
          err,
        );
        // Fail-open: errors do NOT cancel
      }
    }

    return {};
  }

  removeBySource(source: string): void {
    for (const entries of this.didHandlers.values()) {
      for (const entry of entries) {
        if (entry.source === source) {
          entries.delete(entry);
        }
      }
    }
    for (const entries of this.willHandlers.values()) {
      for (const entry of entries) {
        if (entry.source === source) {
          entries.delete(entry);
        }
      }
    }
  }
}

