# Phase 11: Foundation - Research

**Researched:** 2026-02-05
**Domain:** Toast notifications, Settings window, Layout fixes (React/TypeScript)
**Confidence:** HIGH

## Summary

Phase 11 delivers toast notifications for Git operation feedback, a settings window for user preferences, and layout fixes (left panel icon overlap, Conventional Commits panel positioning). This phase establishes the UI foundation that subsequent phases build upon.

The key finding is that **no new dependencies are required**. All functionality can be built with the existing infrastructure: framer-motion for animations, zustand for state management, @tauri-apps/plugin-store for persistence, react-hotkeys-hook for keyboard shortcuts, and lucide-react for icons. The existing Toast component provides a foundation to enhance.

**Primary recommendation:** Extend the existing component architecture rather than introducing new libraries. Focus on zustand stores for toast queue management and settings persistence.

## Standard Stack

All libraries already installed and actively used in codebase.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| framer-motion | ^11.18.2 | Animation system | Already used for transitions, AnimatePresence handles stacking |
| zustand | ^5.0.3 | State management | Already used throughout app, supports toast queue and settings |
| @tauri-apps/plugin-store | ^2.2.0 | Persistence | Already used, native key-value store for settings |
| react-hotkeys-hook | ^4.6.1 | Keyboard shortcuts | Already used, Ctrl+, for settings |
| lucide-react | ^0.474.0 | Icons | Already used throughout app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-resizable-panels | ^2.1.7 | Layout panels | Already used, handles proportional resize |
| @tauri-apps/api | ^2.3.0 | Window/Menu | Settings window creation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom toast | react-hot-toast | Already have Toast.tsx foundation, prefer consistency |
| Custom settings | electron-store pattern | @tauri-apps/plugin-store already working |

**Installation:** None needed — all dependencies present.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/
│   │   ├── Toast.tsx           # Enhance existing
│   │   └── ToastContainer.tsx  # New: queue management
│   ├── settings/
│   │   ├── SettingsWindow.tsx  # Main modal
│   │   ├── SettingsSidebar.tsx # Category navigation
│   │   └── sections/
│   │       ├── GeneralSettings.tsx
│   │       ├── GitSettings.tsx
│   │       └── AppearanceSettings.tsx
├── stores/
│   ├── toastStore.ts           # Toast queue state
│   └── settingsStore.ts        # User preferences
```

### Pattern 1: Toast Queue with Zustand
**What:** Centralized toast state with automatic dismissal and stacking
**When to use:** All Git operations needing user feedback
**Example:**
```typescript
// Toast store pattern
interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { ...toast, id }] // Keep max 3
    }));
    if (toast.type === 'success') {
      setTimeout(() => get().removeToast(id), 5000);
    }
    return id;
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  }))
}));
```

### Pattern 2: Persisted Settings with Tauri Store
**What:** Settings that persist across sessions using Tauri's store plugin
**When to use:** User preferences that should survive app restart
**Example:**
```typescript
// Settings store with persistence
const store = new Store('settings.json');

interface SettingsStore {
  conventionalCommitsDefault: boolean;
  theme: 'dark' | 'light';
  setConventionalCommitsDefault: (value: boolean) => Promise<void>;
}

const useSettingsStore = create<SettingsStore>((set) => ({
  conventionalCommitsDefault: false,
  theme: 'dark',
  setConventionalCommitsDefault: async (value) => {
    await store.set('conventionalCommitsDefault', value);
    await store.save();
    set({ conventionalCommitsDefault: value });
  }
}));
```

### Anti-Patterns to Avoid
- **Toast prop drilling:** Don't pass toast functions through components; use the store directly
- **Local state for settings:** Don't use useState for settings; they need persistence
- **Hardcoded panel sizes:** Use percentage-based minSize for responsive behavior

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast animations | Custom CSS keyframes | framer-motion AnimatePresence | Handles enter/exit, stacking automatically |
| Settings persistence | localStorage wrapper | @tauri-apps/plugin-store | Native, cross-platform, already set up |
| Keyboard shortcuts | addEventListener | react-hotkeys-hook | Already used, handles edge cases |
| Panel resize | Custom drag handlers | react-resizable-panels | Already in place, handles proportional |

**Key insight:** The existing codebase has all the building blocks. The task is integration and enhancement, not greenfield development.

## Common Pitfalls

### Pitfall 1: Toast Z-Index Battles
**What goes wrong:** Toasts appear behind modals or panels
**Why it happens:** Inconsistent z-index layering across components
**How to avoid:** Use consistent z-index scale: base=0, panels=10, toasts=50, modals=100
**Warning signs:** Toasts disappear when settings modal opens

### Pitfall 2: Settings Not Persisting
**What goes wrong:** Settings reset on app restart
**Why it happens:** Forgot to call store.save() after set()
**How to avoid:** Always await store.save() after store.set()
**Warning signs:** Settings work during session but lost on restart

### Pitfall 3: Panel Collapse Below Minimum
**What goes wrong:** Panels become unusable when window shrinks
**Why it happens:** minSize as pixels, not percentages
**How to avoid:** Use percentage minSize (e.g., 15%) not pixel values
**Warning signs:** Panel content truncated or overlapping at small window sizes

### Pitfall 4: Toast Queue Memory Leak
**What goes wrong:** Old toasts accumulate in memory
**Why it happens:** Auto-dismiss timeout not clearing on manual dismiss
**How to avoid:** Track timeout IDs, clear on manual dismiss
**Warning signs:** Memory grows with extended usage

## Code Examples

### Toast Container with AnimatePresence
```typescript
// Source: framer-motion AnimatePresence pattern
export function ToastContainer() {
  const { toasts } = useToastStore();
  
  return (
    <div className="fixed bottom-4 right-4 flex flex-col-reverse gap-2 z-50">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
```

### Settings Window with Sidebar Navigation
```typescript
// Source: VS Code settings pattern
export function SettingsWindow({ isOpen, onClose }: SettingsWindowProps) {
  const [activeCategory, setActiveCategory] = useState('general');
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[600px] flex">
        <SettingsSidebar 
          active={activeCategory} 
          onSelect={setActiveCategory} 
        />
        <div className="flex-1 overflow-y-auto p-6">
          {activeCategory === 'general' && <GeneralSettings />}
          {activeCategory === 'git' && <GitSettings />}
          {activeCategory === 'appearance' && <AppearanceSettings />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Left Panel Layout Fix
```typescript
// Source: react-resizable-panels API
<PanelGroup direction="horizontal">
  <Panel defaultSize={20} minSize={15}> {/* Percentage, not pixels */}
    <LeftPanel />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={60} minSize={30}>
    <CenterPanel />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={20} minSize={15}>
    <RightPanel />
  </Panel>
</PanelGroup>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage | Tauri Store | Tauri v2 | Native persistence, no serialization quirks |
| useState for global | Zustand stores | Current | Simpler than Context, better DevTools |
| CSS transitions | framer-motion | Current | AnimatePresence handles complex enter/exit |

**Deprecated/outdated:**
- None — existing patterns are current

## Open Questions

1. **Exact minimum panel widths**
   - What we know: Must prevent unusable states
   - What's unclear: Exact percentages that work on all screens
   - Recommendation: 15% left, 30% middle (~200px and ~400px at 1280px)

2. **Settings categories content**
   - What we know: General, Git, Appearance categories
   - What's unclear: Which specific settings in each
   - Recommendation: General (conventional commits default), Git (remote settings), Appearance (theme)

3. **Toast action button styling**
   - What we know: Commit success toast needs "Push now" action
   - What's unclear: Visual style for action buttons
   - Recommendation: text-ctp-blue underlined link style for consistency

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: src/components/ui/Toast.tsx, src/stores/
- react-resizable-panels documentation (Context7)
- framer-motion AnimatePresence documentation (Context7)

### Secondary (MEDIUM confidence)
- @tauri-apps/plugin-store API patterns from existing usage in codebase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and actively used
- Architecture: HIGH - Patterns derived from existing codebase
- Pitfalls: HIGH - Common issues in similar implementations

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days - stable stack)
