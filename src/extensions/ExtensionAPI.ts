import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  registerBlade,
  unregisterBlade,
  type BladeRenderContext,
} from "../lib/bladeRegistry";
import {
  registerCommand,
  unregisterCommand,
  type CommandCategory,
} from "../lib/commandRegistry";
import { useToolbarRegistry, type ToolbarGroup } from "../lib/toolbarRegistry";
import {
  useContextMenuRegistry,
  type ContextMenuLocation,
  type ContextMenuContext,
} from "../lib/contextMenuRegistry";
import { useSidebarPanelRegistry } from "../lib/sidebarPanelRegistry";
import {
  useStatusBarRegistry,
  type StatusBarAlignment,
} from "../lib/statusBarRegistry";
import {
  gitHookBus,
  type GitOperation,
  type GitHookContext,
  type DidHandler,
  type WillHandler,
} from "../lib/gitHookBus";

// --- Config types for extension authors ---

export interface ExtensionBladeConfig {
  type: string;
  title: string;
  component: ComponentType<any>;
  singleton?: boolean;
  lazy?: boolean;
  wrapInPanel?: boolean;
  showBack?: boolean;
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
  private disposables: Disposable[] = [];

  constructor(extensionId: string) {
    this.extensionId = extensionId;
  }

  /**
   * Register a blade type with automatic namespacing.
   * The blade type becomes `ext:{extensionId}:{config.type}`.
   */
  registerBlade(config: ExtensionBladeConfig): void {
    const namespacedType = `ext:${this.extensionId}:${config.type}`;
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
   * Register a disposable that will be called during cleanup.
   * Disposables execute in reverse registration order (LIFO).
   * Supports both function and { dispose } object patterns.
   */
  onDispose(disposable: Disposable): void {
    this.disposables.push(disposable);
  }

  /**
   * Remove ALL registrations made through this API instance.
   * Called during deactivation or on activation failure (partial cleanup).
   *
   * Cleanup order: existing registries -> new UI registries -> git hooks -> disposables (reverse).
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

    // 3. Git hooks
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

    // 4. Disposables in reverse order (LIFO)
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

    // 5. Reset all tracking arrays
    this.registeredBlades = [];
    this.registeredCommands = [];
    this.registeredToolbarActions = [];
    this.registeredContextMenuItems = [];
    this.registeredSidebarPanels = [];
    this.registeredStatusBarItems = [];
    this.gitHookUnsubscribes = [];
    this.disposables = [];
  }
}
