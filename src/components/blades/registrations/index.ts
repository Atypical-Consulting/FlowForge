import { clearRegistry, getAllBladeTypes } from "../../../lib/bladeRegistry";

// Auto-import all blade registration modules in this directory.
// Each .ts/.tsx file's top-level registerBlade() call executes on import.
// Adding a new registration file is automatically discovered — no manual imports needed.
const modules = import.meta.glob(["./*.{ts,tsx}", "!./index.ts"], { eager: true });

// Guard against misconfigured paths
if (import.meta.env.DEV && Object.keys(modules).length === 0) {
  console.error("[BladeRegistry] No registration modules found — check registrations directory");
}

// Dev-mode exhaustiveness check: verify all BladePropsMap types have registrations
// Only run on initial load (not during HMR re-evaluation)
if (import.meta.env.DEV && !import.meta.hot?.data?.isUpdate) {
  const registered = new Set(getAllBladeTypes());
  const EXPECTED_TYPES: string[] = [
    "staging-changes", "topology-graph", "commit-details", "diff",
    "viewer-nupkg", "viewer-image", "viewer-markdown", "viewer-3d",
    "viewer-code", "repo-browser", "settings", "changelog", "gitflow-cheatsheet",
    "init-repo",
  ];
  const missing = EXPECTED_TYPES.filter(t => !registered.has(t as any));
  if (missing.length > 0) {
    console.warn(
      `[BladeRegistry] Missing registrations for: ${missing.join(", ")}. ` +
      `Create a registration file in src/components/blades/registrations/ for each.`
    );
  }
}

// HMR: clear registry before this module re-executes so re-registration is clean
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data) => {
    data.isUpdate = true;
    clearRegistry();
  });
}
