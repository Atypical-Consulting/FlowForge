import { clearCoreRegistry, getAllBladeTypes } from "../lib/bladeRegistry";

// Single-glob: scan per-blade registration files
const modules = import.meta.glob(
  ["./*/registration.{ts,tsx}", "!./_shared/**"],
  { eager: true }
);

// Guard against misconfigured paths
if (import.meta.env.DEV && Object.keys(modules).length === 0) {
  console.error("[BladeRegistry] No registration modules found -- check src/blades/*/registration.{ts,tsx}");
}

// Dev-mode exhaustiveness check
if (import.meta.env.DEV && !import.meta.hot?.data?.isUpdate) {
  const registered = new Set(getAllBladeTypes());
  const EXPECTED_TYPES: string[] = [
    "staging-changes", "commit-list-fallback", "commit-details", "diff",
    "branch-manager", "repo-browser", "settings",
    "extension-manager", "extension-detail",
  ];
  const missing = EXPECTED_TYPES.filter(t => !registered.has(t as any));
  if (missing.length > 0) {
    console.warn(
      `[BladeRegistry] Missing registrations: ${missing.join(", ")}. ` +
      `Create a registration.ts in src/blades/{blade-name}/ for each.`
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
