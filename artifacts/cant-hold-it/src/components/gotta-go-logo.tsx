export function GottaGoLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* ── HEAD (big, cartoon proportions) ── */}
      <circle cx="18" cy="7.5" r="6.8" fill="currentColor" />

      {/* Wide worried eyes */}
      <ellipse cx="14.8" cy="7" rx="1.7" ry="2.1" fill="white" />
      <ellipse cx="21.2" cy="7" rx="1.7" ry="2.1" fill="white" />
      <circle cx="15.1" cy="7.4" r="1.0" fill="currentColor" />
      <circle cx="21.5" cy="7.4" r="1.0" fill="currentColor" />

      {/* Stressed angled eyebrows */}
      <path d="M13 4.5 Q14.8 5.3 16 4.7" stroke="white" strokeWidth="0.9" strokeLinecap="round" fill="none" />
      <path d="M23 4.5 Q21.2 5.3 20 4.7" stroke="white" strokeWidth="0.9" strokeLinecap="round" fill="none" />

      {/* Tight grimace mouth */}
      <path d="M15.5 11 Q18 9.8 20.5 11" stroke="white" strokeWidth="0.9" strokeLinecap="round" fill="none" />

      {/* ── SWEAT DROP ── */}
      <path d="M27.5 2.5 Q29.5 1.5 28.5 5.5 Q26.5 6 26.5 3.8 Q27 2.8 27.5 2.5Z"
        fill="currentColor" opacity="0.55" />

      {/* ── BODY (compact, slightly wider at shoulders) ── */}
      <path
        d="M13.5 14.5 C12.5 18.5 12.5 22 13 26.5 L23 26.5 C23.5 22 23.5 18.5 22.5 14.5 Q20.5 13 18 13 Q15.5 13 13.5 14.5Z"
        fill="currentColor"
      />

      {/* ── ARMS (out slightly for balance) ── */}
      <path d="M14 16.5 L9.5 22.5 L13 26.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M22 16.5 L26.5 22.5 L23 26.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/*
        ── LEGS — knees pressed hard inward (urgency pose) ──
        Hips are 9 units wide; thighs converge to knees just 1 unit apart.
        Shins then splay slightly back out. This creates the diamond silhouette
        that reads instantly as "knees squeezed together."
      */}

      {/* Left thigh: hip at x=14, sweeps hard RIGHT to knee at x=18 */}
      <path d="M14 26.5 L18 37" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />

      {/* Right thigh: hip at x=22, sweeps hard LEFT to knee at x=20 */}
      <path d="M22 26.5 L20 37" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />

      {/* Left shin: from knee at x=18, goes slightly left to foot */}
      <path d="M18 37 L15.5 46" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" fill="none" />

      {/* Right shin: from knee at x=20, goes slightly right to foot */}
      <path d="M20 37 L22.5 46" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" fill="none" />

      {/* Left foot */}
      <path d="M15.5 46 L11.5 46" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />

      {/* Right foot */}
      <path d="M22.5 46 L26.5 46" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
