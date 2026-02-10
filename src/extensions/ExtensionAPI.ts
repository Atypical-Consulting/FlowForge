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
   * Remove ALL registrations made through this API instance.
   * Called during deactivation or on activation failure (partial cleanup).
   */
  cleanup(): void {
    for (const type of this.registeredBlades) {
      unregisterBlade(type);
    }
    for (const id of this.registeredCommands) {
      unregisterCommand(id);
    }
    useToolbarRegistry
      .getState()
      .unregisterBySource(`ext:${this.extensionId}`);

    this.registeredBlades = [];
    this.registeredCommands = [];
    this.registeredToolbarActions = [];
  }
}
