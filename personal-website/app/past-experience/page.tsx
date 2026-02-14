import type { Metadata } from 'next';
import Link from 'next/link';
import { experiences, projects } from '@/lib/siteData';
import { NavBar } from '@/components/NavBar';
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
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-5 py-16 sm:px-6">
      <NavBar />
      <Link
        href="/"
        className="text-sm font-semibold text-muted transition hover:text-accent"
      >
        &larr; Back to home
      </Link>

      <header className="space-y-4">
        <p className="eyebrow">// past experience</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Commit history of roles and leadership.
        </h1>
        <p className="text-base text-muted">
          Deeper snippets from internships and campus orgs.
        </p>
        <div className="h-px bg-divider" />
      </header>

      <section className="pane overflow-hidden">
        <div className="border-b border-divider px-6 py-3">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            Focus Areas
          </span>
        </div>
        <div className="flex flex-wrap gap-2 px-6 py-4">
          {focusAreas.map((area) => (
            <span key={area} className="chip">
              {area}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        {experiences.map((exp, i) => (
          <article key={`${exp.company}-${exp.role}`} className="pane p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted">
              <span>
                {exp.start} — {exp.end}
              </span>
              <span className="text-secondary">{exp.company}</span>
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold">
              {exp.role}
            </h2>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              {exp.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {exp.focus.map((label) => (
                <span key={label} className="chip">
                  {label}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <p className="eyebrow">// projects</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            Projects
          </h2>
          <p className="mt-2 text-sm text-muted">Click any project.</p>
          <div className="mt-3 h-px bg-divider" />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.title}
              href={project.link}
              className="pane block p-5 transition hover:scale-[1.01]"
            >
              <div className="flex items-center justify-between font-mono text-xs text-muted">
                <span>{project.role}</span>
                <span className="text-secondary">
                  {project.focus.join(' / ')}
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold">
                {project.title}
              </h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {project.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {project.tech.map((tech) => (
                  <span key={tech} className="chip">
                    {tech}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-divider pt-6 text-sm text-muted">
        <span>Want to chat?</span>
        <Link
          href="/schedule-a-call"
          className="font-semibold text-accent transition hover:opacity-75"
        >
          Schedule a call &rarr;
        </Link>
      </footer>
    </div>
  );
}
