type Platform = "mac" | "windows" | "linux";

let cached: Platform | null = null;

export function getPlatform(): Platform {
  if (cached) return cached;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) cached = "mac";
  else if (ua.includes("win")) cached = "windows";
  else cached = "linux";
  return cached;
}

export const isMac = getPlatform() === "mac";
export const isWindows = getPlatform() === "windows";
export const isLinux = getPlatform() === "linux";

export const modKeyLabel = isMac ? "Cmd" : "Ctrl";
