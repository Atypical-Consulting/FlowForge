---
phase: quick
plan: 018
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/icons/32x32.png
  - src-tauri/icons/128x128.png
  - src-tauri/icons/128x128@2x.png
  - src-tauri/icons/icon.png
  - src-tauri/icons/icon.icns
  - src-tauri/icons/icon.ico
  - src-tauri/tauri.conf.json
autonomous: true

must_haves:
  truths:
    - "App displays new icon with transparent background on all platforms"
    - "All required icon sizes are generated from source image"
  artifacts:
    - path: "src-tauri/icons/icon.png"
      provides: "Base icon from new source"
    - path: "src-tauri/icons/icon.icns"
      provides: "macOS icon bundle"
    - path: "src-tauri/icons/icon.ico"
      provides: "Windows icon file"
  key_links:
    - from: "src-tauri/tauri.conf.json"
      to: "src-tauri/icons/*"
      via: "bundle.icon array"
      pattern: '"icon".*\['
---

<objective>
Replace the default FlowForge app icon with the new transparent background image.

Purpose: Update the application's visual identity across all platforms (macOS, Windows, Linux) using the provided source image.
Output: All icon files regenerated from new source, Tauri config updated to reference icons.
</objective>

<context>
Source image: src-tauri/icons/Gemini Generated Image.png
Current icons directory: src-tauri/icons/
Tauri config: src-tauri/tauri.conf.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Generate all icon formats from source image</name>
  <files>
    src-tauri/icons/32x32.png
    src-tauri/icons/128x128.png
    src-tauri/icons/128x128@2x.png
    src-tauri/icons/icon.png
    src-tauri/icons/icon.icns
    src-tauri/icons/icon.ico
  </files>
  <action>
    Use Tauri CLI to generate all required icon formats from the new source image:
    
    1. Run `npx tauri icon "src-tauri/icons/Gemini Generated Image.png"` from the project root
       - This generates all required formats: .ico, .icns, and multiple PNG sizes
       - Output goes to src-tauri/icons/ by default
    
    2. If tauri icon command is not available, use ImageMagick as fallback:
       - `convert "src-tauri/icons/Gemini Generated Image.png" -resize 32x32 src-tauri/icons/32x32.png`
       - `convert "src-tauri/icons/Gemini Generated Image.png" -resize 128x128 src-tauri/icons/128x128.png`
       - `convert "src-tauri/icons/Gemini Generated Image.png" -resize 256x256 src-tauri/icons/128x128@2x.png`
       - `cp "src-tauri/icons/Gemini Generated Image.png" src-tauri/icons/icon.png`
    
    3. After generation, optionally remove or rename the source file to avoid confusion
  </action>
  <verify>
    `ls -la src-tauri/icons/` shows updated timestamps on icon files
    `file src-tauri/icons/icon.png` confirms PNG format
    `file src-tauri/icons/icon.icns` confirms ICNS format (if generated)
  </verify>
  <done>All icon files regenerated from new transparent background source image</done>
</task>

<task type="auto">
  <name>Task 2: Update Tauri config to reference icon files</name>
  <files>src-tauri/tauri.conf.json</files>
  <action>
    Update the bundle.icon array in tauri.conf.json to explicitly reference the icon files:
    
    ```json
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
    ```
    
    Note: Paths are relative to src-tauri directory. The icon.icns is for macOS, icon.ico for Windows, and PNG files for Linux and fallback.
  </action>
  <verify>
    `cat src-tauri/tauri.conf.json | grep -A 10 '"icon"'` shows populated array
    `npm run tauri build -- --help` (or similar) confirms config is valid JSON
  </verify>
  <done>tauri.conf.json updated with explicit icon paths</done>
</task>

</tasks>

<verification>
- Run `npm run tauri dev` and verify the app window shows the new icon in the dock/taskbar
- Build the app with `npm run tauri build` and verify the generated bundle uses the new icon
</verification>

<success_criteria>
- All icon formats generated from the transparent background source image
- tauri.conf.json references the icon files explicitly
- App displays new icon when running in development mode
</success_criteria>

<output>
After completion, create `.planning/quick/018-use-transparent-background-image-for-app/018-SUMMARY.md`
</output>
