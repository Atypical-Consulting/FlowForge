---
phase: quick-011
plan: 011
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ui/dialog.tsx
  - src/components/ui/input.tsx
  - src/index.css
  - src/components/stash/StashDialog.tsx
autonomous: true

must_haves:
  truths:
    - "Dialog component renders with backdrop blur and fade animation"
    - "Dialog closes on Escape key press"
    - "Dialog closes on backdrop click"
    - "Input component has consistent focus states with ring styling"
    - "StashDialog demonstrates the new component patterns"
  artifacts:
    - path: "src/components/ui/dialog.tsx"
      provides: "Reusable Dialog component with animations and accessibility"
      exports: ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogFooter"]
    - path: "src/components/ui/input.tsx"
      provides: "Reusable Input component with consistent styling"
      exports: ["Input", "Textarea"]
  key_links:
    - from: "src/components/ui/dialog.tsx"
      to: "src/lib/utils.ts"
      via: "cn utility for class merging"
      pattern: "import.*cn.*from"
---

<objective>
Create reusable Dialog and Input UI components to standardize the application's modal and form experiences.

Purpose: Eliminate code duplication across 8+ dialog components, add proper animations and accessibility features, and establish consistent form input styling.
Output: Two new UI primitives (Dialog, Input) plus one refactored dialog as proof-of-concept.
</objective>

<execution_context>
@/Users/phmatray/.claude/get-shit-done/workflows/execute-plan.md
@/Users/phmatray/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/ui/button.tsx
@src/lib/utils.ts
@src/components/branches/CreateBranchDialog.tsx
@src/components/stash/StashDialog.tsx
@src/index.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Dialog UI component with animations and accessibility</name>
  <files>src/components/ui/dialog.tsx, src/index.css</files>
  <action>
Create a composable Dialog component system following the existing Button component pattern (using CVA for variants).

**Dialog component requirements:**
- `Dialog` - wrapper that manages open state via props (open, onOpenChange)
- `DialogContent` - the modal container with animations
- `DialogHeader` - header section styling
- `DialogTitle` - title with consistent h3 styling
- `DialogFooter` - footer for action buttons with flex justify-end gap-2

**Styling (matching existing gray-900 dialogs):**
- Overlay: `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm`
- Content: `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md p-6`
- Size variants via CVA: sm (max-w-sm), default (max-w-md), lg (max-w-lg)

**Animations (add to index.css):**
```css
@keyframes dialog-overlay-show {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dialog-content-show {
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
```
Apply via: `animate-[dialog-overlay-show_150ms_ease-out]` and `animate-[dialog-content-show_150ms_ease-out]`

**Accessibility:**
- Close on Escape key (useEffect with keydown listener)
- Close on backdrop click (onClick on overlay, stopPropagation on content)
- role="dialog" aria-modal="true" on content
- Close button in header (X icon) with aria-label="Close"
- Auto-focus first focusable element when opened

**Do NOT:**
- Add external dependencies (no Radix, no Headless UI)
- Implement complex focus trap (simple auto-focus is sufficient for v1)
- Change any existing dialog files yet (Task 3 handles one refactor)

Use React.createContext for open state sharing between Dialog and DialogContent.
  </action>
  <verify>
  - File exists at src/components/ui/dialog.tsx
  - Exports Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
  - CSS animations exist in src/index.css
  - `npm run build` succeeds with no TypeScript errors
  </verify>
  <done>Dialog component is ready for use with animations, backdrop blur, Escape key handling, and click-outside-to-close functionality</done>
</task>

<task type="auto">
  <name>Task 2: Create Input UI component with consistent styling</name>
  <files>src/components/ui/input.tsx</files>
  <action>
Create an Input component following the Button component pattern.

**Input component requirements:**
- Forward ref to native input element
- Accept all standard input props via React.InputHTMLAttributes
- Use CVA for variant support (size variants)

**Styling (matching existing dialog inputs):**
- Base: `w-full bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder:text-gray-500`
- Focus: `focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`
- Size variants: sm (px-2 py-1.5 text-xs), default (px-3 py-2 text-sm), lg (px-4 py-3 text-base)

**Pattern to follow:**
```typescript
const inputVariants = cva(
  "w-full bg-gray-800 border border-gray-700 rounded text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  {
    variants: {
      size: {
        sm: "px-2 py-1.5 text-xs",
        default: "px-3 py-2 text-sm",
        lg: "px-4 py-3 text-base",
      },
    },
    defaultVariants: { size: "default" },
  }
);
```

Also export a Textarea variant using the same styling but with `resize-none` added.

**Do NOT:**
- Add validation styling (error states) - keep it simple for v1
- Create separate file for Textarea - include in same file
  </action>
  <verify>
  - File exists at src/components/ui/input.tsx
  - Exports Input and Textarea components
  - `npm run build` succeeds with no TypeScript errors
  </verify>
  <done>Input and Textarea components are ready for use with consistent focus states and size variants</done>
</task>

<task type="auto">
  <name>Task 3: Refactor StashDialog as proof-of-concept</name>
  <files>src/components/stash/StashDialog.tsx</files>
  <action>
Refactor StashDialog.tsx to use the new Dialog and Input components as a proof-of-concept.

**Current StashDialog structure:**
```tsx
<div className="fixed inset-0 bg-black/50 ...">
  <div className="bg-gray-900 border ...">
    <div className="flex items-center justify-between mb-4">
      <h3>...</h3>
      <button><X /></button>
    </div>
    <form>
      <input className="w-full px-3 py-2 bg-gray-800..." />
      <div className="flex justify-end gap-2">buttons</div>
    </form>
  </div>
</div>
```

**Refactored structure:**
```tsx
<Dialog open={true} onOpenChange={onClose}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Save Stash</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Message (optional)</label>
        <Input value={message} onChange={...} placeholder="..." />
      </div>
      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

Import Button from "../ui/button" and use it for the action buttons.

**Do NOT:**
- Refactor other dialogs (one is sufficient to demonstrate the pattern)
- Change the dialog's functionality or behavior
  </action>
  <verify>
  - StashDialog.tsx uses new Dialog and Input components
  - `npm run dev` shows the stash dialog with animations and backdrop blur
  - Escape key closes the dialog
  - Clicking outside closes the dialog
  - `npm run build` succeeds
  </verify>
  <done>StashDialog successfully refactored, demonstrating the new component patterns for future refactoring work</done>
</task>

</tasks>

<verification>
1. Run `npm run build` - must pass with no errors
2. Run `npm run dev` and test the Stash dialog:
   - Open stash save dialog from sidebar
   - Verify backdrop blur effect
   - Verify fade-in animation
   - Press Escape - dialog should close
   - Click outside dialog - should close
   - Verify input has blue focus ring
3. Check that new files exist:
   - src/components/ui/dialog.tsx
   - src/components/ui/input.tsx
</verification>

<success_criteria>
- Dialog component exists with animations (fade, scale), backdrop blur, Escape key, click-outside
- Input component exists with consistent focus ring styling
- StashDialog refactored as proof-of-concept
- Build passes with no errors
- No new dependencies added to package.json
</success_criteria>

<output>
After completion, create `.planning/quick/011-improve-the-ux-ui-of-this-application/011-SUMMARY.md`
</output>
