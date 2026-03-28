import { Link } from "wouter";
import { motion } from "framer-motion";
import { MapPin, Star, Route, Plus, Trophy, Navigation, Search, ThumbsUp } from "lucide-react";

const features = [
  {
    icon: "🗺️",
    title: "Live Map",
    desc: "See every rated rest stop, gas station, and fast-food bathroom on an interactive map. Color-coded by rating so you know what you're walking into.",
  },
  {
    icon: "🚽",
    title: "Flush Ratings",
    desc: "Community-scored on 6 categories: cleanliness, odor, TP supply, lighting, safety, and family-friendliness.",
  },
  {
    icon: "🛣️",
    title: "Route Planner",
    desc: "Enter your start and end cities and see every rated stop within 15 miles of your driving route — no surprises mid-trip.",
  },
  {
    icon: "📍",
    title: "Add Stops",
    desc: "Found a gem that isn't on the map? Add it in seconds using GPS or search. Help the next road tripper.",
  },
  {
    icon: "🏆",
    title: "Leaderboard",
    desc: "Royal Flush picks and the Biohazard Zone — the best and worst-rated bathrooms in the database.",
  },
  {
    icon: "♿",
    title: "Amenity Tags",
    desc: "Filter by accessibility, baby changing stations, showers, pet areas, EV charging, WiFi, and more.",
  },
];

const steps = [
  {
    num: "1",
    icon: <Search className="w-5 h-5" />,
    title: "Search or use GPS",
    desc: "Type a city or tap the location pin to find stops near you. Zoom in on the map or switch to list view.",
  },
  {
    num: "2",
    icon: <MapPin className="w-5 h-5" />,
    title: "Pick a stop",
    desc: "Tap any pin or list card to see the full detail — ratings breakdown, photos, hours, amenities, and directions.",
  },
  {
    num: "3",
    icon: <Star className="w-5 h-5" />,
    title: "Rate it",
    desc: "After a visit, leave a flush rating in under 30 seconds. Your review helps other road trippers.",
  },
  {
    num: "4",
    icon: <Plus className="w-5 h-5" />,
    title: "Add missing stops",
    desc: "Not on the map yet? Tap + and contribute it. Highway tagging helps others filter by route.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
};

export default function About() {
  return (
    <div className="h-[100dvh] bg-gradient-to-b from-slate-50 to-white flex flex-col max-w-md mx-auto sm:border-x sm:border-border/50 shadow-2xl shadow-black/5">

      {/* Header */}
      <header className="shrink-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border/50 px-4 py-2.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group outline-none">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            width={44}
            height={44}
            alt="Can't Hold It logo"
            className="rounded-xl shadow-md group-hover:scale-105 group-active:scale-95 transition-transform shrink-0"
          />
          <div className="flex flex-col justify-center">
            <h1 className="text-[1.15rem] font-display font-bold text-foreground leading-none tracking-tight">
              Can't Hold It
            </h1>
            <p className="text-[10px] font-bold tracking-wide text-orange-500 mt-0.5">
              Because nature doesn't wait
            </p>
          </div>
        </Link>
        <Link
          href="/"
          className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 active:scale-95 transition-all"
        >
          Open App →
        </Link>
      </header>

      <main
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >

        {/* Hero */}
        <section className="relative overflow-hidden px-6 pt-12 pb-10 text-center bg-gradient-to-b from-primary/5 to-transparent">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="text-7xl mb-4 leading-none"
          >
            🚽
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="font-display text-4xl font-black text-foreground leading-tight mb-2"
          >
            Can't Hold It
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="text-orange-500 font-bold text-sm tracking-wide mb-3"
          >
            Because nature doesn't wait
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="text-muted-foreground text-base max-w-xs mx-auto leading-relaxed mb-8"
          >
            The community-powered restroom finder built for US road trippers. Find, rate, and add stops along any route.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34 }}
          >
            <Link href="/">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="bg-gradient-to-r from-primary to-blue-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-primary/30 inline-flex items-center gap-2"
              >
                <Navigation className="w-5 h-5" />
                Find a Stop Near Me
              </motion.button>
            </Link>
          </motion.div>

          {/* Decorative dots */}
          <div className="absolute top-8 left-4 w-2 h-2 rounded-full bg-primary/20" />
          <div className="absolute top-16 right-6 w-3 h-3 rounded-full bg-orange-300/40" />
          <div className="absolute bottom-4 left-8 w-2 h-2 rounded-full bg-blue-300/40" />
        </section>

        {/* Features */}
        <section className="px-5 py-10">
          <motion.h3
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="font-display text-2xl font-black text-foreground text-center mb-1"
          >
            Everything you need on the road
          </motion.h3>
          <motion.p
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={1}
            variants={fadeUp}
            className="text-muted-foreground text-sm text-center mb-7"
          >
            No subscriptions. No sign-in. Just open and go.
          </motion.p>

          <div className="grid grid-cols-2 gap-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                custom={i + 2}
                variants={fadeUp}
                className="bg-white rounded-2xl p-4 border border-border/60 shadow-sm flex flex-col gap-2"
              >
                <span className="text-2xl leading-none">{f.icon}</span>
                <h4 className="font-display font-bold text-sm text-foreground leading-tight">{f.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How to use */}
        <section className="px-5 pb-10 bg-slate-50 py-10 mx-4 rounded-3xl mb-6">
          <motion.h3
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="font-display text-2xl font-black text-foreground text-center mb-1"
          >
            How it works
          </motion.h3>
          <motion.p
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={1}
            variants={fadeUp}
            className="text-muted-foreground text-sm text-center mb-7"
          >
            Four steps to a comfortable pit stop
          </motion.p>

          <div className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                custom={i + 2}
                variants={fadeUp}
                className="flex items-start gap-4 bg-white rounded-2xl p-4 border border-border/60 shadow-sm"
              >
                <div className="shrink-0 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-display font-black text-lg shadow-sm shadow-primary/30">
                  {step.num}
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-foreground mb-1">{step.title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* iPhone / Safari setup */}
        <section className="mx-4 mb-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center gap-3">
              <span className="text-3xl leading-none">📱</span>
              <div>
                <h3 className="font-display text-lg font-black text-white leading-tight">iPhone users</h3>
                <p className="text-slate-300 text-xs mt-0.5">Allow location so the app can find stops near you</p>
              </div>
            </div>

            <div className="px-5 py-5 flex flex-col gap-5">

              {/* Why location is needed */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                Can't Hold It uses your location to find nearby stops and to accurately pin new ones you add. Safari on iPhone blocks this by default — here's how to allow it.
              </p>

              {/* Step-by-step */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-foreground uppercase tracking-wide">If location is blocked or not working:</p>

                {[
                  { step: "1", text: "Open the iPhone Settings app" },
                  { step: "2", text: "Tap Privacy & Security" },
                  { step: "3", text: "Tap Location Services — make sure it's toggled ON" },
                  { step: "4", text: 'Scroll down and tap Safari Websites (or Safari)' },
                  { step: "5", text: 'Set to "While Using the App"' },
                  { step: "6", text: "Go back to cantholdit.app and tap the location button again" },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-black">
                      {step}
                    </div>
                    <p className="text-sm text-foreground leading-snug pt-0.5">{text}</p>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-border/50" />

              {/* Private mode warning */}
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <span className="text-xl leading-none mt-0.5">⚠️</span>
                <div>
                  <p className="font-bold text-sm text-amber-800 leading-tight">Private Browsing always blocks location</p>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    If you're using Safari's Private tab (the dark/gray address bar), location is permanently off — no settings change will fix it. Switch to a regular tab to use location features.
                  </p>
                </div>
              </div>

              {/* First-time prompt tip */}
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                <span className="text-xl leading-none mt-0.5">💡</span>
                <div>
                  <p className="font-bold text-sm text-blue-800 leading-tight">First time visiting?</p>
                  <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                    Safari will ask "Allow cantholdit.app to use your location?" — tap <strong>Allow</strong>. If you tapped Don't Allow by mistake, follow the steps above to fix it in Settings.
                  </p>
                </div>
              </div>

            </div>
          </motion.div>
        </section>

        {/* Route planning highlight */}
        <section className="mx-4 mb-6 rounded-3xl bg-gradient-to-br from-blue-500 to-primary p-6 text-white">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
          >
            <div className="text-3xl mb-2">🛣️</div>
            <h3 className="font-display text-xl font-black mb-2 leading-tight">Planning a road trip?</h3>
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              Enter your start and end cities in the <strong className="text-white">Route tab</strong>. We'll show you every rated stop within 15 miles of your driving route — sorted by distance from the highway.
            </p>
            <div className="text-sm font-bold bg-white/20 rounded-xl px-3 py-2 inline-block">
              Try: Nashville → Atlanta
            </div>
          </motion.div>
        </section>

        {/* Community */}
        <section className="px-5 py-10 text-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
          >
            <div className="text-4xl mb-3">🤝</div>
            <h3 className="font-display text-2xl font-black text-foreground mb-2">Built by road trippers, for road trippers</h3>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto mb-4">
              Every stop, rating, and photo is contributed by real people on real road trips. The more you contribute, the better it gets for everyone.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              {[
                { icon: <Star className="w-4 h-4" />, label: "Rate stops" },
                { icon: <Plus className="w-4 h-4" />, label: "Add spots" },
                { icon: <ThumbsUp className="w-4 h-4" />, label: "Tag amenities" },
                { icon: <Trophy className="w-4 h-4" />, label: "Top the board" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                  {item.icon}
                  {item.label}
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Final CTA */}
        <section className="px-5 pb-12 text-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="bg-gradient-to-r from-primary to-blue-500 rounded-3xl p-8 text-white"
          >
            <div className="text-4xl mb-3">🚗💨</div>
            <h3 className="font-display text-2xl font-black mb-2">Ready to roll?</h3>
            <p className="text-white/80 text-sm mb-6 leading-relaxed">
              No account needed. Works on any phone. Completely free.
            </p>
            <Link href="/">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="bg-white text-primary font-bold px-8 py-4 rounded-2xl text-base shadow-lg inline-flex items-center gap-2"
              >
                <Navigation className="w-5 h-5" />
                Open the App
              </motion.button>
            </Link>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/50 px-5 py-5 text-center text-xs text-muted-foreground">
          <p>© 2025 Can't Hold It · Community-powered · <Link href="/" className="text-primary font-medium">Open App</Link></p>
        </footer>

      </main>
    </div>
  );
}
