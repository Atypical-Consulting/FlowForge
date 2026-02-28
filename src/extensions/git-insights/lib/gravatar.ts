const hashCache = new Map<string, string>();

export async function getGravatarUrl(
  email: string,
  size = 40,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const cached = hashCache.get(normalized);
  if (cached) return `https://gravatar.com/avatar/${cached}?s=${size}&d=retro`;

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  hashCache.set(normalized, hashHex);
  return `https://gravatar.com/avatar/${hashHex}?s=${size}&d=retro`;
}

/** Clear the hash cache (useful for testing). */
export function clearGravatarCache(): void {
  hashCache.clear();
}
