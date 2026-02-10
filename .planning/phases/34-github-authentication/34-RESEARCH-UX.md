# Phase 34: GitHub Authentication - UX Research

**Researched:** 2026-02-10
**Domain:** OAuth Device Flow UX, scope selection, rate limit display, authentication status, extension-contributed UI patterns
**Confidence:** HIGH

## Summary

This research covers the UX design patterns needed to implement GitHub authentication in FlowForge as an extension-contributed experience. The core challenge is not just building OAuth -- it is proving that the Phase 33 extension system can deliver UI that feels native. Every blade, toolbar action, and command must flow through the `ExtensionAPI` facade with `ext:github:*` namespacing, yet appear indistinguishable from core functionality to the user.

The OAuth Device Flow (RFC 8628) has a well-established UX pattern: display a short user code (GitHub uses 8 characters with a hyphen, e.g., "WDJB-MJHT"), provide a one-click copy button, open the browser to `https://github.com/login/device`, then show a polling spinner until authorization completes or the code expires (15 minutes). The critical UX decisions are: (1) where the sign-in flow lives (a dedicated blade vs. a dialog), (2) how to present GitHub permission scopes without overwhelming users, and (3) where rate limit information appears in the UI hierarchy.

The research draws from the existing FlowForge UI patterns (Catppuccin theme tokens, blade system, toolbar registry, toast system, dialog component), GitHub's official OAuth documentation, RFC 8628, and established desktop app patterns from VS Code and GitKraken. All recommendations are designed to be implementable through the Phase 33 `ExtensionAPI` -- the GitHub extension registers its blades, commands, and toolbar actions via `api.registerBlade()`, `api.registerCommand()`, and `api.contributeToolbar()` with automatic `ext:github:*` namespacing.

**Primary recommendation:** Build the GitHub sign-in as a singleton blade (`ext:github:sign-in`) with a multi-step wizard layout (scope selection -> device code display -> polling -> success), contributed via the extension system. Use the existing toolbar registry for a GitHub account status button in the "app" group, and use the toast system for rate limit warnings.

## Standard Stack

### Core (UX-relevant -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lucide-react | existing | Icons for GitHub, copy, check, shield, user, alert | Already used throughout; provides `Github`, `Copy`, `Check`, `Shield`, `UserCircle`, `AlertTriangle` |
| framer-motion | existing | Animated transitions between auth flow steps, success overlay | Already used in ConventionalCommitBlade success overlay, Toast animations |
| class-variance-authority | existing | Button/badge variants for auth states | Already used for Button component variants |
| @tauri-apps/plugin-shell | existing | Open browser to GitHub verification URL | `open()` function for launching default browser |
| @tauri-apps/plugin-clipboard-manager | ^2 | Copy device code to clipboard | Tauri plugin for native clipboard access |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | ^5 | GitHub auth store (token state, rate limits, account info) | Extension-scoped store for auth state management |
| react-hotkeys-hook | existing | Keyboard shortcut for copy-to-clipboard in device code screen | Already used for global shortcuts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Blade for sign-in flow | Dialog component | Blade gives more room for scope selection + device code display side-by-side; dialogs are too cramped for multi-step flows. Blade also proves the extension blade registration works. |
| Toast for rate limit warnings | Dedicated status bar area | The app currently has no status bar. Adding one just for rate limits is premature. Toasts already handle warnings well. Use a toolbar badge for persistent display. |
| QR code for verification URL | Text-only URL display | QR codes add a dependency and are less useful on desktop (user is already at their computer). The `verification_uri_complete` with "Open in Browser" button is simpler and more direct. |

**Installation:**
```bash
# Check if clipboard plugin is already installed
# If not: npm install @tauri-apps/plugin-clipboard-manager
# No other new UX dependencies needed
```

## Architecture Patterns

### Extension-Contributed UI Structure

```
.flowforge/extensions/github/
  flowforge.extension.json    # Manifest declaring blades, commands, toolbar
  index.js                    # Entry point calling api.registerBlade(), etc.
  components/
    SignInBlade.tsx           # ext:github:sign-in blade
    AccountBlade.tsx          # ext:github:account blade (manage scopes, sign out)
    DeviceCodeStep.tsx        # Device code display sub-component
    ScopeSelectionStep.tsx    # Scope selection sub-component
    AuthPollingStep.tsx       # Polling/waiting sub-component
    RateLimitBadge.tsx        # Toolbar badge for rate limit display
```

Note: For v1.5 (first-party extension), the GitHub extension source code will likely live in `src/extensions/github/` within the main repo and be built as a separate entry point, rather than truly external. The structure above shows the logical separation.

### Pattern 1: Extension Blade Registration for Auth Flow

**What:** The GitHub extension registers a singleton sign-in blade through the ExtensionAPI.
**When to use:** At extension activation time.

```typescript
// GitHub extension entry point
export function onActivate(api: ExtensionAPI): void {
  // Sign-in blade -- singleton, shows in blade stack
  api.registerBlade({
    type: "sign-in",          // Becomes ext:github:sign-in
    title: "GitHub Sign In",
    component: SignInBlade,
    singleton: true,
    lazy: true,
    wrapInPanel: true,
    showBack: true,
  });

  // Account management blade
  api.registerBlade({
    type: "account",           // Becomes ext:github:account
    title: "GitHub Account",
    component: AccountBlade,
    singleton: true,
    lazy: true,
    wrapInPanel: true,
    showBack: true,
  });

  // Toolbar: GitHub account status button
  api.contributeToolbar({
    id: "github-account",      // Becomes ext:github:github-account
    label: "GitHub Account",
    icon: Github,              // From lucide-react
    group: "app",
    priority: 60,              // Below settings (90), command palette (80), theme (70)
    execute: () => {
      const isSignedIn = useGitHubAuthStore.getState().isAuthenticated;
      if (isSignedIn) {
        openBlade("ext:github:account", {});
      } else {
        openBlade("ext:github:sign-in", {});
      }
    },
  });

  // Commands
  api.registerCommand({
    id: "sign-in",             // Becomes ext:github:sign-in
    title: "Sign In to GitHub",
    category: "GitHub",
    icon: Github,
    action: () => openBlade("ext:github:sign-in", {}),
    enabled: () => !useGitHubAuthStore.getState().isAuthenticated,
  });

  api.registerCommand({
    id: "sign-out",            // Becomes ext:github:sign-out
    title: "Sign Out of GitHub",
    category: "GitHub",
    action: () => useGitHubAuthStore.getState().signOut(),
    enabled: () => useGitHubAuthStore.getState().isAuthenticated,
  });
}
```

### Pattern 2: Multi-Step Blade Layout (Sign-In Wizard)

**What:** The sign-in blade uses internal step state (not XState) to walk through scope selection, device code display, polling, and success.
**When to use:** For the GitHub sign-in flow.

```
+------------------------------------------+
| < GitHub Sign In                         |  <- BladePanel header (from wrapInPanel)
+------------------------------------------+
|                                          |
|  Step indicator: [1] [2] [3]             |  <- Visual progress (3 steps)
|                                          |
|  STEP 1: Choose Permissions              |
|  +---------+  +---------+  +---------+  |
|  | Basic   |  | Full    |  | Custom  |  |  <- Preset profiles (radio cards)
|  | Read    |  | Read +  |  | Choose  |  |
|  | Only    |  | Write   |  | Scopes  |  |
|  +---------+  +---------+  +---------+  |
|                                          |
|  [Continue]                              |
|                                          |
+------------------------------------------+
```

```
+------------------------------------------+
| < GitHub Sign In                         |
+------------------------------------------+
|                                          |
|  Step indicator: [1] [2] [3]             |
|                                          |
|  STEP 2: Enter Code on GitHub            |
|                                          |
|  Your device code:                       |
|                                          |
|  +-----------------------------------+  |
|  |         WDJB-MJHT                 |  |  <- Large monospace, high contrast
|  +-----------------------------------+  |
|  [Copy Code]  [Open GitHub]             |  <- Two action buttons
|                                          |
|  Code expires in 14:32                   |  <- Countdown timer
|                                          |
|  Waiting for authorization...            |
|  (spinner)                               |  <- Polling indicator
|                                          |
+------------------------------------------+
```

```
+------------------------------------------+
| < GitHub Sign In                         |
+------------------------------------------+
|                                          |
|  Step indicator: [1] [2] [3]             |
|                                          |
|  STEP 3: Success!                        |
|                                          |
|       (green checkmark animation)        |
|                                          |
|  Signed in as @username                  |
|  avatar   Full Name                      |
|                                          |
|  Scopes: repo, user:email, read:org     |
|                                          |
|  [Done]                                  |
|                                          |
+------------------------------------------+
```

**Key design decisions:**
- Steps 1->2 are user-initiated (click "Continue")
- Step 2->3 is automatic (polling detects authorization)
- "Go back" from step 2 cancels the device code flow and returns to step 1
- Success screen auto-navigates back after 3 seconds (same pattern as ConventionalCommitBlade)

### Pattern 3: Device Code Display Component

**What:** The centerpiece of the OAuth Device Flow UX -- a large, readable, copy-friendly code display.
**When to use:** Step 2 of the sign-in flow.

```typescript
// DeviceCodeStep.tsx
function DeviceCodeStep({ userCode, verificationUri, expiresAt, onCancel }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await writeText(userCode);  // @tauri-apps/plugin-clipboard-manager
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBrowser = async () => {
    await open(verificationUri);  // @tauri-apps/plugin-shell
  };

  const timeRemaining = useCountdown(expiresAt);

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <p className="text-sm text-ctp-subtext1">
        Enter this code on GitHub to authorize FlowForge
      </p>

      {/* Device code display */}
      <div className="relative group">
        <div className="px-8 py-4 bg-ctp-surface0 border-2 border-ctp-surface2 rounded-xl
                        font-mono text-3xl font-bold tracking-[0.3em] text-ctp-text
                        select-all text-center">
          {userCode}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleCopy}>
          {copied ? (
            <><Check className="w-4 h-4 text-ctp-green" /> Copied</>
          ) : (
            <><Copy className="w-4 h-4" /> Copy Code</>
          )}
        </Button>
        <Button onClick={handleOpenBrowser}>
          <ExternalLink className="w-4 h-4" /> Open GitHub
        </Button>
      </div>

      {/* Expiry countdown */}
      <p className="text-xs text-ctp-overlay0">
        Code expires in {timeRemaining}
      </p>

      {/* Polling indicator */}
      <div className="flex items-center gap-2 text-sm text-ctp-subtext0">
        <Loader2 className="w-4 h-4 animate-spin" />
        Waiting for authorization...
      </div>
    </div>
  );
}
```

### Pattern 4: Scope Selection via Preset Profiles

**What:** Present GitHub OAuth scopes as 2-3 preset profiles rather than raw checkbox lists.
**When to use:** Step 1 of the sign-in flow.

```typescript
// ScopeSelectionStep.tsx

interface ScopeProfile {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  scopes: string[];
  recommended?: boolean;
}

const SCOPE_PROFILES: ScopeProfile[] = [
  {
    id: "basic",
    name: "Basic",
    description: "Read-only access to your repositories and profile",
    icon: Eye,
    scopes: ["public_repo", "read:user", "user:email", "read:org"],
  },
  {
    id: "full",
    name: "Full Access",
    description: "Read and write access for PRs, issues, and code review",
    icon: Shield,
    scopes: ["repo", "user:email", "read:org", "read:user"],
    recommended: true,
  },
  {
    id: "custom",
    name: "Custom",
    description: "Choose individual permissions",
    icon: Settings,
    scopes: [],  // User selects manually
  },
];
```

**Rationale for profiles over raw checkboxes:**
1. GitHub has 30+ OAuth scopes with parent/child relationships -- showing all of them is overwhelming
2. Most users want one of two things: "let me read stuff" or "let me do everything"
3. A "Custom" option provides the escape hatch for advanced users
4. This mirrors how mobile apps present permissions (simple description, not raw permission names)

**Custom scope selection (when "Custom" profile is chosen):**

```
+------------------------------------------+
| Custom Permissions                       |
+------------------------------------------+
| Category          | Access Level         |
|-------------------|----------------------|
| Repositories      | [None|Read|Full]     |  <- 3-option radio/segmented
| User Profile      | [None|Read|Full]     |
| Organizations     | [None|Read]          |
| Notifications     | [Off|On]             |
+------------------------------------------+
```

Group scopes into user-friendly categories with simple access-level selectors, not raw scope strings. Map the user-friendly levels to actual GitHub scopes under the hood.

### Pattern 5: Rate Limit Display Strategy

**What:** A three-tier approach to showing API rate limit information.
**When to use:** Whenever the GitHub extension is active and the user is authenticated.

**Tier 1 -- Toolbar Badge (always visible when signed in):**
The GitHub toolbar button shows a small colored dot or badge indicating rate limit health.

```
[GitHub icon] <- Normal: no badge
[GitHub icon with green dot] <- Healthy: >50% remaining
[GitHub icon with yellow dot] <- Warning: 10-50% remaining
[GitHub icon with red dot] <- Critical: <10% remaining
```

Implementation: The toolbar action's `icon` property cannot dynamically change (it is a LucideIcon). Instead, use a custom wrapper approach -- register a special toolbar action ID that the Toolbar renderer can detect (similar to the `tb:theme-toggle` pattern) and render a custom component instead of a standard ToolbarButton.

**Tier 2 -- Toast Warning (proactive alert):**
When rate limit remaining drops below a threshold (e.g., <100 remaining for core API, which has a 5000 limit), show a warning toast with an action button.

```typescript
toast.warning("GitHub API: 87 requests remaining (resets in 12 min)", {
  label: "View Details",
  onClick: () => openBlade("ext:github:account", {}),
});
```

Warning thresholds:
| Resource | Limit | Warning At | Critical At |
|----------|-------|------------|-------------|
| Core API | 5,000 | 500 (10%) | 100 (2%) |
| Search   | 30    | 5 (17%)   | 1 (3%) |
| GraphQL  | 5,000 | 500 (10%) | 100 (2%) |

**Tier 3 -- Account Blade Detail (on-demand):**
The GitHub Account blade (`ext:github:account`) shows full rate limit breakdown with remaining/limit for each category, reset time, and a visual bar.

```
+------------------------------------------+
| API Rate Limits                          |
+------------------------------------------+
| Core     [========----] 4,234 / 5,000    |
|          Resets in 47 min                 |
| Search   [===========-]    28 / 30       |
|          Resets in 12 min                 |
| GraphQL  [============] 5,000 / 5,000    |
|          Resets in 58 min                 |
+------------------------------------------+
```

### Pattern 6: Authentication Status in Toolbar

**What:** A single toolbar button that adapts based on sign-in state.
**When to use:** Contributed by the GitHub extension, visible in the "app" toolbar group.

**Signed out state:**
- Icon: `Github` (lucide) with no badge
- Tooltip: "Sign in to GitHub"
- Click: Opens `ext:github:sign-in` blade

**Signed in state:**
- Icon: `Github` (lucide) with rate limit status dot
- Tooltip: "GitHub: @username (4,234 requests remaining)"
- Click: Opens `ext:github:account` blade

The toolbar button can use a `when()` condition to always be visible (it is relevant whether or not a repo is open, since the user might want to sign in before opening a repo). However, rate limit display and the badge only appear when signed in.

### Pattern 7: Auto-Linking GitHub Remotes

**What:** When a repo is opened and has a github.com remote, automatically associate it with the signed-in GitHub account.
**When to use:** On repo open, if signed in.

**UX communication:**
1. Show an info toast: "Linked to github.com/owner/repo" (auto-dismiss after 5s)
2. In the Account blade, show a "Linked Repositories" section listing all repos linked to this account
3. If no GitHub account is signed in but a GitHub remote is detected, show a subtle banner in the main view: "This repo has a GitHub remote. Sign in to unlock GitHub features."

```
+------------------------------------------+
| Linked Repositories                      |
+------------------------------------------+
| owner/repo-name     [Unlink]             |
| other-owner/other   [Unlink]             |
+------------------------------------------+
```

**UX for unlinked state (signed in, but remote does not match):**
Show a non-blocking info toast: "GitHub remote detected but not linked to your account."

### Anti-Patterns to Avoid

- **Hardcoding GitHub UI in core components:** All GitHub UI must come through the extension system. No GitHub-specific code in `Header.tsx`, `App.tsx`, or core blade components. The toolbar button, blades, and commands are all registered via `ExtensionAPI`.
- **Blocking the main thread during OAuth polling:** The device flow polls every 5+ seconds. Use `setInterval` or a Zustand action with `setTimeout` -- never a synchronous loop.
- **Showing raw scope strings to users:** Never display `repo:status` or `read:org` as-is. Always map to human-readable descriptions ("Read-only access to your repositories").
- **Storing tokens in React state or localStorage:** Tokens go to the OS keychain via Rust (GH-02). The React store only holds `isAuthenticated: boolean` and account metadata (username, avatar URL), never the token itself.
- **Making the device code small or hard to read:** The code must be the most prominent element on the screen. Use `text-3xl font-bold font-mono tracking-[0.3em]` minimum. Users may need to read it across the room on another device.
- **Using raw GitHub avatar URLs without fallback:** Avatar URLs may fail. Always provide a fallback using the user's initials or a generic icon.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard copy | Manual `document.execCommand('copy')` | `@tauri-apps/plugin-clipboard-manager` `writeText()` | Works reliably across all OS; the old API is deprecated |
| Browser opening | `window.open()` | `@tauri-apps/plugin-shell` `open()` | Opens in the user's default browser, not a webview |
| Token storage | localStorage, IndexedDB, or in-memory | Rust `keyring` crate via Tauri command | OS keychain is the only secure option; never store tokens in JS-accessible storage |
| Countdown timer | Manual `Date.now()` arithmetic | A simple `useCountdown(expiresAt)` hook | Centralizes timer logic, avoids stale closures, handles component unmount cleanup |
| Step wizard state | XState machine | `useState<"scopes" \| "device-code" \| "polling" \| "success">` | The flow is linear with only 4 states -- a state machine is over-engineering for this |
| Scope normalization | Manual parent/child logic | A lookup table mapping profiles to scope arrays | GitHub's scope hierarchy is complex; a static map is more maintainable than runtime logic |

**Key insight:** The OAuth Device Flow is inherently simple (request code -> show code -> poll). The UX complexity is in the transitions between states and the feedback during each state. Keep the implementation simple, invest in the visual polish.

## Common Pitfalls

### Pitfall 1: Copy Feedback That Disappears Too Fast

**What goes wrong:** User clicks "Copy Code" but the feedback ("Copied!") disappears before they notice, leaving them unsure if it worked.
**Why it happens:** Using a toast for clipboard feedback creates a notification far from the button. Or the button text change is too brief.
**How to avoid:** Use an in-place button label swap: "Copy Code" -> "Copied!" with a checkmark icon. Hold the "Copied!" state for 2 seconds. This keeps the feedback at the point of interaction.
**Warning signs:** Users clicking "Copy" multiple times in testing.

### Pitfall 2: Device Code Expiration Without Clear Recovery

**What goes wrong:** User waits too long (>15 minutes), the device code expires, and the UI shows an error with no clear path forward.
**Why it happens:** The polling detects `expired_token` but the error handling just shows a toast.
**How to avoid:** When the code expires, automatically transition to a "Code Expired" state with a prominent "Get New Code" button that restarts from step 2 (not step 1 -- preserve their scope selection). Show the countdown timer during the flow so users know time is running out.
**Warning signs:** Users abandoning the sign-in flow after expiration.

### Pitfall 3: Scope Selection Anxiety

**What goes wrong:** Users see a list of permissions and feel anxious about granting access, especially `repo` (which grants write access to all repositories).
**Why it happens:** Permission screens are inherently trust-sensitive. Raw technical names increase anxiety.
**How to avoid:** Lead with the "Basic (Read Only)" profile as a safe default. Use reassuring copy: "FlowForge only reads your data. You can change permissions anytime." Show a lock icon next to scope descriptions. Provide a "Why does FlowForge need this?" expandable section.
**Warning signs:** High abandonment rate on the scope selection step in user testing.

### Pitfall 4: Polling Interval Violations

**What goes wrong:** The app polls GitHub too aggressively, receives `slow_down` errors, and the authorization takes even longer.
**Why it happens:** Not respecting GitHub's `interval` field from the device code response, or not adding 5 seconds when `slow_down` is received.
**How to avoid:** Start with the `interval` value from the device code response (typically 5 seconds). On `slow_down`, add 5 seconds to the interval. Never poll faster than the specified interval. Use a single `setTimeout` chain, not `setInterval`.
**Warning signs:** Console logs showing `slow_down` errors during testing.

### Pitfall 5: Rate Limit Toast Spam

**What goes wrong:** Every API response checks rate limits and shows a toast, resulting in 10+ "rate limit low" toasts stacking up.
**Why it happens:** Each individual API call triggers a rate limit check independently.
**How to avoid:** Debounce rate limit warnings. Show at most one warning toast per 5-minute window. Track the last warning time in the auth store. Use the toast `action` property to link to the Account blade for details.
**Warning signs:** Multiple identical yellow toasts stacking in the toast container.

### Pitfall 6: Extension Toolbar Button Not Updating Reactively

**What goes wrong:** The GitHub toolbar button always shows the signed-out icon even after successful sign-in, because the toolbar registry does not re-render when extension state changes.
**Why it happens:** The `ToolbarButton` component reads `action.icon` which is set at registration time and does not change. The toolbar only re-renders when the `actions` Map reference changes.
**How to avoid:** Use the `when()` pattern to conditionally show different toolbar actions for signed-in vs. signed-out states. Register TWO toolbar actions with the same visual position: one with `when: () => !isAuthenticated` and one with `when: () => isAuthenticated`. Or use the `tb:theme-toggle` pattern of registering a special ID that the Toolbar renderer detects and renders a custom component.
**Warning signs:** Toolbar button not reflecting auth state changes.

### Pitfall 7: Not Proving the Extension System

**What goes wrong:** The GitHub auth implementation works but uses core blade registration patterns instead of the ExtensionAPI, defeating the purpose of Phase 33.
**Why it happens:** It is faster to add entries to `BladePropsMap` and `toolbar-actions.ts` than to wire through the extension system.
**How to avoid:** Enforce the constraint: ZERO GitHub-specific code in core files. All registrations go through `api.registerBlade()`, `api.registerCommand()`, and `api.contributeToolbar()`. The GitHub extension's `onActivate()` is the single entry point. Verify by grepping core files for "github" references.
**Warning signs:** GitHub blade types appearing in `BladePropsMap`, GitHub commands in `commands/index.ts`.

## Code Examples

### Device Code Display (Catppuccin-themed)

```typescript
// Source: FlowForge design system (ctp-* tokens) + RFC 8628 guidelines
function DeviceCodeDisplay({ code }: { code: string }) {
  return (
    <div className="px-8 py-4 bg-ctp-surface0 border-2 border-ctp-blue/30 rounded-xl
                    font-mono text-3xl font-bold tracking-[0.3em] text-ctp-text
                    select-all text-center cursor-pointer hover:border-ctp-blue/60
                    transition-colors"
         onClick={handleCopy}
         title="Click to copy">
      {code}
    </div>
  );
}
```

### Scope Profile Card

```typescript
// Source: FlowForge Button variants + settings pattern
function ScopeProfileCard({ profile, selected, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(profile.id)}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
        "hover:bg-ctp-surface0",
        selected
          ? "border-ctp-blue bg-ctp-blue/5"
          : "border-ctp-surface1 bg-ctp-base"
      )}
    >
      <profile.icon className={cn(
        "w-6 h-6",
        selected ? "text-ctp-blue" : "text-ctp-overlay1"
      )} />
      <span className={cn(
        "text-sm font-medium",
        selected ? "text-ctp-text" : "text-ctp-subtext1"
      )}>
        {profile.name}
      </span>
      <span className="text-xs text-ctp-overlay0 text-center">
        {profile.description}
      </span>
      {profile.recommended && (
        <span className="text-xs text-ctp-green font-medium">Recommended</span>
      )}
    </button>
  );
}
```

### Rate Limit Bar Component

```typescript
// Source: FlowForge Catppuccin design tokens
function RateLimitBar({ remaining, limit, label, resetTime }: Props) {
  const percentage = (remaining / limit) * 100;
  const barColor = percentage > 50
    ? "bg-ctp-green"
    : percentage > 10
    ? "bg-ctp-yellow"
    : "bg-ctp-red";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-ctp-subtext1">{label}</span>
        <span className="text-ctp-overlay0 font-mono">
          {remaining.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-ctp-surface0 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-ctp-overlay0">
        Resets in {formatDuration(resetTime)}
      </p>
    </div>
  );
}
```

### Extension-Contributed Toolbar Button with Dynamic Badge

```typescript
// Source: FlowForge toolbarRegistry pattern (tb:theme-toggle precedent)
// Register a toolbar action that the Toolbar renderer handles specially

api.contributeToolbar({
  id: "github-status",        // Becomes ext:github:github-status
  label: "GitHub",
  icon: Github,
  group: "app",
  priority: 60,
  execute: () => {
    const auth = useGitHubAuthStore.getState();
    openBlade(
      auth.isAuthenticated ? "ext:github:account" : "ext:github:sign-in",
      {}
    );
  },
  // Only show when extension is active (always, since GitHub is global)
  when: () => true,
});

// For the badge/dot indicator, the Toolbar component needs to detect
// ext:github:github-status and render GitHubStatusButton instead of
// a plain ToolbarButton (following the tb:theme-toggle precedent).
```

### Auth Store Pattern (Extension-Scoped)

```typescript
// Source: FlowForge Zustand patterns (repository store, extension host store)
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface GitHubAuthState {
  isAuthenticated: boolean;
  username: string | null;
  avatarUrl: string | null;
  scopes: string[];
  rateLimit: {
    core: { remaining: number; limit: number; reset: number };
    search: { remaining: number; limit: number; reset: number };
    graphql: { remaining: number; limit: number; reset: number };
  } | null;
  lastRateLimitWarning: number;  // Timestamp for debouncing warnings

  // Actions
  setAuthenticated: (user: { username: string; avatarUrl: string; scopes: string[] }) => void;
  signOut: () => Promise<void>;
  updateRateLimit: (limits: RateLimitResponse) => void;
  checkRateLimitWarning: () => void;
}

// This store is created in the extension module, NOT via ExtensionAPI.createStore()
// It is NOT registered for reset (auth state persists across repo switches)
export const useGitHubAuthStore = create<GitHubAuthState>()(
  devtools(
    (set, get) => ({
      isAuthenticated: false,
      username: null,
      avatarUrl: null,
      scopes: [],
      rateLimit: null,
      lastRateLimitWarning: 0,

      setAuthenticated: (user) => {
        set({
          isAuthenticated: true,
          username: user.username,
          avatarUrl: user.avatarUrl,
          scopes: user.scopes,
        }, false, "github-auth/authenticated");
      },

      signOut: async () => {
        // Call Rust command to delete token from keychain
        // await commands.deleteGitHubToken();
        set({
          isAuthenticated: false,
          username: null,
          avatarUrl: null,
          scopes: [],
          rateLimit: null,
        }, false, "github-auth/signed-out");
        toast.info("Signed out of GitHub");
      },

      updateRateLimit: (limits) => {
        set({ rateLimit: limits }, false, "github-auth/rate-limit");
        get().checkRateLimitWarning();
      },

      checkRateLimitWarning: () => {
        const { rateLimit, lastRateLimitWarning } = get();
        if (!rateLimit) return;

        const now = Date.now();
        // Debounce: at most one warning per 5 minutes
        if (now - lastRateLimitWarning < 5 * 60 * 1000) return;

        const { core } = rateLimit;
        if (core.remaining < 100) {
          const resetIn = Math.ceil((core.reset * 1000 - now) / 60000);
          toast.warning(
            `GitHub API: ${core.remaining} requests remaining (resets in ${resetIn} min)`,
            {
              label: "View Details",
              onClick: () => openBlade("ext:github:account", {}),
            }
          );
          set({ lastRateLimitWarning: now }, false, "github-auth/rate-limit-warned");
        }
      },
    }),
    { name: "github-auth", enabled: import.meta.env.DEV },
  ),
);
```

### Account Blade Layout

```typescript
// Source: FlowForge SettingsBlade layout pattern
function AccountBlade() {
  const { isAuthenticated, username, avatarUrl, scopes, rateLimit } =
    useGitHubAuthStore();

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={<Github className="w-12 h-12" />}
        title="Not signed in"
        description="Sign in to GitHub to access pull requests, issues, and more."
        action={{
          label: "Sign In",
          onClick: () => openBlade("ext:github:sign-in", {}),
        }}
      />
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Account info header */}
      <div className="flex items-center gap-4">
        <img
          src={avatarUrl ?? ""}
          alt=""
          className="w-12 h-12 rounded-full border border-ctp-surface1"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div>
          <p className="text-lg font-medium text-ctp-text">@{username}</p>
          <p className="text-sm text-ctp-subtext0">
            {scopes.length} permission{scopes.length !== 1 ? "s" : ""} granted
          </p>
        </div>
      </div>

      {/* Scopes section */}
      <div>
        <h3 className="text-sm font-medium text-ctp-subtext1 mb-2">Permissions</h3>
        <div className="flex flex-wrap gap-2">
          {scopes.map((scope) => (
            <span key={scope}
              className="px-2 py-1 text-xs bg-ctp-surface0 text-ctp-subtext1
                         rounded-md border border-ctp-surface1">
              {scope}
            </span>
          ))}
        </div>
      </div>

      {/* Rate limits section */}
      {rateLimit && (
        <div>
          <h3 className="text-sm font-medium text-ctp-subtext1 mb-3">API Rate Limits</h3>
          <div className="space-y-3">
            <RateLimitBar
              label="Core API"
              remaining={rateLimit.core.remaining}
              limit={rateLimit.core.limit}
              resetTime={rateLimit.core.reset}
            />
            <RateLimitBar
              label="Search"
              remaining={rateLimit.search.remaining}
              limit={rateLimit.search.limit}
              resetTime={rateLimit.search.reset}
            />
            <RateLimitBar
              label="GraphQL"
              remaining={rateLimit.graphql.remaining}
              limit={rateLimit.graphql.limit}
              resetTime={rateLimit.graphql.reset}
            />
          </div>
        </div>
      )}

      {/* Sign out */}
      <div className="border-t border-ctp-surface1 pt-4">
        <Button variant="outline" onClick={() => useGitHubAuthStore.getState().signOut()}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OAuth redirect flow in desktop | Device Flow (RFC 8628) | 2020-2022 adoption wave | No embedded browser needed; safer, simpler UX |
| Raw permission checkboxes | Tiered profiles (basic/full/custom) | 2023-2024 mobile consent patterns | Reduces scope anxiety, increases sign-in completion |
| Modal dialog for sign-in | Full blade with multi-step wizard | FlowForge architectural decision | Consistent with blade-based navigation; more room for scope education |
| Status bar for rate limits | Toolbar badge + on-demand blade detail | FlowForge has no status bar | Avoids adding a new UI region; uses existing toolbar system |
| Hardcoded auth UI in app shell | Extension-contributed via ExtensionAPI | Phase 33 (2026-02) | Proves extension system; keeps core clean |

**Deprecated/outdated:**
- OAuth web redirect flow for desktop apps: Device Flow is the recommended approach for apps that cannot host a redirect URI server
- `document.execCommand('copy')`: Deprecated; use `navigator.clipboard.writeText()` or Tauri clipboard plugin
- Displaying raw GitHub scope strings to end users: Modern consent patterns use human-readable descriptions grouped by category

## Open Questions

1. **Custom Toolbar Button Rendering for Rate Limit Badge**
   - What we know: The `tb:theme-toggle` pattern lets the Toolbar renderer detect a special ID and render a custom component. The GitHub extension needs the same pattern for its status button.
   - What's unclear: Should this be a generic "custom widget" capability in the Toolbar component, or should the GitHub extension detect its own toolbar action ID? The Toolbar currently hardcodes `if (action.id === "tb:theme-toggle")`.
   - Recommendation: Add a `renderCustom` property to `ToolbarAction` that, if provided, the Toolbar renders instead of `ToolbarButton`. This makes the pattern generic for all extensions. Alternatively, keep it simple for v1.5: add another hardcoded check for `ext:github:github-status` -- refactor to generic later.

2. **Clipboard Plugin Availability**
   - What we know: The app uses `@tauri-apps/plugin-shell` for opening URLs. Clipboard access needs `@tauri-apps/plugin-clipboard-manager`.
   - What's unclear: Whether this plugin is already configured in the Tauri project.
   - Recommendation: Verify during implementation. If not present, install and configure it. It is a minimal addition.

3. **Auto-Link UX for Multiple GitHub Accounts**
   - What we know: Phase 34 requires auto-linking repos with GitHub remotes to the signed-in account (GH-04).
   - What's unclear: What happens when a user has multiple GitHub accounts? Or when a repo's remote URL does not match the signed-in account's organizations?
   - Recommendation: For v1.5, support only one GitHub account at a time. If the remote's owner does not match the signed-in user or their orgs, still link it (the API access works as long as the user has access to the repo). Show a subtle indicator in the Account blade. Multi-account support is a v2.0 concern.

4. **Where Does the Extension Source Code Live?**
   - What we know: The extension system loads from `.flowforge/extensions/`. But the GitHub extension is first-party code.
   - What's unclear: Does the GitHub extension live in `src/extensions/github/` (built as part of the app) or truly in `.flowforge/extensions/github/` (loaded at runtime)?
   - Recommendation: For v1.5, the GitHub extension source code lives in `src/extensions/github/` in the main repo. It is built as a separate Vite entry point that outputs to a predictable location. The extension discovery mechanism treats it like any other extension. This gives the best DX while proving the extension loading path.

## Sources

### Primary (HIGH confidence)
- FlowForge codebase: `src/extensions/ExtensionAPI.ts`, `src/extensions/ExtensionHost.ts`, `src/lib/toolbarRegistry.ts`, `src/lib/bladeRegistry.ts`, `src/stores/bladeTypes.ts`, `src/stores/toast.ts` -- verified extension registration patterns, toolbar action structure, blade types, toast system
- FlowForge codebase: `src/blades/conventional-commit/ConventionalCommitBlade.tsx` -- reference for multi-step blade with success overlay pattern
- FlowForge codebase: `src/blades/settings/SettingsBlade.tsx` -- reference for tabbed blade layout
- FlowForge codebase: `src/components/toolbar/Toolbar.tsx` -- reference for `tb:theme-toggle` custom rendering pattern
- FlowForge codebase: `src/components/ui/dialog.tsx`, `src/components/ui/button.tsx`, `src/components/ui/Toast.tsx` -- design system component patterns
- [GitHub OAuth Device Flow documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow) -- User code format (8 chars with hyphen), verification URI, polling interval, error codes, 15-minute expiry
- [GitHub OAuth Scopes reference](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) -- Complete scope list with parent/child relationships, normalization rules
- [GitHub Rate Limit API](https://docs.github.com/en/rest/rate-limit/rate-limit) -- Response format, resource categories, 5000 limit for authenticated users
- [RFC 8628: OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628) -- UX recommendations for device code display, character set avoidance, verification_uri_complete

### Secondary (MEDIUM confidence)
- [Auth0 Device Authorization Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/device-authorization-flow) -- Device Flow best practices, display guidelines
- [Curity OAuth Device Flow](https://curity.io/resources/learn/oauth-device-flow/) -- UX patterns for device code display
- [GitHub Rate Limit Monitor VS Code Extension](https://marketplace.visualstudio.com/items?itemName=justin-grote.github-ratelimit) -- Status bar rate limit display pattern
- [VS Code GitHub Authentication](https://code.visualstudio.com/docs/sourcecontrol/github) -- Account menu pattern, status bar sign-in, Accounts activity bar
- [GitKraken GitHub Integration](https://help.gitkraken.com/gitkraken-desktop/github-gitkraken-desktop/) -- Desktop app GitHub auth via integrations settings
- [WorkOS Device Authorization Grant](https://workos.com/blog/oauth-device-authorization-grant) -- UX flow diagrams and design rationale
- Phase 33 Research (`33-RESEARCH.md`) -- Extension system architecture patterns, ExtensionAPI facade, namespace conventions

### Tertiary (LOW confidence)
- [Octokit auth-oauth-device.js](https://github.com/octokit/auth-oauth-device.js) -- JavaScript implementation reference for onVerification callback pattern
- [PatternFly Clipboard Copy](https://www.patternfly.org/components/clipboard-copy/) -- Design system clipboard copy component reference
- [Carbon Design System Notifications](https://carbondesignsystem.com/patterns/notification-pattern/) -- Toast notification best practices for desktop apps

## Metadata

**Confidence breakdown:**
- OAuth Device Flow UX: HIGH -- RFC 8628 is well-documented, GitHub's implementation is stable, the UX patterns are well-established across CLI tools and desktop apps
- Scope Selection UX: HIGH -- GitHub's scope list is stable and well-documented; the profiles pattern is a standard simplification used in mobile OAuth consent screens
- Rate Limit Display: HIGH -- GitHub's rate limit API is stable; the three-tier strategy (badge, toast, blade) maps cleanly to FlowForge's existing UI patterns
- Authentication Status: HIGH -- The toolbar registry pattern is verified from codebase analysis; the `tb:theme-toggle` precedent proves custom toolbar widgets work
- Auto-Linking Remotes: MEDIUM -- The basic pattern is clear, but edge cases around multiple accounts and non-matching remotes need implementation-time decisions
- Extension-Contributed UI: HIGH -- The ExtensionAPI facade is verified from `src/extensions/ExtensionAPI.ts`; the blade/command/toolbar registration patterns are proven

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain -- OAuth Device Flow and GitHub API are mature, extension system is freshly built)
