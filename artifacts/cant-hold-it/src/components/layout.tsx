import { ReactNode } from "react";
import { Link } from "wouter";
import { GottaGoLogo } from "@/components/gotta-go-logo";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative max-w-md mx-auto sm:border-x sm:border-border/50 shadow-2xl shadow-black/5">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group outline-none">
          <div className="bg-gradient-to-br from-primary to-blue-400 p-2 rounded-xl shadow-md shadow-primary/20 group-hover:scale-105 group-active:scale-95 transition-all">
            <GottaGoLogo className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground leading-tight tracking-tight">
              Can't Hold It
            </h1>
            <p className="text-[10px] uppercase font-bold tracking-wider text-primary/80 -mt-1">
              Because nature doesn't wait
            </p>
          </div>
        </Link>
        <span className="text-[10px] font-semibold text-muted-foreground/60 tracking-wide hidden sm:block">
          🇺🇸 America's Road Trip Bathroom Rater
        </span>
      </header>

      <main className="flex-1 flex flex-col relative z-0">
        {children}
      </main>
    </div>
  );
}
