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
        className="text-sm font-semibold text-muted transition hover:text-accent"
      >
        &larr; Back to home
      </Link>

      <header className="pane p-6">
        <p className="eyebrow">// schedule a call</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">
          15-minute chat to align on goals.
        </h1>
        <p className="mt-3 text-base text-muted leading-relaxed">
          We&rsquo;ll cover what you&rsquo;re building, how I can help, and
          immediate next steps. Keep it lightweight — think of it as a quick code
          review for your roadmap.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="#calendly"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 font-mono text-sm font-semibold text-background shadow-[0_2px_12px_rgba(232,196,104,0.2)] transition hover:shadow-[0_4px_20px_rgba(232,196,104,0.3)] hover:-translate-y-0.5"
          >
            Book now
          </Link>
          <Link
            href="mailto:tylerxiao@ucla.edu"
            className="inline-flex items-center justify-center rounded-lg border border-dashed border-divider px-6 py-3 font-mono text-sm font-semibold text-muted transition hover:border-accent hover:text-foreground"
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
          <h2 className="font-display text-2xl font-semibold">
            What to expect
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            {callHighlights.map((highlight) => (
              <li
                key={highlight}
                className="rounded-lg border border-divider bg-surface-raised/60 px-4 py-3"
              >
                {highlight}
              </li>
            ))}
          </ul>
        </div>
        <div className="pane p-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted">
            Social proof
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            {callSocialProof.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-lg border border-divider bg-surface-raised/60 px-4 py-3 text-muted"
              >
                <span className="font-mono text-secondary">[ok]</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted">
            Questions before booking?{' '}
            <Link
              href="mailto:tylerxiao@ucla.edu"
              className="font-semibold text-accent transition hover:opacity-75"
            >
              Send a note.
            </Link>
          </p>
        </div>
      </section>

      <footer className="pane p-5 text-sm text-muted">
        Leave a short brief or NDA request in the Calendly notes — I&rsquo;ll
        respond before the call.
      </footer>
    </div>
  );
}
