import React from "react";
import type { RecoveryActivityType } from "@lib/recoveryPlan";

/** Simple 24px stroke icons (Lucide-style geometry) drawn inline to avoid an icon dependency. */
const ICON_PATHS: Record<RecoveryActivityType, React.ReactNode> = {
  sleep: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  meal: (
    <>
      <path d="M3 2v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2M6 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7" />
    </>
  ),
  hydration: <path d="M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0Z" />,
  exercise: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="m7 22 3-6 3 2v4M7 12l3-3 4 1 3 3M10 9l-1 7" />
    </>
  ),
  caffeine: (
    <>
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <path d="M6 2v2M10 2v2M14 2v2" />
    </>
  ),
};

export function ActivityIcon({
  type,
  className = "h-4 w-4",
}: {
  type: RecoveryActivityType;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[type]}
    </svg>
  );
}
