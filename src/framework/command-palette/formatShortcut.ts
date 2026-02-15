/**
 * Format shortcut for display (handles Mac vs Windows)
 */
export function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return shortcut
    .replace("mod", isMac ? "\u2318" : "Ctrl")
    .replace("shift", isMac ? "\u21E7" : "Shift")
    .replace("alt", isMac ? "\u2325" : "Alt")
    .replace(/\+/g, isMac ? "" : "+");
}
