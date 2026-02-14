import Image from 'next/image';
import Link from 'next/link';
import {
  contactLinks,
  experiences,
  projects,
  quickFacts,
} from '@/lib/siteData';
import { HomeTerminal } from '@/components/Terminal/HomeTerminal';
import { UserCountTracker } from '@/components/UserCountTracker';
import { NavBar } from '@/components/NavBar';
import { getRecentPostMeta } from '@/lib/blog';

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
    <div className="max-w-3xl space-y-3">
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <NavBar />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-5 py-12 sm:gap-24 sm:px-6 sm:py-20">
        {/* ═══ Hero ═══ */}
        <section className="flex flex-col items-start gap-10 sm:gap-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 sm:gap-16 max-w-3xl">
            <div className="flex flex-col gap-6">
              <div className="space-y-4">
                <p className="font-mono text-sm text-muted">
                  {"// hi, i'm tyler"}
                </p>
                <h1 className="font-display text-5xl font-bold tracking-tight sm:text-7xl">
                  I build <span className="text-accent">Agents</span> and
                  backend systems.
                </h1>
              </div>
              <p className="max-w-2xl text-lg text-muted leading-relaxed">
                CS student at UCLA. From trust &amp; safety automations to
                multiplayer card games, I like solving challenging problems,
                building efficient backend systems, and automating repetitive
                tasks.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="#contact"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-7 py-3 font-mono text-sm font-semibold text-background shadow-[0_2px_12px_rgba(232,196,104,0.2)] transition hover:shadow-[0_4px_20px_rgba(232,196,104,0.3)] hover:-translate-y-0.5"
                >
                  <span>&#9654;</span> Contact
                </Link>
                <Link
                  href="/past-experience"
                  className="inline-flex items-center justify-center rounded-lg border border-dashed border-divider px-7 py-3 font-mono text-sm font-semibold text-muted transition hover:border-accent hover:text-foreground"
                >
                  View Past Experience
                </Link>
              </div>
            </div>
            <Image
              src="/pfp.JPG"
              alt="Tyler Xiao"
              width={400}
              height={400}
              className="h-64 w-64 sm:h-80 sm:w-80 rounded-full object-cover border-2 border-divider shadow-sm flex-shrink-0"
              priority
            />
          </div>
          <div className="w-full">
            <HomeTerminal />
          </div>
        </section>

        {/* ═══ About ═══ */}
        <section
          id="about"
          className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          <div>
            <SectionHeading
              eyebrow="// about"
              title="About Me"
              description="UCLA student studying Computer Science — focused on building systems that work."
            />
          </div>
          <div className="pane overflow-hidden">
            <div className="border-b border-divider px-5 py-3">
              <span className="font-mono text-xs tracking-widest uppercase text-muted">
                status monitor
              </span>
            </div>
            <dl className="divide-y divide-divider">
              {quickFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <dt className="font-mono text-sm text-muted">{fact.label}</dt>
                  <dd className="font-mono text-sm text-secondary">
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
          <div className="relative space-y-10 pl-8">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-accent/30 shadow-[0_0_8px_rgba(232,196,104,0.15)]" />

            {experiences.map((exp, i) => (
              <article
                key={`${exp.company}-${exp.role}`}
                className="relative space-y-3"
              >
                {/* Timeline node */}
                <div className="absolute -left-8 top-1.5 h-[9px] w-[9px] rounded-full bg-accent shadow-[0_0_0_4px_var(--background),0_0_12px_rgba(232,196,104,0.2)]" />

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
                className="pane flex h-full flex-col overflow-hidden transition hover:scale-[1.01]"
              >
                {/* Tab bar */}
                <div className="flex items-center gap-2 border-b border-divider px-5 py-3 font-mono text-sm text-accent">
                  <span className="h-2 w-2 rounded-full bg-accent/40" />
                  {project.title
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/&/g, 'and')}
                  .ts
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="chip">{project.role}</span>
                    {project.focus.map((f) => (
                      <span key={f} className="chip-secondary chip">
                        {f}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-3 font-display text-xl font-semibold">
                    {project.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-muted leading-relaxed">
                    {project.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {project.tech.map((tech) => (
                      <span key={tech} className="chip">
                        {tech}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={project.link}
                    className="mt-4 inline-flex items-center gap-2 font-mono text-sm font-medium text-accent transition hover:opacity-75"
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
                className="group flex items-baseline gap-4 border-b border-divider py-4 transition hover:border-accent/35"
              >
                <span className="font-mono text-sm text-muted whitespace-nowrap">
                  {article.formattedDate}
                </span>
                <span className="font-mono text-sm text-secondary whitespace-nowrap">
                  feat:
                </span>
                <span className="text-foreground group-hover:text-accent transition">
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
            <div className="space-y-5 font-mono text-sm">
              <div>
                <p className="text-muted">$ connect --via=email</p>
                <Link
                  href="mailto:tylerxiao@ucla.edu"
                  className="mt-1 inline-flex text-lg font-semibold text-accent transition hover:opacity-75"
                >
                  tylerxiao@ucla.edu
                </Link>
              </div>
              <div>
                <p className="text-muted">$ connect --via=call</p>
                <Link
                  href="/schedule-a-call"
                  className="mt-1 inline-flex items-center gap-2 text-base font-semibold text-accent transition hover:opacity-75"
                >
                  Schedule a call &#8599;
                </Link>
              </div>
            </div>
            <div className="pane p-6">
              <h3 className="font-mono text-xs uppercase tracking-widest text-muted">
                Elsewhere
              </h3>
              <div className="mt-4 space-y-1 text-sm">
                {contactLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 font-mono text-muted transition hover:bg-surface-raised hover:text-accent"
                  >
                    <span>{link.label}</span>
                    <span>&#8599;</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-divider bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-12 sm:px-6">
          <div className="max-w-md">
            <UserCountTracker />
          </div>
        </div>
      </footer>
    </div>
  );
}
