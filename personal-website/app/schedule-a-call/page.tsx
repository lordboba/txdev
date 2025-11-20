import type { Metadata } from 'next';
import Link from 'next/link';
import { callHighlights, callSocialProof } from '@/lib/siteData';
import { NavBar } from '@/components/NavBar';
export const metadata: Metadata = {
  title: 'Schedule a Call — Tyler Xiao',
  description:
    'Book a quick intro with Tyler Xiao to talk internships, AI agent work, or backend collaborations.',
};

const CALENDLY_URL =
  'https://calendly.com/yxiao1717/glitch-dev-team-officer-interview';
const CALENDLY_EMBED_URL = `${CALENDLY_URL}?embed_domain=tylerxiao.com&embed_type=Inline`;

export default function ScheduleCallPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-5 py-16 sm:px-6">
      <NavBar />
      <Link
        href="/"
        className="text-sm font-semibold text-muted transition hover:text-foreground"
      >
        ← Back to home
      </Link>

      <header className="pane p-6">
        <p className="eyebrow">Schedule a call</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          15-minute chat to align on goals.
        </h1>
        <p className="mt-3 text-base text-muted">
          We’ll cover what you’re building, how I can help, and immediate next
          steps. Keep it lightweight—think of it as a quick code review for your
          roadmap.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="#calendly"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Book now
          </Link>
          <Link
            href="mailto:tylerxiao@ucla.edu"
            className="inline-flex items-center justify-center rounded-full border border-divider px-6 py-3 text-sm font-semibold text-foreground transition hover:border-foreground"
          >
            Email instead
          </Link>
        </div>
      </header>
      <section id="calendly" className="pane overflow-hidden p-0">
        <iframe
          src={CALENDLY_EMBED_URL}
          title="Schedule a call with Tyler Xiao"
          className="h-[900px] w-full"
          frameBorder="0"
        />
      </section>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="pane p-6">
          <h2 className="text-2xl font-semibold">What to expect</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            {callHighlights.map((highlight) => (
              <li
                key={highlight}
                className="rounded-2xl border border-divider bg-background/60 px-4 py-3"
              >
                {highlight}
              </li>
            ))}
          </ul>
        </div>
        <div className="pane p-6">
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted">
            Social proof
          </h3>
          <div className="mt-4 space-y-3 text-sm text-muted">
            {callSocialProof.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-divider bg-background/80 px-4 py-3"
              >
                {item}
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted">
            Questions before booking?{' '}
            <Link
              href="mailto:tylerxiao@ucla.edu"
              className="font-semibold text-primary hover:text-primary/80"
            >
              Send a note.
            </Link>
          </p>
        </div>
      </section>

      <footer className="pane p-5 text-sm text-muted">
        Leave a short brief or NDA request in the Calendly notes—I’ll respond
        before the call.
      </footer>
    </div>
  );
}
