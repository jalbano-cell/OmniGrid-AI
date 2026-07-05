"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const SIZE_PX = {
  sm: 28,
  md: 40,
} as const;

/**
 * The shared Omni family mark — inlined (not an <img src="/logo.svg">) so each
 * instance gets its own unique gradient id via useId(); the sidebar and login
 * screen can both render a Logo in the DOM simultaneously, so a hardcoded
 * gradient id would collide.
 */
function Mark({ size }: { size: keyof typeof SIZE_PX }) {
  const gradientId = useId();
  const px = SIZE_PX[size];

  return (
    <svg width={px} height={px} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="50" y1="8" x2="50" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1A1A70" />
          <stop offset="45%" stopColor="#1565C0" />
          <stop offset="100%" stopColor="#2196F3" />
        </linearGradient>
      </defs>
      <path
        d="M 50 8 A 42 42 0 1 0 92 50"
        stroke={`url(#${gradientId})`}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="50" cy="8" r="6.5" fill="#00D4E8" />
      <circle cx="8" cy="50" r="6.5" fill="#00D4E8" />
      <circle cx="50" cy="92" r="6.5" fill="#00D4E8" />
      <circle cx="50" cy="50" r="6" fill="#00D4E8" />
      <rect x="50" y="44" width="34" height="12" rx="6" fill="#00D4E8" />
    </svg>
  );
}

export function Logo({
  size = "sm",
  withWordmark = true,
  className,
  wordmarkClassName,
}: {
  size?: keyof typeof SIZE_PX;
  withWordmark?: boolean;
  className?: string;
  /** Override the wordmark's text color for contexts like the sidebar that use a distinct --sidebar-foreground token. */
  wordmarkClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Mark size={size} />
      {withWordmark && (
        <span
          className={cn(
            "font-heading font-semibold tracking-tight",
            size === "md" ? "text-lg" : "text-sm",
            wordmarkClassName
          )}
        >
          OmniGrid AI
        </span>
      )}
    </div>
  );
}
