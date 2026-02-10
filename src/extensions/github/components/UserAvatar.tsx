/**
 * GitHub user avatar with fallback initials.
 *
 * Displays a circular avatar image from a GitHub avatar URL.
 * On image load error, falls back to a colored circle with
 * the first letter of the login name.
 */

import { useState } from "react";

interface UserAvatarProps {
  /** GitHub username */
  login: string;
  /** GitHub avatar URL */
  avatarUrl: string;
  /** Avatar size: sm (20px) or md (28px) */
  size?: "sm" | "md";
}

const sizeClasses = {
  sm: "w-5 h-5",
  md: "w-7 h-7",
} as const;

const fallbackTextSize = {
  sm: "text-[10px]",
  md: "text-xs",
} as const;

export function UserAvatar({ login, avatarUrl, size = "sm" }: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const sizeClass = sizeClasses[size];

  if (hasError) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-ctp-surface1 text-ctp-subtext0 flex items-center justify-center ${fallbackTextSize[size]} font-medium`}
        aria-label={login}
      >
        {login.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={login}
      className={`${sizeClass} rounded-full`}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}
