import type { Metadata } from 'next';
import Link from 'next/link';
import { experiences, projects } from '@/lib/siteData';
import { NavBar } from '@/components/NavBar';
import { ThemeBar } from '@/components/ThemeBar';

export const metadata: Metadata = {
  title: 'Past Experience — Tyler Xiao',
  description:
    "Detailed look at Tyler Xiao's experience, responsibilities, and related project write-ups.",
};

const focusAreas = Array.from(
  new Set(experiences.flatMap((exp) => exp.focus)),
).sort();

export default function PastExperiencePage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-10 px-5 py-14 sm:px-6 lg:px-8">
      <NavBar />

      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-sm border border-divider bg-surface px-3 py-2 text-xs font-medium text-muted transition-colors duration-200 hover:border-accent hover:text-foreground"
      >
        &larr; Back to home
      </Link>

      <header className="space-y-4">
        <p className="font-[var(--font-mono)] text-xs font-medium uppercase tracking-[0.22em] text-muted">
          Past Experience
        </p>
        <h1 className="max-w-3xl font-[var(--font-display)] text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          Commit history of roles and leadership.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Deeper snippets from internships, projects, and campus orgs.
        </p>
        <div className="h-px bg-divider/80" />
      </header>

      <section className="overflow-hidden rounded-sm border border-divider bg-surface">
        <div className="border-b border-divider px-5 py-3">
          <span className="font-[var(--font-mono)] text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Focus Areas
          </span>
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {focusAreas.map((area) => (
            <span
              key={area}
              className="rounded-sm border border-divider bg-accent-muted px-2.5 py-1 text-[11px] font-[var(--font-mono)] text-accent"
            >
              {area}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {experiences.map((exp) => (
          <article
            key={`${exp.company}-${exp.role}`}
            className="rounded-sm border border-divider bg-surface p-5 transition-all duration-300 hover:border-accent hover:bg-accent-muted sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-[var(--font-mono)] text-muted">
              <span>
                {exp.start} — {exp.end}
              </span>
              <span className="font-medium text-secondary">{exp.company}</span>
            </div>
            <h2 className="mt-4 font-[var(--font-display)] text-2xl font-semibold tracking-tight">
              {exp.role}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-muted">
              {exp.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {exp.focus.map((label) => (
                <span
                  key={label}
                  className="rounded-sm border border-divider bg-surface-raised px-2.5 py-1 text-[11px] font-[var(--font-mono)] text-muted"
                >
                  {label}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-[var(--font-mono)] text-xs font-medium uppercase tracking-[0.22em] text-muted">
            {'// projects'}
          </p>
          <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight">
            Projects
          </h2>
          <p className="mt-2 text-sm text-muted">Click any project.</p>
          <div className="mt-3 h-px bg-divider/80" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.title}
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-sm border border-divider bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-muted"
            >
              <div className="text-xs font-[var(--font-mono)] text-muted">
                {project.role}
              </div>
              <h3 className="mt-3 font-[var(--font-display)] text-xl font-semibold">
                {project.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-muted">
                {project.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {project.tech.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-sm border border-divider bg-accent-muted px-2 py-1 text-[11px] font-[var(--font-mono)] text-accent"
                  >
                    {tech}
                  </span>
                ))}
              </div>
              <p className="mt-4 inline-flex items-center text-xs font-medium text-muted transition-colors duration-200 group-hover:text-foreground">
                Visit project
                <span aria-hidden className="ml-2 text-accent">
                  →
                </span>
              </p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-divider pt-6 text-sm text-muted">
        <span>Want to chat?</span>
        <Link
          href="/schedule-a-call"
          className="inline-flex items-center rounded-sm border border-divider bg-surface px-3 py-2 text-xs font-medium text-accent transition hover:border-accent hover:bg-accent-muted"
        >
          Schedule a call &rarr;
        </Link>
      </footer>
      <ThemeBar />
    </div>
  );
}
