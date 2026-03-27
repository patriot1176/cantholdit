export function GottaGoLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Head */}
      <circle cx="13" cy="4" r="3.4" fill="currentColor" />

      {/* Sweat drop — urgency! */}
      <ellipse cx="20" cy="1.5" rx="1.1" ry="1.7" fill="currentColor" opacity="0.55" />

      {/* Body — leaning slightly forward (shoulders wider, hips narrower) */}
      <path
        d="M9.5 7.5 C8.5 10.5 8.5 13.5 9 17 L18 17 C18.5 13.5 18.5 10.5 17.5 7.5 C16 6.8 11 6.8 9.5 7.5Z"
        fill="currentColor"
      />

      {/* Left arm — slightly out for balance */}
      <path
        d="M10 9 L7 14 L9.5 17"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Right arm — slightly out for balance */}
      <path
        d="M17 9 L20 14 L17.5 17"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/*
        Crossed-knee pose:
        Left hip (viewer's left) → thigh sweeps FAR RIGHT to knee → shin goes down-right
        Right hip (viewer's right) → thigh sweeps FAR LEFT to knee → shin goes down-left
        These cross at ~38% down the thigh, making a clear X.
      */}

      {/* Left thigh: starts wide-left, sweeps hard right */}
      <path
        d="M9 17 L21 26"
        stroke="currentColor"
        strokeWidth="3.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right thigh: starts wide-right, sweeps hard left */}
      <path
        d="M18 17 L6 26"
        stroke="currentColor"
        strokeWidth="3.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left shin: from right-side knee, continues down-right to foot */}
      <path
        d="M21 26 L23 33"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right shin: from left-side knee, continues down-left to foot */}
      <path
        d="M6 26 L4 33"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right foot */}
      <path
        d="M23 33 L27 33"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left foot */}
      <path
        d="M4 33 L0.5 33"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
