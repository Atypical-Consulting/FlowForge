# Phase 19: Settings, Onboarding & File Icons — UX Research

**Status**: Research
**Focus**: User experience patterns for settings expansion, onboarding flows, and icon system
**Date**: 2026-02-07

---

## Table of Contents

1. [Settings Tab UX](#1-settings-tab-ux)
2. [Form Patterns](#2-form-patterns)
3. [Git Init Banner UX](#3-git-init-banner-ux)
4. [Dropdown with Custom Fallback UX](#4-dropdown-with-custom-fallback-ux)
5. [Accessibility](#5-accessibility)
6. [Extensibility UX](#6-extensibility-ux)
7. [File Icon System](#7-file-icon-system)
8. [Summary & Recommendations](#8-summary--recommendations)

---

## 1. Settings Tab UX

### Current Implementation

**File**: `/src/components/settings/SettingsWindow.tsx`

The settings window uses a **sidebar tab navigation pattern**:

```tsx
// Fixed-width sidebar (180px) with vertical tab list
<div className="w-[180px] border-r border-ctp-surface0 bg-ctp-base p-2">
  {categories.map((cat) => (
    <button
      onClick={() => setCategory(cat.id)}
      className={activeCategory === cat.id
        ? "bg-ctp-blue text-ctp-base font-medium"
        : "text-ctp-subtext1 hover:bg-ctp-surface0 hover:text-ctp-text"
      }
    >
      {cat.icon} {cat.label}
    </button>
  ))}
</div>

// Main content area (flex-1) with overflow scroll
<div className="flex-1 p-6 overflow-y-auto">{renderContent()}</div>
```

**Current Categories**:
- General (Settings icon)
- Git (GitBranch icon)
- Appearance (Palette icon)

**Dialog Container**:
- Size: `max-w-2xl h-[500px]`
- Layout: `flex overflow-hidden`
- Animation: Dialog component uses `motion.div` with fade + scale (0.96 → 1)

### Impact of Adding "Integrations" Tab

**Positive**:
- Sidebar can accommodate 4th tab without scrolling
- Icon-based navigation is clear and scannable
- Wrench icon differentiates from existing tabs

**Considerations**:
- With 4+ tabs, consider eventual vertical scroll for future expansion
- Current fixed height (500px) may need adjustment if forms grow
- Sidebar width (180px) is adequate for single-word labels

**Keyboard Navigation**:
- **Missing**: No keyboard navigation between tabs (no arrow key support)
- **Missing**: No visual focus indicators on tab buttons
- **Present**: Escape key closes dialog (handled by Dialog component)

### UX Recommendations

1. **Add tab keyboard navigation**:
   - Arrow Up/Down to cycle through tabs
   - Home/End to jump to first/last tab
   - Visual focus ring: `focus-visible:ring-2 focus-visible:ring-ctp-blue`

2. **Visual focus state**:
   ```tsx
   className={`... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ctp-base`}
   ```

3. **ARIA roles**: Add proper tablist/tab/tabpanel roles (see Accessibility section)

4. **Tab persistence**: Store last active category in settings store for next open

---

## 2. Form Patterns

### Current Input Components

**File**: `/src/components/ui/input.tsx`

**Available Components**:
- `Input`: Text input with size variants (sm, default, lg)
- `Textarea`: Multi-line text with size variants
- Uses `class-variance-authority` (cva) for variant management

**Common Styles**:
```tsx
className="w-full bg-ctp-surface0 border border-ctp-surface1 rounded
           text-ctp-text placeholder:text-ctp-overlay0
           focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue"
```

**Size Variants**:
- `sm`: `px-2 py-1.5 text-xs`
- `default`: `px-3 py-2 text-sm`
- `lg`: `px-4 py-3 text-base`

### Form Patterns in Use

**1. Text Input** (`GitSettings.tsx`):
```tsx
<label className="block text-sm font-medium text-ctp-subtext1 mb-2">
  Default remote
</label>
<input
  type="text"
  value={settings.git.defaultRemote}
  onChange={(e) => updateSetting("git", "defaultRemote", e.target.value)}
  className="w-full max-w-xs px-3 py-2 bg-ctp-surface0 border..."
  placeholder="origin"
/>
```

**2. Checkbox with Conditional Input** (`GitSettings.tsx`):
```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input type="checkbox" checked={autoFetchEnabled} onChange={...} />
  <span>Enable auto-fetch</span>
</label>
{autoFetchEnabled && (
  <input type="number" min="1" max="60" value={...} />
)}
```

**3. Button Group Toggle** (`GeneralSettings.tsx`, `AppearanceSettings.tsx`):
```tsx
<div className="flex gap-2">
  {options.map((option) => (
    <button
      onClick={() => updateSetting(...)}
      className={value === option.value
        ? "bg-ctp-blue text-ctp-base font-medium"
        : "bg-ctp-surface0 text-ctp-subtext1 hover:bg-ctp-surface1"
      }
    >
      {option.icon} {option.label}
    </button>
  ))}
</div>
```

### Auto-Save UX

**File**: `/src/stores/settings.ts`

**Current Implementation**:
```tsx
updateSetting: async (category, key, value) => {
  const store = await getStore();
  const newSettings = { ...currentSettings, [category]: { ...currentSettings[category], [key]: value }};
  await store.set("settings", newSettings);
  await store.save();
  set({ settings: newSettings });
}
```

**UX Observations**:
- ✅ Auto-saves on every change (no manual save button)
- ✅ Uses async Tauri store API
- ❌ **No loading indicator** during save
- ❌ **No success/error feedback** for user
- ❌ **No debouncing** for rapid changes
- ❌ **No error recovery** (save fails silently in console)

### Form UX Recommendations

1. **Add subtle save feedback**:
   - Inline "Saved" indicator with checkmark icon (fade out after 2s)
   - Position: Next to changed field or in dialog header
   - Example: `<span className="text-xs text-ctp-green">✓ Saved</span>`

2. **Debounce text inputs**:
   - Use `useDebouncedCallback` (300ms) for text fields
   - Immediate save for toggles, selects, buttons

3. **Error handling**:
   - Show toast notification for save errors
   - Retry logic or "Retry" button
   - Visual feedback: Red border + error icon

4. **Loading states**:
   - For Git identity validation: Show spinner in field
   - For path validation: Inline loading state

5. **Input widths**:
   - Text inputs: Use `max-w-xs` (320px) or `max-w-sm` (384px) for paths
   - Number inputs: Use fixed width like `w-20` for small numbers
   - Consistency: All settings use same pattern

---

## 3. Git Init Banner UX

### Context: WelcomeView Layout

**File**: `/src/components/WelcomeView.tsx`

**Current Structure**:
```tsx
<div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-8">
  <AnimatedGradientBg />

  <motion.div variants={staggerContainer} initial="hidden" animate="show" className="relative z-10 max-w-md w-full space-y-8">
    {/* App icon + welcome text */}
    <motion.div variants={staggerItem}>...</motion.div>

    {/* Open/Clone buttons */}
    <motion.div variants={staggerItem}>...</motion.div>

    {/* Error display */}
    {error && <motion.div variants={fadeInUp}>...</motion.div>}

    {/* Recent repos */}
    <motion.div variants={staggerItem}><RecentRepos /></motion.div>
  </motion.div>
</div>
```

**Key Layout Properties**:
- Centered vertically and horizontally
- Stagger animation with 50ms delay between children
- Max width: 448px (`max-w-md`)
- Spacing: 32px (`space-y-8`) between sections

### Banner Placement

**Recommendation**: Insert banner **after error display, before recent repos**

**Rationale**:
- Errors are more urgent and should appear higher
- Git init is contextual to "no repo open" state
- Recent repos are secondary navigation aid

**Visual hierarchy**:
1. Welcome + primary actions (open/clone)
2. Errors (if any)
3. **Git init banner** ← NEW
4. Recent repos

### Banner Design

**Layout**:
```tsx
{shouldShowGitInitBanner && (
  <motion.div
    variants={fadeInUp}
    initial="hidden"
    animate="show"
    className="flex flex-col gap-3 p-4 bg-ctp-surface0/50 backdrop-blur-sm border border-ctp-surface1 rounded-lg"
  >
    {/* Header with icon + text */}
    <div className="flex items-start gap-3">
      <GitBranch className="w-5 h-5 text-ctp-blue shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-sm font-medium text-ctp-text">
          Initialize Git Repository
        </h3>
        <p className="text-xs text-ctp-subtext0 mt-1">
          This folder is not a Git repository. Would you like to initialize it?
        </p>
      </div>
    </div>

    {/* Optional: Default branch checkbox */}
    <label className="flex items-center gap-2 text-xs text-ctp-subtext1 cursor-pointer">
      <input type="checkbox" checked={useMainBranch} onChange={...} />
      Use "main" as default branch name
    </label>

    {/* Actions */}
    <div className="flex gap-2">
      <Button size="sm" onClick={handleInitialize}>
        Initialize Repository
      </Button>
      <Button size="sm" variant="ghost" onClick={handleDismiss}>
        Cancel
      </Button>
    </div>
  </motion.div>
)}
```

**Visual Properties**:
- Background: Semi-transparent surface (`bg-ctp-surface0/50 backdrop-blur-sm`)
- Border: Subtle outline (`border-ctp-surface1`)
- Padding: 16px (`p-4`)
- Gap between elements: 12px (`gap-3`)

### Animation Recommendations

**File**: `/src/lib/animations.ts`

**Existing Variants**:
```tsx
fadeInUp: {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } }
}
```

**Recommended Animation**:
- Use `fadeInUp` for initial appearance
- Matches error display animation pattern
- Duration: 300ms with easeOut curve
- Entry: Fade + 20px vertical slide

**Exit Animation**:
- When dismissed: `fadeOutDown` (reverse of entry)
- When initialized successfully: Fade out then switch to RepositoryView
- Duration: 200ms for dismissal

**Reduced Motion**:
```tsx
const shouldReduceMotion = useReducedMotion();
const duration = shouldReduceMotion ? 0 : 0.3;
```

### State Management

**Banner Visibility Logic**:
```tsx
const shouldShowGitInitBanner =
  !repository &&           // No repo currently open
  attemptedPath &&         // User tried to open a folder
  error === "NOT_A_GIT_REPO" && // Specific error type
  !bannerDismissed;        // User hasn't dismissed it
```

**Persistence**:
- Store dismissed state per path in localStorage
- Key: `git-init-banner-dismissed:${path}`
- Reset on successful initialization

### Error & Success States

**Loading State** (during initialization):
```tsx
<Button size="sm" loading loadingText="Initializing...">
  Initialize Repository
</Button>
```

**Success** (after initialization):
- Auto-dismiss banner
- Show success toast: "Repository initialized"
- Transition to RepositoryView

**Error** (if initialization fails):
- Keep banner visible
- Show inline error below buttons:
  ```tsx
  {initError && (
    <div className="flex items-center gap-2 text-xs text-ctp-red">
      <AlertCircle className="w-4 h-4" />
      <span>{initError}</span>
    </div>
  )}
  ```

---

## 4. Dropdown with Custom Fallback UX

### Use Case: Editor/Terminal Selection

**Requirements**:
- Present common options (VS Code, Cursor, Zed, Terminal, iTerm2, etc.)
- Allow custom path entry for unlisted apps
- Platform-aware (macOS .app bundles vs Linux/Windows executables)
- Validate paths before saving

### Pattern Analysis: Combobox vs Select+Toggle

**Option A: Combobox (Recommended)**

A combobox combines dropdown with free-text input in a single control.

**UX Flow**:
1. User clicks field → dropdown opens with common options
2. User can type to filter options OR enter custom path
3. Arrow keys navigate filtered results
4. Enter selects, Escape cancels
5. Custom paths bypass dropdown list

**Implementation Pattern**:
```tsx
<div className="relative">
  <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
    External editor
  </label>

  <input
    type="text"
    role="combobox"
    aria-expanded={isOpen}
    aria-controls="editor-options"
    aria-autocomplete="list"
    value={editorPath}
    onChange={(e) => setEditorPath(e.target.value)}
    onFocus={() => setIsOpen(true)}
    className="w-full max-w-sm px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded text-sm"
    placeholder="Select or enter path..."
  />

  {isOpen && (
    <ul
      id="editor-options"
      role="listbox"
      className="absolute z-10 w-full mt-1 bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl max-h-60 overflow-y-auto"
    >
      {filteredOptions.map((option) => (
        <li
          role="option"
          aria-selected={editorPath === option.path}
          onClick={() => selectEditor(option)}
          className={`px-3 py-2 cursor-pointer ${
            editorPath === option.path
              ? "bg-ctp-blue text-ctp-base"
              : "hover:bg-ctp-surface0"
          }`}
        >
          <div className="font-medium">{option.name}</div>
          <div className="text-xs text-ctp-overlay0">{option.path}</div>
        </li>
      ))}

      {customPathEntered && (
        <li className="px-3 py-2 text-xs text-ctp-overlay0 italic">
          Using custom path: {editorPath}
        </li>
      )}
    </ul>
  )}
</div>
```

**Pros**:
- Single interaction point (less cognitive load)
- Familiar pattern (browser address bar, VS Code command palette)
- Efficient for power users (type path directly)
- Good for filtering long lists

**Cons**:
- More complex to implement than separate controls
- Requires careful keyboard handling
- Validation happens after entry (not before)

**Option B: Select + Toggle (Simpler Alternative)**

Two separate controls: dropdown for presets, text input for custom.

**UX Flow**:
1. User selects from dropdown (default)
2. If "Custom..." selected → toggle to text input mode
3. Text input shows, user enters path
4. Option to switch back to dropdown

**Implementation Pattern**:
```tsx
<div>
  <label className="block text-sm font-medium text-ctp-subtext1 mb-2">
    External editor
  </label>

  {isCustomMode ? (
    <div className="flex gap-2">
      <input
        type="text"
        value={customPath}
        onChange={(e) => setCustomPath(e.target.value)}
        className="flex-1 max-w-sm px-3 py-2 bg-ctp-surface0 border..."
        placeholder="Enter path to editor..."
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsCustomMode(false)}
      >
        Cancel
      </Button>
    </div>
  ) : (
    <select
      value={selectedEditor}
      onChange={(e) => {
        if (e.target.value === "custom") {
          setIsCustomMode(true);
        } else {
          setSelectedEditor(e.target.value);
        }
      }}
      className="w-full max-w-sm px-3 py-2 bg-ctp-surface0 border..."
    >
      {editorOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      <option value="custom">Custom path...</option>
    </select>
  )}
</div>
```

**Pros**:
- Simpler implementation (native `<select>`)
- Clear separation between preset vs custom
- Easier validation (validate after toggle)
- Less keyboard complexity

**Cons**:
- Two-step process for custom entry
- Mode switching adds friction
- Native `<select>` limited styling (may need custom dropdown)

### Recommendation: **Combobox Pattern**

**Rationale**:
- FlowForge uses **CommandPalette** (combobox pattern) successfully
- Consistent with app's UX vocabulary
- Better for power users (direct path entry)
- Scalable for many options

**Reference Implementation**: `/src/components/command-palette/CommandPalette.tsx`

**Key Features to Adopt**:
1. **Fuzzy search**: Filter options as user types
2. **Keyboard nav**: Arrow keys, Enter, Escape
3. **ARIA**: `role="combobox"`, `aria-expanded`, `aria-controls`
4. **Visual feedback**: Highlight selected option
5. **Screen reader**: Announce result count

### Platform-Aware Defaults

**macOS**:
```tsx
const macEditors = [
  { name: "VS Code", path: "/Applications/Visual Studio Code.app" },
  { name: "Cursor", path: "/Applications/Cursor.app" },
  { name: "Zed", path: "/Applications/Zed.app" },
  { name: "Sublime Text", path: "/Applications/Sublime Text.app" },
  { name: "TextEdit", path: "/System/Applications/TextEdit.app" },
];

const macTerminals = [
  { name: "Terminal", path: "/System/Applications/Utilities/Terminal.app" },
  { name: "iTerm2", path: "/Applications/iTerm.app" },
  { name: "Warp", path: "/Applications/Warp.app" },
];
```

**Linux**:
```tsx
const linuxEditors = [
  { name: "VS Code", path: "/usr/bin/code" },
  { name: "Vim", path: "/usr/bin/vim" },
  { name: "Neovim", path: "/usr/bin/nvim" },
  { name: "Gedit", path: "/usr/bin/gedit" },
];
```

**Windows**:
```tsx
const windowsEditors = [
  { name: "VS Code", path: "C:\\Program Files\\Microsoft VS Code\\Code.exe" },
  { name: "Notepad++", path: "C:\\Program Files\\Notepad++\\notepad++.exe" },
  { name: "Notepad", path: "C:\\Windows\\System32\\notepad.exe" },
];
```

**Auto-Detection**:
- On settings init: Check common paths, only show installed apps
- Use Tauri `fs.exists()` to validate paths
- Sort: Detected apps first, then common options, then custom

### Validation UX

**Path Validation States**:

1. **Empty** (default):
   - No validation
   - Placeholder: "Select or enter path..."

2. **Typing** (debounced 500ms):
   - Show spinner icon in field
   - No validation yet

3. **Valid Path**:
   - Green checkmark icon
   - Save immediately (auto-save)

4. **Invalid Path**:
   - Red X icon
   - Error message: "Path not found. Please check and try again."
   - Red border on input

**Implementation**:
```tsx
const [validationState, setValidationState] = useState<"idle" | "validating" | "valid" | "invalid">("idle");

useEffect(() => {
  if (!editorPath) {
    setValidationState("idle");
    return;
  }

  const timer = setTimeout(async () => {
    setValidationState("validating");
    const exists = await commands.pathExists(editorPath);
    setValidationState(exists ? "valid" : "invalid");
    if (exists) {
      updateSetting("integrations", "externalEditor", editorPath);
    }
  }, 500);

  return () => clearTimeout(timer);
}, [editorPath]);
```

**Visual Feedback**:
```tsx
<div className="relative">
  <input ... />

  <div className="absolute right-3 top-1/2 -translate-y-1/2">
    {validationState === "validating" && <Loader2 className="w-4 h-4 animate-spin text-ctp-overlay0" />}
    {validationState === "valid" && <Check className="w-4 h-4 text-ctp-green" />}
    {validationState === "invalid" && <X className="w-4 h-4 text-ctp-red" />}
  </div>
</div>

{validationState === "invalid" && (
  <p className="text-xs text-ctp-red mt-1">
    Path not found. Please check and try again.
  </p>
)}
```

---

## 5. Accessibility

### Settings Window Accessibility

**Current State**:
- ✅ Escape key closes dialog (Dialog component)
- ✅ Focus trap within dialog (Dialog auto-focuses first focusable element)
- ✅ Click outside to close (backdrop handler)
- ❌ No ARIA roles for tab navigation
- ❌ No keyboard navigation between tabs
- ❌ No focus indicators on tab buttons

**Required ARIA Attributes**:

```tsx
{/* Sidebar wrapper */}
<div role="tablist" aria-label="Settings categories" className="...">
  {categories.map((cat) => (
    <button
      key={cat.id}
      role="tab"
      id={`tab-${cat.id}`}
      aria-selected={activeCategory === cat.id}
      aria-controls={`panel-${cat.id}`}
      tabIndex={activeCategory === cat.id ? 0 : -1}
      onClick={() => setCategory(cat.id)}
      onKeyDown={handleTabKeyDown}
    >
      {cat.icon} {cat.label}
    </button>
  ))}
</div>

{/* Content wrapper */}
<div
  role="tabpanel"
  id={`panel-${activeCategory}`}
  aria-labelledby={`tab-${activeCategory}`}
  tabIndex={0}
  className="flex-1 p-6 overflow-y-auto"
>
  {renderContent()}
</div>
```

**Keyboard Navigation Handler**:
```tsx
const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
  switch (e.key) {
    case "ArrowDown":
    case "ArrowRight":
      e.preventDefault();
      const nextIndex = (index + 1) % categories.length;
      setCategory(categories[nextIndex].id);
      document.getElementById(`tab-${categories[nextIndex].id}`)?.focus();
      break;

    case "ArrowUp":
    case "ArrowLeft":
      e.preventDefault();
      const prevIndex = (index - 1 + categories.length) % categories.length;
      setCategory(categories[prevIndex].id);
      document.getElementById(`tab-${categories[prevIndex].id}`)?.focus();
      break;

    case "Home":
      e.preventDefault();
      setCategory(categories[0].id);
      document.getElementById(`tab-${categories[0].id}`)?.focus();
      break;

    case "End":
      e.preventDefault();
      const lastCat = categories[categories.length - 1];
      setCategory(lastCat.id);
      document.getElementById(`tab-${lastCat.id}`)?.focus();
      break;
  }
};
```

### Auto-Save Accessibility

**Challenge**: Screen readers need to know when settings are saved.

**Solutions**:

1. **Live Region for Status**:
```tsx
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {saveStatus === "saving" && "Saving setting..."}
  {saveStatus === "saved" && "Setting saved successfully"}
  {saveStatus === "error" && "Failed to save setting"}
</div>
```

2. **Visual + Auditory Feedback**:
```tsx
{/* Visual indicator */}
{saveStatus === "saved" && (
  <span className="text-xs text-ctp-green flex items-center gap-1">
    <Check className="w-3 h-3" />
    <span>Saved</span>
  </span>
)}
```

3. **Field-Level Feedback**:
- Add `aria-describedby` to inputs
- Link to status message: `<span id="field-status">{statusText}</span>`

### Form Field Accessibility

**Label Association**:
```tsx
<label htmlFor="default-remote" className="block text-sm font-medium text-ctp-subtext1 mb-2">
  Default remote
</label>
<input
  id="default-remote"
  type="text"
  aria-describedby="default-remote-help"
  ...
/>
<p id="default-remote-help" className="text-xs text-ctp-overlay0 mt-1">
  The name of the remote to use by default (usually "origin")
</p>
```

**Required Fields**:
```tsx
<label htmlFor="git-name" className="...">
  Git name <span aria-label="required" className="text-ctp-red">*</span>
</label>
<input
  id="git-name"
  type="text"
  required
  aria-required="true"
  aria-invalid={!isValid}
  aria-describedby="git-name-error"
  ...
/>
{!isValid && (
  <p id="git-name-error" role="alert" className="text-xs text-ctp-red mt-1">
    Git name is required
  </p>
)}
```

### Combobox Accessibility

**Reference**: `/src/components/command-palette/CommandPalette.tsx`

**ARIA Attributes**:
```tsx
<input
  role="combobox"
  aria-expanded={isOpen}
  aria-controls="editor-options-list"
  aria-activedescendant={selectedOptionId}
  aria-autocomplete="list"
  aria-label="Select external editor"
  ...
/>

<ul
  id="editor-options-list"
  role="listbox"
  aria-label="Available editors"
>
  {options.map((opt, i) => (
    <li
      key={opt.value}
      id={`editor-option-${i}`}
      role="option"
      aria-selected={i === selectedIndex}
    >
      {opt.label}
    </li>
  ))}
</ul>

{/* Screen reader announcements */}
<div aria-live="polite" className="sr-only">
  {options.length} {options.length === 1 ? "option" : "options"} available
</div>
```

### Git Init Banner Accessibility

**Focus Management**:
- When banner appears: Don't auto-focus (non-intrusive)
- When "Initialize" clicked: Move focus to loading spinner
- After success: Move focus to repository view
- After dismiss: Return focus to previous element

**ARIA Structure**:
```tsx
<div role="region" aria-label="Git repository initialization">
  <div role="heading" aria-level={3}>Initialize Git Repository</div>
  <p>This folder is not a Git repository...</p>

  <Button onClick={handleInit} aria-describedby="init-description">
    Initialize Repository
  </Button>
  <span id="init-description" className="sr-only">
    This will create a new Git repository in the current folder
  </span>
</div>
```

**Reduced Motion**:
```tsx
const shouldReduceMotion = useReducedMotion();

<motion.div
  variants={fadeInUp}
  initial="hidden"
  animate="show"
  transition={{
    duration: shouldReduceMotion ? 0 : 0.3,
    ease: "easeOut"
  }}
>
  {/* Banner content */}
</motion.div>
```

---

## 6. Extensibility UX

### Adding New Settings Tabs

**Current Pattern** (`SettingsWindow.tsx`):

1. Define category type:
   ```tsx
   export type SettingsCategory = "general" | "git" | "appearance" | "integrations";
   ```

2. Add to categories array:
   ```tsx
   const categories = [
     { id: "general", label: "General", icon: <Settings /> },
     { id: "git", label: "Git", icon: <GitBranch /> },
     { id: "appearance", label: "Appearance", icon: <Palette /> },
     { id: "integrations", label: "Integrations", icon: <Wrench /> }, // NEW
   ];
   ```

3. Add case to `renderContent()`:
   ```tsx
   case "integrations":
     return <IntegrationsSettings />;
   ```

4. Create settings component:
   ```tsx
   // src/components/settings/IntegrationsSettings.tsx
   export function IntegrationsSettings() {
     return (
       <div className="space-y-6">
         <div>
           <h3 className="text-lg font-medium text-ctp-text mb-4">Integrations</h3>
           <div className="space-y-4">{/* Form fields */}</div>
         </div>
       </div>
     );
   }
   ```

5. Update store types:
   ```tsx
   export interface IntegrationsSettings {
     externalEditor: string;
     terminalApp: string;
   }

   export interface Settings {
     general: GeneralSettings;
     git: GitSettings;
     integrations: IntegrationsSettings; // NEW
   }
   ```

**Extensibility Concerns**:
- ✅ Easy to add new tabs (3 files: store types, categories array, component)
- ✅ Settings store automatically persists new categories
- ⚠️ Sidebar width (180px) may need adjustment for longer labels
- ⚠️ Dialog height (500px) may need to be dynamic for tall forms

### Scaling to Many Settings Fields

**Problem**: As settings grow, single scrolling panel becomes unwieldy.

**Solutions**:

1. **Section Headings**:
   ```tsx
   <div className="space-y-6">
     <section>
       <h3 className="text-lg font-medium text-ctp-text mb-4">General</h3>
       <div className="space-y-4">{/* Fields */}</div>
     </section>

     <section>
       <h3 className="text-lg font-medium text-ctp-text mb-4">Advanced</h3>
       <div className="space-y-4">{/* Fields */}</div>
     </section>
   </div>
   ```

2. **Collapsible Sections** (for advanced settings):
   ```tsx
   <details className="group">
     <summary className="cursor-pointer text-sm font-medium text-ctp-subtext1 hover:text-ctp-text">
       Advanced Options
     </summary>
     <div className="mt-4 space-y-4 pl-4 border-l-2 border-ctp-surface1">
       {/* Advanced fields */}
     </div>
   </details>
   ```

3. **Search/Filter** (if >20 settings):
   - Add search input in dialog header
   - Filter settings fields by label/description
   - Highlight matching text

### Dynamic Form Generation

**For future maintainability**:

```tsx
// Define settings schema
const integrationsSchema: SettingField[] = [
  {
    key: "externalEditor",
    label: "External editor",
    type: "combobox",
    options: editorOptions,
    placeholder: "Select or enter path...",
    validate: validatePath,
  },
  {
    key: "terminalApp",
    label: "Terminal application",
    type: "combobox",
    options: terminalOptions,
    placeholder: "Select or enter path...",
    validate: validatePath,
  },
];

// Render form dynamically
<div className="space-y-4">
  {integrationsSchema.map((field) => (
    <SettingField
      key={field.key}
      field={field}
      value={settings.integrations[field.key]}
      onChange={(value) => updateSetting("integrations", field.key, value)}
    />
  ))}
</div>
```

**Benefits**:
- Single component handles all field types
- Easy to add new fields (just update schema)
- Consistent validation and styling
- Easy to generate settings documentation

---

## 7. File Icon System

### Current Implementation

**Files**:
- `/src/lib/file-icons.ts`: Icon mapping logic
- `/src/components/icons/FileTypeIcon.tsx`: Icon rendering component

**Architecture**:
```tsx
// 1. Import SVG icons as React components (SVGR)
import TypeScriptIcon from "../assets/icons/file-types/typescript.svg?react";

// 2. Map extensions to icons
export const FILE_ICON_MAP: Record<string, IconComponent> = {
  ts: TypeScriptIcon,
  tsx: ReactIcon,
  // ... 40+ mappings
};

// 3. Map specific filenames to icons
export const FILENAME_ICON_MAP: Record<string, IconComponent> = {
  "package.json": NodejsIcon,
  "cargo.toml": RustIcon,
  // ... 20+ mappings
};

// 4. Lookup function
export function getFileIcon(filePath: string): IconComponent {
  const filename = filePath.split("/").pop() || filePath;
  const lowerFilename = filename.toLowerCase();

  // Check exact filename first (case-insensitive)
  for (const [key, icon] of Object.entries(FILENAME_ICON_MAP)) {
    if (key.toLowerCase() === lowerFilename) return icon;
  }

  // Check extension
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : null;
  if (ext && FILE_ICON_MAP[ext]) return FILE_ICON_MAP[ext];

  // Default fallback
  return FileIcon;
}
```

**Usage**:
```tsx
<FileTypeIcon
  path="src/App.tsx"
  isDirectory={false}
  className="w-4 h-4"
/>
```

### Current Coverage

**Languages** (19):
- Web: TypeScript, JavaScript, HTML, CSS, SCSS
- Systems: Rust, Go, C, C++, C#
- Scripting: Python, Ruby, PHP, Lua, Shell (bash/zsh/fish)
- JVM: Java, Kotlin
- Mobile: Swift

**Frameworks** (4):
- React, Vue, Svelte, Astro, Angular

**Data/Config** (10):
- JSON, YAML, TOML, XML, CSV, SQL
- Markdown, plain text

**Special Files** (15+):
- Node: package.json, yarn.lock, pnpm-lock.yaml, bun.lockb
- Rust: Cargo.toml, Cargo.lock
- Docker: Dockerfile, docker-compose.yml/yaml, compose.yml/yaml
- Git: .gitignore, .gitattributes, .gitmodules
- License: LICENSE, LICENSE.md, LICENSE.txt
- Configs: tsconfig.json, jsconfig.json, .eslintrc, .prettierrc, vite.config.*

### Expansion Recommendations

**Phase 19 Additions**:

1. **Backend Languages**:
   ```tsx
   // Add to FILE_ICON_MAP
   elixir: ElixirIcon,      // .ex, .exs
   erlang: ErlangIcon,      // .erl
   haskell: HaskellIcon,    // .hs
   scala: ScalaIcon,        // .scala, .sc
   clojure: ClojureIcon,    // .clj, .cljs
   dart: DartIcon,          // .dart
   ```

2. **Build Tools**:
   ```tsx
   // Add to FILENAME_ICON_MAP
   "makefile": MakefileIcon,
   "cmakelists.txt": CMakeIcon,
   "build.gradle": GradleIcon,
   "pom.xml": MavenIcon,
   "mix.exs": ElixirIcon,
   ```

3. **Frontend Build/Test**:
   ```tsx
   "webpack.config.js": WebpackIcon,
   "rollup.config.js": RollupIcon,
   "jest.config.js": JestIcon,
   "vitest.config.ts": VitestIcon,
   "playwright.config.ts": PlaywrightIcon,
   ```

4. **Databases**:
   ```tsx
   // Add to FILE_ICON_MAP
   prisma: PrismaIcon,      // .prisma
   graphql: GraphQLIcon,    // .graphql, .gql
   ```

5. **Mobile**:
   ```tsx
   "pubspec.yaml": FlutterIcon,
   "androidmanifest.xml": AndroidIcon,
   "info.plist": iOSIcon,
   ```

6. **CI/CD**:
   ```tsx
   ".github/workflows/*": GitHubActionsIcon,
   ".gitlab-ci.yml": GitLabIcon,
   "jenkinsfile": JenkinsIcon,
   ```

### Extensibility Pattern

**Don't rewrite** — extend the existing system:

```tsx
// 1. Add SVG to /src/assets/icons/file-types/
//    Example: flutter.svg

// 2. Import in file-icons.ts
import FlutterIcon from "../assets/icons/file-types/flutter.svg?react";

// 3. Add mappings
export const FILE_ICON_MAP: Record<string, IconComponent> = {
  // ... existing
  dart: FlutterIcon,
};

export const FILENAME_ICON_MAP: Record<string, IconComponent> = {
  // ... existing
  "pubspec.yaml": FlutterIcon,
};
```

**Pattern Matching** (for complex rules):

```tsx
// For GitHub Actions: .github/workflows/*.yml
export function getFileIcon(filePath: string): IconComponent {
  // ... existing logic

  // Check pattern matches
  if (filePath.includes(".github/workflows/") && /\.(yml|yaml)$/.test(filePath)) {
    return GitHubActionsIcon;
  }

  // ... rest of logic
}
```

### Icon Design Consistency

**Current Icons**:
- Size: 16x16px base size (scaled via className)
- Style: Flat, colorful (language/brand colors)
- Format: SVG optimized for React (SVGR)

**Design Guidelines**:
1. **Size**: 16x16px artboard, 1px padding
2. **Colors**: Use official brand colors (maintain recognition)
3. **Complexity**: Simple, recognizable at small sizes
4. **Stroke width**: 1.5-2px (consistent with Lucide icons)
5. **Accessibility**: Icons are decorative (`aria-hidden="true"`)

**Missing Icon Fallback**:
- Currently: Generic `FileIcon` (document outline)
- Recommendation: Log missing extensions in dev mode to identify gaps

### Performance Considerations

**Current**:
- ✅ SVG icons are tree-shakeable (only imported icons are bundled)
- ✅ Icon lookup is O(1) for extensions, O(n) for filenames
- ✅ No runtime color calculations

**Future Optimization** (if >100 icons):
- Lazy load icon groups: `const icons = await import('./icons/language');`
- Icon sprite sheet: Bundle all icons in single SVG sprite
- Cache lookup results: `useMemo` for file icon resolution

---

## 8. Summary & Recommendations

### Priority 1: Settings Tab & Forms

**Immediate Actions**:
1. Add "Integrations" tab with Wrench icon
2. Implement keyboard navigation (Arrow keys, Home, End)
3. Add ARIA tablist/tab/tabpanel roles
4. Implement auto-save feedback (checkmark + live region)
5. Add debouncing for text inputs (300ms)

**Success Criteria**:
- Keyboard-only users can navigate settings
- Screen readers announce tab changes and save status
- Visual feedback for every saved setting (2s fade)

### Priority 2: Git Init Banner

**Immediate Actions**:
1. Add banner component to WelcomeView (after errors, before recent repos)
2. Use `fadeInUp` animation (300ms, respects reduced motion)
3. Implement checkbox for "main" branch default
4. Add loading state for Initialize button
5. Store dismissal state per path in localStorage

**Success Criteria**:
- Banner appears when non-repo folder is opened
- Animation feels natural (consistent with other elements)
- Users can dismiss per folder
- Success/error states are clear

### Priority 3: Editor/Terminal Combobox

**Immediate Actions**:
1. Create `EditorCombobox` component (reusable)
2. Implement platform-aware defaults (macOS/Linux/Windows)
3. Add auto-detection of installed apps (Tauri fs.exists)
4. Implement debounced validation (500ms)
5. Add visual states (idle, validating, valid, invalid)

**Success Criteria**:
- Power users can type path directly
- Casual users can select from common apps
- Only installed apps appear in list
- Invalid paths show clear error before save

### Priority 4: File Icons

**Immediate Actions**:
1. Add 20-30 new icons (backend languages, build tools, CI/CD)
2. Implement pattern matching for complex rules (GitHub Actions)
3. Add dev-mode logging for missing icon requests
4. Document icon design guidelines

**Success Criteria**:
- 80% of common file types have dedicated icons
- Icon lookup handles special cases (workflows, configs)
- Easy for contributors to add new icons

### Accessibility Checklist

**Settings Window**:
- [ ] Tab navigation: Arrow keys, Home, End
- [ ] ARIA: tablist, tab, tabpanel roles
- [ ] Focus indicators on all interactive elements
- [ ] Live region for auto-save announcements

**Forms**:
- [ ] All labels associated with inputs (htmlFor/id)
- [ ] Required fields marked (aria-required)
- [ ] Error messages linked (aria-describedby)
- [ ] Help text linked to inputs

**Combobox**:
- [ ] ARIA: combobox, listbox, option roles
- [ ] Keyboard: Arrow keys, Enter, Escape
- [ ] Screen reader: Result count announcements
- [ ] Focus management: Input → List → Input

**Git Init Banner**:
- [ ] Role: region with label
- [ ] Focus: Don't auto-focus (non-intrusive)
- [ ] Reduced motion: Zero duration for animations
- [ ] Screen reader: Clear action descriptions

### UX Debt to Track

**Later Enhancements**:
1. Settings search/filter (when >20 fields)
2. Collapsible "Advanced" sections
3. Settings export/import (backup/restore)
4. Settings diff/reset to defaults
5. Keyboard shortcut to jump to specific setting
6. Icon sprite sheet optimization (when >100 icons)

### Design Tokens Reference

**Spacing**:
- Form gaps: `space-y-4` (16px)
- Section gaps: `space-y-6` (24px)
- Input padding: `px-3 py-2` (12px x 8px)
- Button gap: `gap-2` (8px)

**Colors**:
- Background: `bg-ctp-surface0`
- Border: `border-ctp-surface1`
- Text: `text-ctp-text`
- Muted: `text-ctp-subtext0`
- Focus ring: `ring-ctp-blue`
- Success: `text-ctp-green`
- Error: `text-ctp-red`

**Typography**:
- Heading: `text-lg font-medium` (18px)
- Label: `text-sm font-medium` (14px)
- Input: `text-sm` (14px)
- Help text: `text-xs text-ctp-overlay0` (12px)

**Animation Durations**:
- Quick: 150ms (hover states)
- Standard: 200-300ms (transitions)
- Slow: 500ms+ (major state changes)
- Reduced motion: 0ms

---

## Conclusion

Phase 19's UX challenges center on **extensibility without degradation**. The settings system needs to grow gracefully, the git init flow must be discoverable but non-intrusive, and the file icon system should handle edge cases elegantly.

**Key UX Principles**:
1. **Consistency**: Use existing patterns (CommandPalette for combobox, Dialog for modals)
2. **Feedback**: Always confirm actions (auto-save indicator, validation states)
3. **Accessibility**: Keyboard nav, ARIA, screen readers, reduced motion
4. **Extensibility**: Schema-driven forms, pattern matching, dynamic sections

By following these patterns, Phase 19 will enhance FlowForge's settings without adding complexity or breaking the clean, focused UX established in earlier phases.
