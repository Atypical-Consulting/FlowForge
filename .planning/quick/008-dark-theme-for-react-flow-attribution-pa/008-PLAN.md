---
phase: quick-008
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/index.css
autonomous: true

must_haves:
  truths:
    - "Attribution panel has dark background matching controls"
    - "Attribution link text is readable on dark background"
    - "Hover state provides visual feedback"
  artifacts:
    - path: "src/index.css"
      provides: "React Flow attribution dark theme styles"
      contains: "react-flow__attribution"
  key_links: []
---

<objective>
Add dark theme styling for React Flow attribution panel to match existing controls theme.

Purpose: Maintain visual consistency across all React Flow UI elements with dark theme.
Output: Updated CSS with attribution panel dark styles.
</objective>

<context>
@src/index.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add attribution panel dark theme styles</name>
  <files>src/index.css</files>
  <action>
Add CSS rules for the React Flow attribution panel after the existing controls styles:

```css
/* React Flow Attribution - Dark Theme */
.react-flow__attribution {
    background: #030712; /* gray-950 */
    border: 1px solid #1f2937; /* gray-800 */
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 10px;
}

.react-flow__attribution a {
    color: #6b7280; /* gray-500 */
    text-decoration: none;
}

.react-flow__attribution a:hover {
    color: #9ca3af; /* gray-400 */
}
```

Use the same color palette as the controls:
- Background: #030712 (gray-950)
- Border: #1f2937 (gray-800)
- Text: #6b7280 (gray-500) - slightly muted for attribution
- Hover: #9ca3af (gray-400)
  </action>
  <verify>Run `npm run dev` and visually confirm attribution panel in bottom-right has dark background with readable gray text</verify>
  <done>Attribution panel styled with dark theme matching React Flow controls</done>
</task>

</tasks>

<verification>
- Attribution panel background is dark (#030712)
- Attribution text is visible but subtle (#6b7280)
- Hover state changes text color (#9ca3af)
- Styling matches existing React Flow controls theme
</verification>

<success_criteria>
React Flow attribution panel has consistent dark theme styling matching the controls, with appropriate contrast for readability.
</success_criteria>

<output>
After completion, create `.planning/quick/008-dark-theme-for-react-flow-attribution-pa/008-SUMMARY.md`
</output>
