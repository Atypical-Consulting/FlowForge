/**
 * Colored label pill for GitHub labels.
 *
 * Renders a small pill with dynamic hex colors from the GitHub API.
 * Uses inline styles for colors because Tailwind cannot generate
 * arbitrary dynamic hex colors at build time. Tailwind is used
 * only for structural classes.
 */

interface LabelPillProps {
  /** Label display name */
  name: string;
  /** 6-char hex color WITHOUT the # prefix (GitHub API format) */
  color: string;
}

export function LabelPill({ name, color }: LabelPillProps) {
  const bgColor = `#${color}20`; // 12.5% opacity
  const borderColor = `#${color}40`; // 25% opacity

  // Compute luminance to determine if text color needs adjustment
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // For very light colors (high luminance), the text may be hard to read
  // on a dark background. Keep the original color -- it works well against
  // the semi-transparent background in Catppuccin dark themes.
  const textColor = luminance > 0.7 ? `#${color}` : `#${color}`;

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
      }}
    >
      {name}
    </span>
  );
}
