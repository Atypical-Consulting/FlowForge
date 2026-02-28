import {
  clearCoreRegistry,
  getAllBladeTypes,
} from "@/framework/layout/bladeRegistry";

// Single-glob: scan per-blade registration files
const modules = import.meta.glob(
  ["./*/registration.{ts,tsx}", "!./_shared/**"],
  { eager: true },
);

// Guard against misconfigured paths
if (import.meta.env.DEV && Object.keys(modules).length === 0) {
  console.error(
    "[BladeRegistry] No registration modules found -- check src/blades/*/registration.{ts,tsx}",
  );
}

// Dev-mode exhaustiveness check
if (import.meta.env.DEV && !import.meta.hot?.data?.isUpdate) {
  const registered = new Set(getAllBladeTypes());

  const CORE_BLADE_TYPES: string[] = [
    "staging-changes",
    "commit-list-fallback",
    "settings",
    "extension-manager",
    "extension-detail",
  ];

  const EXTENSION_BLADE_TYPES: string[] = [
    "repo-browser",
    "branch-manager",
    "diff",
    "commit-details",
    "topology-graph",
    "init-repo",
    "conventional-commit",
    "changelog",
    "gitflow-cheatsheet",
    "viewer-code",
    "viewer-markdown",
    "viewer-3d",
    "viewer-image",
    "viewer-nupkg",
    "viewer-plaintext",
    "welcome-screen",
  ];

  const missingCore = CORE_BLADE_TYPES.filter((t) => !registered.has(t as any));
  if (missingCore.length > 0) {
    console.warn(
      `[BladeRegistry] Missing core registrations: ${missingCore.join(", ")}. ` +
        `Check src/core/blades/{blade-name}/registration.ts for each.`,
    );
  }

  const missingExt = EXTENSION_BLADE_TYPES.filter(
    (t) => !registered.has(t as any),
  );
  if (missingExt.length > 0) {
    console.debug(
      `[BladeRegistry] Extension blade types not registered (extensions may be disabled): ${missingExt.join(", ")}`,
    );
  }
}

// HMR: clear registry before re-execution so re-registration is clean
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data) => {
    data.isUpdate = true;
    clearCoreRegistry();
  });
}
