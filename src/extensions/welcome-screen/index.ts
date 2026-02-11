import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const WelcomeBlade = lazy(() =>
    import("./blades/WelcomeBlade").then((m) => ({
      default: m.WelcomeBlade,
    }))
  );

  api.registerBlade({
    type: "welcome-screen",
    title: "Welcome",
    component: WelcomeBlade,
    singleton: true,
    lazy: true,
    coreOverride: true,
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all unregistrations
}
