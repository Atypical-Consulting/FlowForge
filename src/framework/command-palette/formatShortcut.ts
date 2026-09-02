/**
 * Display labels for modifier tokens, keyed by their lowercase form.
 */
const MODIFIERS: Record<string, { mac: string; other: string }> = {
  mod: { mac: "⌘", other: "Ctrl" },
  ctrl: { mac: "⌃", other: "Ctrl" },
  shift: { mac: "⇧", other: "Shift" },
  alt: { mac: "⌥", other: "Alt" },
};

function isMacPlatform(): boolean {
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

/**
 * Normalise a non-modifier key for display:
 * - single characters are uppercased ("n" -> "N"); punctuation is unaffected
 * - longer names get a leading capital ("enter" -> "Enter", "f5" -> "F5")
 */
function formatKey(key: string): string {
  if (key.length <= 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Format shortcut for display (handles Mac vs Windows).
 *
 * Modifier tokens ("mod", "shift", "alt", "ctrl") are matched
 * case-insensitively and the final key is normalised so that the same
 * shortcut always renders identically regardless of how it was declared
 * ("mod+shift+n" and "mod+shift+N" both give "Ctrl+Shift+N").
 */
export function formatShortcut(shortcut: string): string {
  const isMac = isMacPlatform();
  const parts = shortcut.split("+").map((part) => {
    const modifier = MODIFIERS[part.toLowerCase()];
    if (modifier) return isMac ? modifier.mac : modifier.other;
    return formatKey(part);
  });
  return parts.join(isMac ? "" : "+");
}
