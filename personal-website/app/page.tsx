import Link from 'next/link';
import {
  contactLinks,
  experiences,
  projects,
  quickFacts,
} from '@/lib/siteData';
import { UserCountTracker } from '@/components/UserCountTracker';
import { NavBar } from '@/components/NavBar';
import { getRecentPostMeta } from '@/lib/blog';
import { HomeMotionEffects } from '@/components/HomeMotionEffects';
import { HomeHero } from '@/components/HomeHero';

function ContactIcon({ label }: { label: string }) {
  if (label.startsWith('GitHub')) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 fill-current"
      >
        <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.51 2.87 8.34 6.84 9.69.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.85c.85 0 1.71.12 2.52.36 1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.95-2.35 4.82-4.59 5.08.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .27.18.6.69.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
      </svg>
    );
  }

  if (label.startsWith('LinkedIn')) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 fill-current"
      >
        <path d="M4.98 3.5A2.48 2.48 0 1 0 5 8.46a2.48 2.48 0 0 0-.02-4.96ZM3 9h4v12H3V9Zm7 0h3.83v1.71h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.7 4.78 6.22V21h-4v-5.45c0-1.3-.02-2.98-1.78-2.98-1.78 0-2.05 1.42-2.05 2.89V21h-4V9Z" />
      </svg>
    );
  }

  if (label.startsWith('Twitter')) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 fill-current"
      >
        <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.27l-4.9-7.42L5.54 22H2.43l7.24-8.28L1.8 2h6.43l4.43 6.73L18.9 2Zm-1.1 18h1.73L7.3 3.9H5.45L17.8 20Z" />
      </svg>
    );
  }

  if (label.startsWith('Buy Me a Coffee')) {
    return (
      <span aria-hidden="true" className="text-sm leading-none">
        ☕
      </span>
    );
  }

  return null;
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="reveal-on-scroll max-w-3xl space-y-3">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="text-base text-muted">{description}</p>
      ) : null}
      <div className="mt-4 h-px bg-divider" />
    </div>
  );
}

export default async function Home() {
  const latestPosts = await getRecentPostMeta(3);

  return (
    <div className="home-shell flex min-h-screen flex-col bg-background text-foreground">
      <NavBar />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-7 py-12 sm:gap-24 sm:px-6 sm:py-20">
        <HomeMotionEffects />

        {/* ═══ Hero ═══ */}
        <HomeHero />

        {/* ═══ About ═══ */}
        <section
          id="about"
          className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
        >
          <div className="reveal-on-scroll reveal-slide-left">
            <SectionHeading
              eyebrow="// about"
              title="About Me"
              description="UCLA student studying Computer Science — focused on building systems that work."
            />
          </div>
          <div
            data-pointer-status
            className="pane reveal-3d status-card-3d overflow-hidden"
          >
            <div className="status-card-live border-b border-divider px-5 py-3">
              <span className="font-mono text-xs tracking-widest uppercase text-muted">
                status monitor
              </span>
            </div>
            <dl className="divide-y divide-divider">
              {quickFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="status-row-hover flex items-center justify-between px-5 py-3.5"
                >
                  <dt className="font-mono text-sm text-muted shrink-0">
                    {fact.label}
                  </dt>
                  <dd className="font-mono text-sm text-secondary text-right">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ═══ Experience ═══ */}
        <section id="experience" className="space-y-10">
          <SectionHeading
            eyebrow="// experience"
            title="git log --timeline"
            description="Recent roles across AI workflows, evaluations, and student leadership."
          />
          <div
            data-timeline-root
            className="timeline-motion relative space-y-5 pl-8"
          >
            {/* Timeline line */}
            <div className="timeline-line absolute left-[7px] top-2 bottom-2 w-px" />

            {experiences.map((exp, i) => (
              <article
                key={`${exp.company}-${exp.role}`}
                data-timeline-item
                tabIndex={0}
                className="timeline-entry reveal-flip relative space-y-3"
              >
                {/* Timeline node */}
                <div className="timeline-node absolute -left-8 top-1.5 h-[9px] w-[9px] rounded-full" />

                <div className="flex items-center gap-3 font-mono text-xs text-muted">
                  <span>
                    {exp.start} — {exp.end}
                  </span>
                  <span className="opacity-40">
                    {['a3f8c1d', 'e7b2d4f', 'b9c1a3e', 'c1a9f3b'][i % 4]}
                  </span>
                </div>

                <div className="pane p-5">
                  <h3 className="font-display text-xl font-semibold">
                    {exp.role}{' '}
                    <span className="font-sans text-base font-normal text-muted">
                      · {exp.company}
                    </span>
                  </h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    {exp.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {exp.focus.map((label) => (
                      <span key={label} className="chip">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Link
            href="/past-experience"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:opacity-75"
          >
            View the full timeline &rarr;
          </Link>
        </section>

        {/* ═══ Projects ═══ */}
        <section id="projects" className="space-y-10">
          <SectionHeading
            eyebrow="// projects"
            title="Selected builds"
            description="A few things I've shipped."
          />
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.title}
                data-pointer-card
                className="pane project-motion-card reveal-3d flex h-full flex-col overflow-hidden transition hover:scale-[1.01]"
              >
                {/* Tab bar */}
                <div className="flex items-center gap-2 border-b border-divider px-5 py-3 font-mono text-sm text-accent">
                  <span
                    data-tab-dot
                    className="h-2 w-2 rounded-full bg-accent/40"
                  />
                  {project.title
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/&/g, 'and')}
                  .ts
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="chip">{project.role}</span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold">
                    {project.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-muted leading-relaxed">
                    {project.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {project.tech.map((tech) => (
                      <span key={tech} className="chip project-tech-chip">
                        {tech}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={project.link}
                    className="project-link-animate mt-4 inline-flex items-center gap-2 font-mono text-sm font-medium text-accent transition"
                  >
                    View project &#8599;
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ═══ Writing ═══ */}
        <section id="writing" className="space-y-10">
          <SectionHeading
            eyebrow="// writing"
            title="Changelog entries"
            description="Personal technical notes on product engineering, design systems, and AI workflow shipping."
          />
          <div className="space-y-4">
            {latestPosts.map((article) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group reveal-on-scroll writing-entry-hover flex items-baseline gap-4 border-b border-divider py-4 transition hover:border-accent/35"
              >
                <span className="font-mono text-sm text-muted whitespace-nowrap">
                  {article.formattedDate}
                </span>
                <span className="font-mono text-sm text-secondary whitespace-nowrap">
                  feat:
                </span>
                <span className="writing-link-sweep text-foreground group-hover:text-accent transition">
                  {article.title}
                </span>
              </Link>
            ))}
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition hover:opacity-75"
          >
            View all posts &rarr;
          </Link>
        </section>

        {/* ═══ Contact ═══ */}
        <section id="contact" className="space-y-8">
          <SectionHeading
            eyebrow="// contact"
            title="connect --via=email"
            description="Email for details, or schedule a call to jam on agentic AI, sports, and more."
          />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="reveal-on-scroll space-y-5 font-mono text-sm">
              <div>
                <p className="text-muted">$ connect --via=email</p>
                <Link
                  href="mailto:tylerxiao@ucla.edu"
                  className="contact-status-link mt-1 inline-flex items-center gap-2 text-lg font-semibold text-accent transition hover:opacity-75"
                >
                  <span className="contact-ping-dot" />
                  tylerxiao@ucla.edu
                </Link>
              </div>
              <div>
                <p className="text-muted">$ connect --via=call</p>
                <Link
                  href="/schedule-a-call"
                  className="contact-status-link mt-1 inline-flex items-center gap-2 text-base font-semibold text-accent transition hover:opacity-75"
                >
                  <span className="contact-ping-dot" />
                  Schedule a call &#8599;
                </Link>
              </div>
            </div>
            <div className="pane reveal-on-scroll p-6">
              <h3 className="font-mono text-xs uppercase tracking-widest text-muted">
                Elsewhere
              </h3>
              <div className="mt-4 flex flex-col gap-1 text-sm">
                {contactLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="contact-link-lift flex w-full items-center rounded-lg px-3 py-2.5 font-mono text-muted transition hover:bg-surface-raised hover:text-accent"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <ContactIcon label={link.label} />
                      </span>
                      <span>{link.label}</span>
                      <span>&#8599;</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-divider bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-7 py-12 sm:px-6">
          <div className="max-w-md">
            <UserCountTracker />
          </div>
        </div>
      </footer>
    </div>
  );
}
