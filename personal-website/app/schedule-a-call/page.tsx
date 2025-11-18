import type { Metadata } from "next";
import Link from "next/link";
import { callHighlights, callSocialProof } from "@/lib/siteData";

export const metadata: Metadata = {
  title: "Schedule a Call — Tyler Xiao",
  description:
    "Book a short introduction call with Tyler Xiao to discuss collaborations, advisory, and product engineering engagements.",
};

// Update the URL below with the actual Calendly link once ready.
const CALENDLY_URL = "https://calendly.com/yxiao1717/glitch-dev-team-officer-interview";

export default function ScheduleCallPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-16 sm:px-8 lg:px-0">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
      >
        ← Back to home
      </Link>

      <header className="mt-8 rounded-3xl border border-white/10 bg-surface/70 p-8 shadow-[var(--shadow-card)]">
        <p className="eyebrow">Schedule a call</p>
        <h1 className="mt-4 font-[family:var(--font-display),_Inter] text-4xl font-semibold tracking-tight">
          Let’s align on what you’re building.
        </h1>
        <p className="mt-4 text-base text-muted">
          A lightweight, 15-minute conversation to understand your goals, share
          relevant past work, and map out a next step. Whether you need advisory
          support or a build partner, you’ll leave with clarity.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={CALENDLY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 font-medium text-background shadow-[0_20px_60px_rgba(124,92,252,0.35)] transition hover:opacity-90"
          >
            Open Calendly
          </Link>
          <Link
            href="mailto:hello@tylerxiao.com"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 font-medium text-foreground transition hover:border-white/40"
          >
            Email instead
          </Link>
        </div>
      </header>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-surface/70 p-8 shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-semibold">What to expect</h2>
          <ul className="mt-4 space-y-4 text-sm text-muted">
            {callHighlights.map((highlight) => (
              <li
                key={highlight}
                className="flex gap-3 rounded-2xl border border-white/5 bg-background/40 p-4"
              >
                <span className="text-secondary">●</span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-white/10 bg-surface/50 p-8 shadow-[var(--shadow-card)]">
          <h3 className="text-sm uppercase tracking-[0.3em] text-muted">
            Social proof
          </h3>
          <div className="mt-4 space-y-4">
            {callSocialProof.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/5 bg-background/40 p-4 text-sm text-muted"
              >
                {item}
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted">
            Questions before booking?{" "}
            <Link
              href="mailto:hello@tylerxiao.com"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Send a note.
            </Link>
          </p>
        </div>
      </section>

      <footer className="mt-16 rounded-3xl border border-white/10 bg-surface/60 p-6 text-sm text-muted shadow-[var(--shadow-card)]">
        Need a particular NDA or briefing doc? Mention it in the Calendly note,
        and I’ll follow up before our chat.
      </footer>
    </div>
  );
}
