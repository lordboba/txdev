import type { Metadata } from "next";
import Link from "next/link";
import { experiences, projects } from "@/lib/siteData";

export const metadata: Metadata = {
  title: "Past Experience — Tyler Xiao",
  description:
    "Detailed view of Tyler Xiao's work history, including timelines and selected project spotlights.",
};

const focusAreas = Array.from(
  new Set(experiences.flatMap((exp) => exp.focus)),
).sort();

export default function PastExperiencePage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:px-0">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
      >
        ← Back to home
      </Link>

      <header className="mt-8 space-y-5">
        <p className="eyebrow">Past Experience</p>
        <h1 className="font-[family:var(--font-display),_Inter] text-4xl font-semibold tracking-tight sm:text-5xl">
          A closer look at the roles, projects, and systems I’ve shaped.
        </h1>
        <p className="text-base text-muted">
          From platform teams to zero-to-one spinouts, I gravitate toward
          ambiguous problems that require tight feedback loops between product,
          design, and engineering. Below is the expanded journey.
        </p>
      </header>

      <section className="mt-10 rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm uppercase tracking-[0.3em] text-muted">
          Focus Areas
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {focusAreas.map((area) => (
            <span
              key={area}
              className="rounded-full border border-white/10 bg-background/40 px-4 py-2 text-muted"
            >
              {area}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-12 space-y-8">
        {experiences.map((exp) => (
          <article
            key={`${exp.company}-${exp.role}`}
            className="rounded-3xl border border-white/10 bg-surface/70 p-8 shadow-[var(--shadow-card)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
              <span>
                {exp.start} — {exp.end}
              </span>
              <span className="text-primary">{exp.company}</span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold">{exp.role}</h2>
            <p className="mt-3 text-base text-muted">{exp.summary}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {exp.focus.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-primary/10 px-3 py-1 text-primary"
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-6 grid gap-4 text-sm text-muted sm:grid-cols-2">
              <p>
                Teams partnered with: platform engineering, research, design
                systems, revenue analytics.
              </p>
              <p>
                Outcomes: improved build times, shipped new collaboration
                primitives, and built foundations for AI-assisted workflows.
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-16 space-y-6">
        <div>
          <p className="eyebrow">Projects</p>
          <h2 className="mt-3 text-3xl font-semibold">Expanded write-ups</h2>
          <p className="mt-3 text-sm text-muted">
            Each project below ties directly to the roles above—hover for links
            to demos and source.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.title}
              href={project.link}
              className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[var(--shadow-card)] transition hover:border-white/30"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{project.title}</h3>
                <span className="text-xs uppercase tracking-[0.3em] text-muted">
                  {project.role}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted">{project.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                {project.tech.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full bg-primary/10 px-3 py-1 text-primary"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-muted">
        <span>Let’s build something enduring.</span>
        <Link
          href="/schedule-a-call"
          className="rounded-full border border-white/20 px-4 py-2 text-foreground transition hover:border-white/40"
        >
          Schedule a call →
        </Link>
      </footer>
    </div>
  );
}
