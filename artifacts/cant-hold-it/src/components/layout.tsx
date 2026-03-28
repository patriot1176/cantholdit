import { ReactNode, useState } from "react";
import { Link } from "wouter";
import { useProfile } from "@/contexts/profile-context";
import { ProfileSheet } from "@/components/profile-sheet";

export function Layout({ children }: { children: ReactNode }) {
  const { profile, level } = useProfile();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="h-[100dvh] flex flex-col bg-background relative max-w-md mx-auto sm:border-x sm:border-border/50 shadow-2xl shadow-black/5">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border/50 px-4 py-2.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group outline-none">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            width={44}
            height={44}
            alt="Can't Hold It logo"
            className="rounded-xl shadow-md group-hover:scale-105 group-active:scale-95 transition-transform shrink-0"
          />
          <div className="flex flex-col justify-center">
            <h1 className="text-[1.15rem] font-display font-bold text-foreground leading-none tracking-tight whitespace-nowrap">
              Can't Hold It
            </h1>
            <p className="text-[10px] font-bold tracking-wide text-orange-500 mt-0.5 whitespace-nowrap">
              Because nature doesn't wait
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-1.5 bg-primary/8 hover:bg-primary/15 active:scale-95 border border-primary/20 rounded-xl px-2.5 py-1.5 transition-all"
            aria-label="Open your road profile"
          >
            <span className="text-base leading-none">{level.emoji}</span>
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-black text-primary leading-none whitespace-nowrap">
                {level.name}
              </span>
              <span className="text-[9px] font-semibold text-muted-foreground leading-none mt-0.5">
                {profile.points} pts
              </span>
            </div>
          </button>

          <Link
            href="/about"
            className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5 active:scale-95"
          >
            About
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-0">
        {children}
      </main>

      <ProfileSheet open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}
