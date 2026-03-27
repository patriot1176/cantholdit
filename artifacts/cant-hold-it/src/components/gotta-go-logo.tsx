export function GottaGoLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Head */}
      <circle cx="12" cy="4" r="3.5" fill="currentColor" />

      {/* Torso — slightly leaning forward */}
      <path
        d="M8.5 7.5 C7.5 11 8 14 8.5 15.5 L15.5 15.5 C16 14 16.5 11 15.5 7.5 C14 7 10 7 8.5 7.5Z"
        fill="currentColor"
      />

      {/* Left arm reaching down */}
      <path
        d="M9 8.5 C7 10.5 6 12.5 6.5 14.5 C7 15.5 8 15.5 8.5 15.5"
        stroke="currentColor"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Right arm reaching down */}
      <path
        d="M15 8.5 C17 10.5 18 12.5 17.5 14.5 C17 15.5 16 15.5 15.5 15.5"
        stroke="currentColor"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Left thigh — goes diagonally RIGHT (crossing) */}
      <path
        d="M10 15.5 L14.5 23"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right thigh — goes diagonally LEFT (crossing) */}
      <path
        d="M14 15.5 L9.5 23"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left shin — continues from crossing point to right foot */}
      <path
        d="M14.5 23 L17 30"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right shin — continues from crossing point to left foot */}
      <path
        d="M9.5 23 L7 30"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right foot */}
      <path
        d="M17 30 L20 30"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left foot */}
      <path
        d="M7 30 L4 30"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
