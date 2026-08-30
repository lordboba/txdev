import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { projects } from '@/content/projectData';
import { experienceGroups } from '@/content/experienceData';
import { NavBar } from '@/components/NavBar';
import { ThemeBar } from '@/components/ThemeBar';

export const metadata: Metadata = {
  title: 'Experience - Tyler Xiao',
  description: 'Detailed look at my upcoming, current, and past work.',
};

const focusAreas = Array.from(
  new Set(
    experienceGroups.flatMap((group) =>
      group.items.flatMap((exp) => exp.focus),
    ),
  ),
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
          Experience
        </p>
        <h1 className="max-w-3xl font-[var(--font-display)] text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          Experience across past, current, and upcoming roles.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Role history grouped by time, covering the work, responsibilities, and
          systems behind each role.
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

      <section className="space-y-8">
        {experienceGroups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.status} className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-divider pb-3">
                <div>
                  <p className="font-[var(--font-mono)] text-xs font-medium uppercase tracking-[0.22em] text-muted">
                    {group.label}
                  </p>
                  <p className="mt-1 text-sm text-muted">{group.description}</p>
                </div>
                <span className="font-[var(--font-mono)] text-xs text-accent">
                  {String(group.items.length).padStart(2, '0')} entries
                </span>
              </div>

              <div className="grid gap-4">
                {group.items.map((exp) => (
                  <article
                    key={`${exp.company}-${exp.role}`}
                    className="rounded-sm border border-divider bg-surface p-5 transition-all duration-300 hover:border-accent hover:bg-accent-muted sm:p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-[var(--font-mono)] text-muted">
                      <span>{exp.period}</span>
                      <span className="font-medium text-secondary">
                        {exp.company}
                      </span>
                    </div>
                    <h2 className="mt-4 font-[var(--font-display)] text-2xl font-semibold tracking-tight">
                      {exp.role}
                    </h2>
                    <p className="mt-3 max-w-4xl text-sm leading-7 text-muted">
                      {exp.summary}
                    </p>
                    <p className="mt-3 max-w-4xl border-l border-accent pl-4 text-sm leading-7 text-foreground">
                      {exp.proof}
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
              </div>
            </div>
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
          <p className="mt-2 text-sm text-muted">
            Each project includes its implementation stack and a link to the
            live product or source.
          </p>
          <div className="mt-3 h-px bg-divider/80" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.title}
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-sm border border-divider bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-muted"
            >
              <div className="relative flex aspect-[16/9] items-center justify-center border-b border-divider bg-accent-muted">
                {project.image ? (
                  <Image
                    src={project.image}
                    alt={`${project.title} proof`}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center font-[var(--font-mono)]">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-accent">
                      {project.proofLabel}
                    </span>
                    <strong className="text-xs font-medium text-foreground">
                      {project.tech.slice(0, 2).join(' / ')}
                    </strong>
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3 text-xs font-[var(--font-mono)] text-muted">
                  <span>{project.role}</span>
                  <span className="text-accent">{project.proofLabel}</span>
                </div>
                <h3 className="mt-3 font-[var(--font-display)] text-xl font-semibold">
                  {project.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {project.description}
                </p>
                <p className="mt-3 border-l border-accent pl-3 text-sm leading-6 text-foreground">
                  {project.proof}
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
                  {project.linkLabel}
                  <span aria-hidden className="ml-2 text-accent">
                    →
                  </span>
                </p>
              </div>
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
