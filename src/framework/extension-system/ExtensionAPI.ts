import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { AnyActorRef, AnyStateMachine, Subscription } from "xstate";
import { createActor } from "xstate";
import {
  registerBlade,
  unregisterBlade,
  type BladeRenderContext,
} from "../layout/bladeRegistry";
import {
  registerCommand,
  unregisterCommand,
  type CommandCategory,
} from "../command-palette/commandRegistry";
import {
  useMachineRegistry,
  type MachineRegistryEntry,
} from "./machineRegistry";
import { useToolbarRegistry, type ToolbarGroup } from "./toolbarRegistry";
import {
  useContextMenuRegistry,
  type ContextMenuLocation,
  type ContextMenuContext,
} from "./contextMenuRegistry";
import { useSidebarPanelRegistry } from "../layout/sidebarPanelRegistry";
import {
  useStatusBarRegistry,
  type StatusBarAlignment,
} from "./statusBarRegistry";
import {
  gitHookBus,
  type GitOperation,
  type GitHookContext,
  type DidHandler,
  type WillHandler,
} from "./operationBus";
import { getNavigationActor } from "../layout/navigation/context";
import type { LastAction } from "../layout/navigation/types";
import { ExtensionSettings } from "./settings";
import { extensionEventBus, type EventHandler } from "./eventBus";

// --- Navigation event type for extensions ---

export interface BladeNavigationEvent {
  action: "push" | "pop" | "replace" | "reset";
  blade: { type: string; props: Record<string, unknown> };
  stackDepth: number;
}

// --- Config types for extension authors ---

export interface ExtensionBladeConfig {
  type: string;
  title: string | ((props: any) => string);
  component: ComponentType<any>;
  singleton?: boolean;
  lazy?: boolean;
  wrapInPanel?: boolean;
  showBack?: boolean;
  /**
   * If true, blade type is registered without ext:{extensionId}: prefix.
   * Use for built-in extensions that replace core blade types.
   */
  coreOverride?: boolean;
  renderTitleContent?: (props: any) => ReactNode;
  renderTrailing?: (props: any, ctx: BladeRenderContext) => ReactNode;
}

export interface ExtensionCommandConfig {
  id: string;
  title: string;
  category?: CommandCategory;
  action: () => void | Promise<void>;
  description?: string;
  shortcut?: string;
  icon?: LucideIcon;
  enabled?: () => boolean;
  keywords?: string[];
}

export interface ExtensionToolbarConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  group: ToolbarGroup;
  priority: number;
  shortcut?: string;
  when?: () => boolean;
  execute: () => void | Promise<void>;
  isLoading?: () => boolean;
  /** Optional custom render function for toolbar widget (e.g., badge, toggle). */
  renderCustom?: (action: any, tabIndex: number) => ReactNode;
}

export interface ExtensionContextMenuConfig {
  id: string;
  label: string;
  icon?: LucideIcon;
  location: ContextMenuLocation;
  group?: string;
  priority?: number;
  when?: (context: ContextMenuContext) => boolean;
  execute: (context: ContextMenuContext) => void | Promise<void>;
}

export interface ExtensionSidebarPanelConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  component: ComponentType<any>;
  priority?: number;
  when?: () => boolean;
  defaultOpen?: boolean;
  renderAction?: () => ReactNode;
  /** Optional badge function returning a count/label to display on the panel header. */
  badge?: () => number | string | null;
}

export interface ExtensionStatusBarConfig {
  id: string;
  alignment: StatusBarAlignment;
  priority?: number;
  renderCustom: () => ReactNode;
  when?: () => boolean;
  execute?: () => void | Promise<void>;
  tooltip?: string;
}

export interface ExtensionGitHookConfig {
  operation: GitOperation;
  handler: (context: GitHookContext) => void | Promise<void>;
}

export interface ExtensionMachineConfig {
  /** Unique machine ID (will be namespaced as ext:{extensionId}:{id}) */
  id: string;
  /** The XState machine definition */
  machine: AnyStateMachine;
  /** Machine category for grouping (default: "workflow") */
  category?: string;
  description?: string;
}

export type Disposable =
  | (() => void | Promise<void>)
  | { dispose: () => void | Promise<void> };

/**
 * Per-extension API facade.
 *
 * Each extension receives its own instance at activation time.
 * All registrations are automatically namespaced with `ext:{extensionId}:`
 * and tracked for atomic cleanup on deactivation.
 */
export class ExtensionAPI {
  private extensionId: string;
  private registeredBlades: string[] = [];
  private registeredCommands: string[] = [];
  private registeredToolbarActions: string[] = [];
  private registeredContextMenuItems: string[] = [];
  private registeredSidebarPanels: string[] = [];
  private registeredStatusBarItems: string[] = [];
  private gitHookUnsubscribes: (() => void)[] = [];
  private navigationUnsubscribes: (() => void)[] = [];
  private registeredMachines: Array<{ id: string; actor: AnyActorRef }> = [];
  private machineSubscriptions: Subscription[] = [];
  private disposables: Disposable[] = [];

  /** Namespaced key-value settings storage for this extension. */
  readonly settings: ExtensionSettings;

  constructor(extensionId: string) {
    this.extensionId = extensionId;
    this.settings = new ExtensionSettings(extensionId);
  }

  /**
   * Register a blade type with automatic namespacing.
   * The blade type becomes `ext:{extensionId}:{config.type}`,
   * unless `coreOverride` is true (type used as-is for built-in extensions).
   * @sandboxSafety requires-trust - Accepts React ComponentType which cannot be serialized across Worker boundary.
   */
  registerBlade(config: ExtensionBladeConfig): void {
    const namespacedType = config.coreOverride
      ? config.type
      : `ext:${this.extensionId}:${config.type}`;
    registerBlade({
      ...config,
      type: namespacedType,
      defaultTitle: config.title,
      source: `ext:${this.extensionId}`,
    });
    this.registeredBlades.push(namespacedType);
  }

  /**
   * Register a command with automatic namespacing.
   * The command ID becomes `ext:{extensionId}:{config.id}`.
   * @sandboxSafety requires-trust - Accepts action callback with closure access to host scope.
   */
  registerCommand(config: ExtensionCommandConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    registerCommand({
      ...config,
      id: namespacedId,
      category: config.category ?? this.extensionId,
      source: `ext:${this.extensionId}`,
    });
    this.registeredCommands.push(namespacedId);
  }

  /**
   * Contribute a toolbar action with automatic namespacing.
   * The action ID becomes `ext:{extensionId}:{config.id}`.
   * @sandboxSafety requires-trust - Accepts React render functions and LucideIcon components.
   */
  contributeToolbar(config: ExtensionToolbarConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    useToolbarRegistry.getState().register({
      ...config,
      id: namespacedId,
      source: `ext:${this.extensionId}`,
    });
    this.registeredToolbarActions.push(namespacedId);
  }

  /**
   * Contribute a context menu item with automatic namespacing.
   * The item ID becomes `ext:{extensionId}:{config.id}`.
   * @sandboxSafety requires-trust - Accepts callback functions with closure access.
   */
  contributeContextMenu(config: ExtensionContextMenuConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    useContextMenuRegistry.getState().register({
      ...config,
      id: namespacedId,
      source: `ext:${this.extensionId}`,
    });
    this.registeredContextMenuItems.push(namespacedId);
  }

  /**
   * Contribute a sidebar panel with automatic namespacing.
   * The panel ID becomes `ext:{extensionId}:{config.id}`.
   * Priority is clamped to 1-69 (70-100 reserved for core).
   * @sandboxSafety requires-trust - Accepts React ComponentType for panel rendering.
   */
  contributeSidebarPanel(config: ExtensionSidebarPanelConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    const clampedPriority = Math.max(1, Math.min(69, config.priority ?? 50));
    useSidebarPanelRegistry.getState().register({
      ...config,
      id: namespacedId,
      priority: clampedPriority,
      source: `ext:${this.extensionId}`,
    });
    this.registeredSidebarPanels.push(namespacedId);
  }

  /**
   * Contribute a status bar item with automatic namespacing.
   * The item ID becomes `ext:{extensionId}:{config.id}`.
   * Priority is clamped to 1-89 (90-100 reserved for core).
   * @sandboxSafety requires-trust - Accepts React render function for status bar widget.
   */
  contributeStatusBar(config: ExtensionStatusBarConfig): void {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    const clampedPriority = Math.max(1, Math.min(89, config.priority ?? 50));
    useStatusBarRegistry.getState().register({
      ...config,
      id: namespacedId,
      priority: clampedPriority,
      source: `ext:${this.extensionId}`,
    });
    this.registeredStatusBarItems.push(namespacedId);
  }

  /**
   * Register a handler for post-operation git events.
   * The handler fires after the git operation completes.
   * @sandboxSafety sandbox-safe - Handler receives serializable GitHookContext. No DOM access needed.
   */
  onDidGit(operation: GitOperation, handler: DidHandler): void {
    const unsub = gitHookBus.onDid(
      operation,
      handler,
      `ext:${this.extensionId}`,
    );
    this.gitHookUnsubscribes.push(unsub);
  }

  /**
   * Register a handler for pre-operation git events.
   * The handler fires before the git operation and can cancel it.
   * @sandboxSafety sandbox-safe - Handler receives/returns serializable data. Can validate git operations.
   */
  onWillGit(operation: GitOperation, handler: WillHandler): void {
    const unsub = gitHookBus.onWill(
      operation,
      handler,
      `ext:${this.extensionId}`,
    );
    this.gitHookUnsubscribes.push(unsub);
  }

  /**
   * Register a handler that fires when blade navigation occurs (push, pop, replace, reset).
   * Returns an unsubscribe function. Automatically cleaned up on extension deactivation.
   * @sandboxSafety sandbox-safe - Handler receives serializable BladeNavigationEvent.
   */
  onDidNavigate(handler: (event: BladeNavigationEvent) => void): () => void {
    const actor = getNavigationActor();
    let prevLastAction: LastAction = actor.getSnapshot().context.lastAction;

    const subscription = actor.subscribe((snapshot) => {
      const { lastAction, bladeStack } = snapshot.context;
      // Only fire when lastAction actually changes to a navigation action
      if (lastAction === prevLastAction) return;
      prevLastAction = lastAction;

      if (
        lastAction === "push" ||
        lastAction === "pop" ||
        lastAction === "replace" ||
        lastAction === "reset"
      ) {
        const topBlade = bladeStack[bladeStack.length - 1];
        handler({
          action: lastAction,
          blade: topBlade
            ? { type: topBlade.type, props: topBlade.props as Record<string, unknown> }
            : { type: "", props: {} },
          stackDepth: bladeStack.length,
        });
      }
    });

    const unsub = () => subscription.unsubscribe();
    this.navigationUnsubscribes.push(unsub);
    return unsub;
  }

  /**
   * Register an XState machine with automatic namespacing.
   * The machine ID becomes `ext:{extensionId}:{config.id}`.
   * The actor is automatically started and stopped on deactivation.
   */
  registerMachine(config: ExtensionMachineConfig): AnyActorRef {
    const namespacedId = `ext:${this.extensionId}:${config.id}`;
    const actor = createActor(config.machine);
    actor.start();

    useMachineRegistry.getState().register({
      id: namespacedId,
      actor,
      machine: config.machine,
      source: `ext:${this.extensionId}`,
      category: config.category ?? "workflow",
      description: config.description,
    });

    this.registeredMachines.push({ id: namespacedId, actor });
    return actor;
  }

  /**
   * Get a registered machine's actor reference by its full ID.
   */
  getMachineActor(machineId: string): AnyActorRef | undefined {
    return useMachineRegistry.getState().getActor(machineId);
  }

  /**
   * Subscribe to state transitions on a registered machine.
   * Returns an unsubscribe function. Automatically cleaned up on deactivation.
   */
  onMachineTransition(
    machineId: string,
    handler: (snapshot: unknown) => void,
  ): () => void {
    const actor = useMachineRegistry.getState().getActor(machineId);
    if (!actor) {
      console.warn(
        `[ExtensionAPI] Machine "${machineId}" not found in registry`,
      );
      return () => {};
    }

    const subscription = actor.subscribe((snapshot) => {
      handler(snapshot);
    });

    this.machineSubscriptions.push(subscription);
    return () => subscription.unsubscribe();
  }

  /**
   * Register a disposable that will be called during cleanup.
   * Disposables execute in reverse registration order (LIFO).
   * Supports both function and { dispose } object patterns.
   * @sandboxSafety sandbox-safe - Cleanup callback, no DOM or React access needed.
   */
  onDispose(disposable: Disposable): void {
    this.disposables.push(disposable);
  }

  /**
   * Remove all persisted settings for this extension.
   * Intended for uninstall scenarios where data should not linger.
   */
  async clearSettings(): Promise<void> {
    await this.settings.clear();
  }

  /**
   * Pub/sub event bus for inter-extension communication.
   *
   * - `emit(event, payload?)` — broadcasts as `ext:{extensionId}:{event}`
   * - `on(event, handler)` — subscribes to any fully-qualified event name;
   *   returns an unsubscribe function. Auto-disposed on cleanup.
   * @sandboxSafety sandbox-safe - Handlers receive/send serializable payloads.
   */
  get events() {
    return {
      emit: (event: string, payload?: unknown) => {
        extensionEventBus.emit(`ext:${this.extensionId}:${event}`, payload);
      },
      on: (event: string, handler: EventHandler) => {
        const unsub = extensionEventBus.on(event, handler, this.extensionId);
        this.disposables.push({ dispose: unsub });
        return unsub;
      },
    };
  }

  /**
   * Remove ALL registrations made through this API instance.
   * Called during deactivation or on activation failure (partial cleanup).
   *
   * Cleanup order: existing registries -> new UI registries -> machines -> event bus -> navigation -> git hooks -> disposables (reverse).
   * Each disposable is wrapped in try/catch to ensure one failure doesn't prevent others from running.
   */
  cleanup(): void {
    // 1. Existing registries (blades, commands, toolbar)
    for (const type of this.registeredBlades) {
      unregisterBlade(type);
    }
    for (const id of this.registeredCommands) {
      unregisterCommand(id);
    }
    useToolbarRegistry
      .getState()
      .unregisterBySource(`ext:${this.extensionId}`);

    // 2. New UI registries (context menu, sidebar, status bar)
    useContextMenuRegistry
      .getState()
      .unregisterBySource(`ext:${this.extensionId}`);
    useSidebarPanelRegistry
      .getState()
      .unregisterBySource(`ext:${this.extensionId}`);
    useStatusBarRegistry
      .getState()
      .unregisterBySource(`ext:${this.extensionId}`);

    // 3. Machine registry (stop actors and unregister)
    for (const sub of this.machineSubscriptions) {
      try {
        sub.unsubscribe();
      } catch (err) {
        console.error(
          `[ExtensionAPI] Error unsubscribing machine for "${this.extensionId}":`,
          err,
        );
      }
    }
    for (const { actor } of this.registeredMachines) {
      try {
        actor.stop();
      } catch (err) {
        console.error(
          `[ExtensionAPI] Error stopping machine actor for "${this.extensionId}":`,
          err,
        );
      }
    }
    useMachineRegistry
      .getState()
      .unregisterBySource(`ext:${this.extensionId}`);

    // 4. Extension event bus
    extensionEventBus.removeAllForSource(this.extensionId);

    // 5. Navigation subscriptions
    for (const unsub of this.navigationUnsubscribes) {
      try {
        unsub();
      } catch (err) {
        console.error(
          `[ExtensionAPI] Error unsubscribing navigation for "${this.extensionId}":`,
          err,
        );
      }
    }

    // 6. Git hooks
    gitHookBus.removeBySource(`ext:${this.extensionId}`);
    for (const unsub of this.gitHookUnsubscribes) {
      try {
        unsub();
      } catch (err) {
        console.error(
          `[ExtensionAPI] Error unsubscribing git hook for "${this.extensionId}":`,
          err,
        );
      }
    }

    // 7. Disposables in reverse order (LIFO)
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      try {
        const d = this.disposables[i];
        if (typeof d === "function") {
          d();
        } else {
          d.dispose();
        }
      } catch (err) {
        console.error(
          `[ExtensionAPI] Error in disposable for "${this.extensionId}":`,
          err,
        );
      }
    }

    // 8. Reset all tracking arrays
    this.registeredBlades = [];
    this.registeredCommands = [];
    this.registeredToolbarActions = [];
    this.registeredContextMenuItems = [];
    this.registeredSidebarPanels = [];
    this.registeredStatusBarItems = [];
    this.gitHookUnsubscribes = [];
    this.navigationUnsubscribes = [];
    this.registeredMachines = [];
    this.machineSubscriptions = [];
    this.disposables = [];
  }
}
