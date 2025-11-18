import type { Metadata } from "next";
import Link from "next/link";
import { experiences, projects } from "@/lib/siteData";

export const metadata: Metadata = {
  title: "Past Experience — Tyler Xiao",
  description:
    "Detailed look at Tyler Xiao's experience, responsibilities, and related project write-ups.",
};

const focusAreas = Array.from(new Set(experiences.flatMap((exp) => exp.focus))).sort();

export default function PastExperiencePage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-5 py-16 sm:px-6">
      <Link
        href="/"
        className="text-sm font-semibold text-muted transition hover:text-foreground"
      >
        ← Back to home
      </Link>

      <header className="space-y-4">
        <p className="eyebrow">Past Experience</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Commit history of roles and leadership.
        </h1>
        <p className="text-base text-muted">
          Deeper snippets from internships and campus orgs. Filters below mimic a command palette—toggle
          through interests quickly.
        </p>
      </header>

      <section className="pane p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Focus Areas</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {focusAreas.map((area) => (
            <span key={area} className="rounded-full border border-divider px-4 py-2 text-muted">
              {area}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        {experiences.map((exp) => (
          <article key={`${exp.company}-${exp.role}`} className="pane p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-muted">
              <span>
                {exp.start} — {exp.end}
              </span>
              <span>{exp.company}</span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold">{exp.role}</h2>
            <p className="mt-3 text-sm text-muted">{exp.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {exp.focus.map((label) => (
                <span key={label} className="rounded-full border border-divider px-3 py-1 text-muted">
                  {label}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <p className="eyebrow">Projects</p>
          <h2 className="mt-2 text-3xl font-semibold">Write-ups connected to the roles.</h2>
          <p className="mt-2 text-sm text-muted">
            Each tab mirrors an editor pane—open any link to jump into source, demos, or docs.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.title}
              href={project.link}
              className="pane block p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between text-xs font-mono text-muted">
                <span>{project.role}</span>
                <span>{project.focus.join(" / ")}</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold">{project.title}</h3>
              <p className="mt-2 text-sm text-muted">{project.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {project.tech.map((tech) => (
                  <span key={tech} className="rounded-full border border-divider px-3 py-1 text-muted">
                    {tech}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-divider pt-6 text-sm text-muted">
        <span>Talk with me. :D</span>
        <Link
          href="/schedule-a-call"
          className="font-semibold text-primary transition hover:text-primary/80"
        >
          Schedule a call →
        </Link>
      </footer>
    </div>
  );
}
