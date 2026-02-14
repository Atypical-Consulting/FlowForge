import { useState, useEffect } from "react";
import { getGravatarUrl } from "../lib/gravatar";

interface GravatarAvatarProps {
  email: string;
  name: string;
  size?: "sm" | "md";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
} as const;

const SIZE_PX = { sm: 24, md: 32 } as const;

export function GravatarAvatar({ email, name, size = "sm", className = "" }: GravatarAvatarProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGravatarUrl(email, SIZE_PX[size] * 2).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => { cancelled = true; };
  }, [email, size]);

  const sizeClass = SIZE_CLASSES[size];
  const initials = name.charAt(0).toUpperCase();

  if (!url || hasError) {
    return (
      <div
        className={`${sizeClass} shrink-0 rounded-full bg-ctp-surface1 flex items-center justify-center font-medium text-ctp-subtext0 select-none ${className}`}
        title={name}
        aria-label={`Avatar for ${name}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={`${name}'s avatar`}
      title={name}
      className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}
