// --- Types ---

export type GitOperation =
  | "commit"
  | "push"
  | "pull"
  | "fetch"
  | "checkout"
  | "branch-create"
  | "branch-delete"
  | "merge"
  | "stash"
  | "tag-create";

export interface GitHookContext {
  operation: GitOperation;
  branchName?: string;
  commitOid?: string;
  commitMessage?: string;
  remoteName?: string;
  tagName?: string;
  error?: string;
}

export interface WillHookResult {
  cancel?: boolean;
  reason?: string;
}

export type DidHandler = (ctx: GitHookContext) => void | Promise<void>;
export type WillHandler = (
  ctx: GitHookContext,
) => WillHookResult | Promise<WillHookResult | void> | void;

interface HandlerEntry<H> {
  handler: H;
  priority: number;
  source: string;
}

// --- GitHookBus ---

export class GitHookBus {
  private didHandlers = new Map<GitOperation, Set<HandlerEntry<DidHandler>>>();
  private willHandlers = new Map<
    GitOperation,
    Set<HandlerEntry<WillHandler>>
  >();
  private reentryDepth = 0;

  onDid(
    operation: GitOperation,
    handler: DidHandler,
    source: string,
    priority = 0,
  ): () => void {
    if (!this.didHandlers.has(operation)) {
      this.didHandlers.set(operation, new Set());
    }
    const entry: HandlerEntry<DidHandler> = { handler, priority, source };
    this.didHandlers.get(operation)!.add(entry);

    return () => {
      this.didHandlers.get(operation)?.delete(entry);
    };
  }

  onWill(
    operation: GitOperation,
    handler: WillHandler,
    source: string,
    priority = 0,
  ): () => void {
    if (!this.willHandlers.has(operation)) {
      this.willHandlers.set(operation, new Set());
    }
    const entry: HandlerEntry<WillHandler> = { handler, priority, source };
    this.willHandlers.get(operation)!.add(entry);

    return () => {
      this.willHandlers.get(operation)?.delete(entry);
    };
  }

  async emitDid(
    operation: GitOperation,
    ctx?: Omit<GitHookContext, "operation">,
  ): Promise<void> {
    if (this.reentryDepth > 0) return;

    this.reentryDepth++;
    try {
      const fullCtx: GitHookContext = { operation, ...ctx };
      const entries = this.didHandlers.get(operation);
      if (!entries || entries.size === 0) return;

      await Promise.allSettled(
        [...entries].map(async (entry) => {
          try {
            await entry.handler(fullCtx);
          } catch (err) {
            console.error(
              `[GitHookBus] Error in onDid handler for "${operation}" (source: ${entry.source}):`,
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
    operation: GitOperation,
    ctx?: Omit<GitHookContext, "operation">,
  ): Promise<WillHookResult> {
    const fullCtx: GitHookContext = { operation, ...ctx };
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
          `[GitHookBus] Error in onWill handler for "${operation}" (source: ${entry.source}):`,
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

export const gitHookBus = new GitHookBus();
