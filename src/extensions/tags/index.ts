import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";

export async function onActivate(_api: ExtensionAPI): Promise<void> {
  // Tag components are used directly by RepositoryView sidebar
  // No blades or commands to register yet
}

export function onDeactivate(): void {}
