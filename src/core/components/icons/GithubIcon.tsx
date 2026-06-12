import type { LucideProps } from "lucide-react";
import { forwardRef } from "react";

/**
 * GitHub mark icon.
 *
 * `lucide-react` removed its brand icons (including `Github`) in v1, so this is a
 * drop-in replacement typed as a `LucideIcon` (forwardRef + `LucideProps`). It can
 * be used directly as `<GithubIcon className=... />` or passed wherever a lucide
 * icon component is expected (e.g. command/toolbar `icon` fields). Color follows
 * `currentColor` like lucide icons.
 */
export const GithubIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, color = "currentColor", ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.42-1.305.762-1.605-2.665-.305-5.467-1.332-5.467-5.93 0-1.31.468-2.38 1.236-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.5 11.5 0 0 1 12 5.8c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.652.242 2.873.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.62-5.48 5.92.43.372.823 1.102.823 2.222 0 1.605-.015 2.898-.015 3.293 0 .32.216.695.825.576C20.565 22.296 24 17.797 24 12.5 24 5.87 18.627.5 12 .5z" />
    </svg>
  ),
);

GithubIcon.displayName = "GithubIcon";
