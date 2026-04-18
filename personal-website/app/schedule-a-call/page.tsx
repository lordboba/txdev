import type { Metadata } from 'next';
import Link from 'next/link';
import { callHighlights, callSocialProof } from '@/lib/siteData';
import { NavBar } from '@/components/NavBar';
import { ThemeBar } from '@/components/ThemeBar';

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
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col gap-10 px-5 py-14 sm:px-6 lg:px-8">
      <NavBar />
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-sm border border-divider bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors duration-200 hover:border-accent hover:text-foreground"
      >
        &larr; Back to home
      </Link>

      <header className="rounded-sm border border-divider bg-surface p-6 sm:p-8">
        <p className="font-[var(--font-mono)] text-xs font-medium uppercase tracking-[0.22em] text-muted">
          {'// schedule a call'}
        </p>
        <h1 className="mt-4 max-w-3xl font-[var(--font-display)] text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          15-minute chat to align on goals.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted sm:text-base">
          We&rsquo;ll cover what you&rsquo;re building, how I can help, and
          immediate next steps. Keep it lightweight — think of it as a quick
          code review for your roadmap.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="#calendly"
            className="inline-flex items-center justify-center rounded-sm bg-accent px-6 py-3 text-sm font-medium text-[color:var(--accent-ink)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_26px_rgba(0,0,0,0.25)]"
          >
            Book now
          </Link>
          <Link
            href="mailto:tylerxiao@ucla.edu"
            className="inline-flex items-center justify-center rounded-sm border border-dashed border-divider bg-surface px-6 py-3 text-sm font-medium text-muted transition-all duration-300 hover:border-accent hover:text-foreground"
          >
            Email instead
          </Link>
        </div>
      </header>

      <section
        id="calendly"
        className="overflow-hidden rounded-sm border border-divider bg-surface"
      >
        <iframe
          src={CALENDLY_EMBED_URL}
          title="Schedule a call with Tyler Xiao"
          className="h-[640px] min-h-[640px] w-full sm:h-[760px]"
          frameBorder="0"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="rounded-sm border border-divider bg-surface p-6">
          <h2 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight">
            What to expect
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            {callHighlights.map((highlight) => (
              <li
                key={highlight}
                className="rounded-sm border border-divider bg-surface-raised px-4 py-3"
              >
                {highlight}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-sm border border-divider bg-surface p-6">
          <h3 className="font-[var(--font-mono)] text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Social Proof
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            {callSocialProof.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-sm border border-divider bg-surface-raised px-4 py-3 text-muted"
              >
                <span className="text-xs font-[var(--font-mono)] text-secondary">
                  [ok]
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted">
            Questions before booking?{' '}
            <Link
              href="mailto:tylerxiao@ucla.edu"
              className="font-medium text-accent transition hover:text-foreground"
            >
              Send a note.
            </Link>
          </p>
        </div>
      </section>

      <footer className="rounded-sm border border-divider bg-surface p-5 text-sm text-muted">
        Leave a short brief or NDA request in the Calendly notes — I&rsquo;ll
        respond before the call.
      </footer>
      <ThemeBar />
    </div>
  );
}
