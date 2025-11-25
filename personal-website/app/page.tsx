import Image from 'next/image';
import Link from 'next/link';
import {
  contactLinks,
  experiences,
  projects,
  quickFacts,
  writings,
} from '@/lib/siteData';
import { HomeTerminal } from '@/components/Terminal/HomeTerminal';
import { UserCountTracker } from '@/components/UserCountTracker';
import { NavBar } from '@/components/NavBar';

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
      <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="text-base text-muted">{description}</p>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <NavBar />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-20 px-5 py-16 sm:px-6">
        <section className="flex flex-col items-start gap-12 sm:gap-16">
          <div className="flex flex-col items-start space-y-8 max-w-3xl">
            <Image
              src="/pfp.jpeg"
              alt="Tyler Xiao"
              width={100}
              height={100}
              className="h-24 w-24 rounded-full object-cover border-2 border-divider shadow-sm"
              priority
            />
            <div className="space-y-4">
              <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
                Hi, I&rsquo;m Tyler.
              </h1>
              <h2 className="text-2xl font-medium text-muted sm:text-3xl leading-snug">
                I build Agents and backend systems.
              </h2>
            </div>
            <p className="max-w-2xl text-lg text-muted leading-relaxed">
              I&rsquo;m a CS student at UCLA. From trust &amp; safety
              automations to multiplayer card games, I like solving challenging
              problems, building efficient backend systems, and automating
              repetitive tasks.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="#contact"
                className="inline-flex items-center justify-center rounded-full bg-secondary px-7 py-3 text-sm font-semibold text-white transition hover:bg-secondary/90"
              >
                Contact
              </Link>
              <Link
                href="/past-experience"
                className="inline-flex items-center justify-center rounded-full border border-divider px-7 py-3 text-sm font-semibold text-foreground transition hover:border-foreground"
              >
                View Past Experience
              </Link>
            </div>
          </div>
          <div className="w-full">
            <HomeTerminal />
          </div>
        </section>

        <section
          id="about"
          className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          <SectionHeading
            eyebrow="About"
            title="About Me"
            description="UCLA student studying Computer Science + building random stuff :)"
          />
          <div className="pane p-6">
            <dl className="grid gap-6">
              {quickFacts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs uppercase tracking-[0.2em] text-muted">
                    {fact.label}
                  </dt>
                  <dd className="mt-2 text-base font-semibold">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="experience" className="space-y-10">
          <SectionHeading
            eyebrow="Experience"
            title="git log --timeline"
            description="Recent roles across AI workflows, evaluations, and student leadership."
          />
          <div className="space-y-6 border-l border-divider pl-6">
            {experiences.map((exp) => (
              <article key={`${exp.company}-${exp.role}`} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-muted">
                  <span className="block h-3 w-3 -translate-x-[29px] rounded-full border border-foreground bg-background"></span>
                  <span>
                    {exp.start} — {exp.end}
                  </span>
                  <span>/</span>
                  <span>{exp.focus.join(', ')}</span>
                </div>
                <div className="pane p-5">
                  <h3 className="text-xl font-semibold">
                    {exp.role} · {exp.company}
                  </h3>
                  <p className="mt-2 text-sm text-muted">{exp.summary}</p>
                </div>
              </article>
            ))}
          </div>
          <Link
            href="/past-experience"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-foreground"
          >
            View the full timeline →
          </Link>
        </section>

        <section id="projects" className="space-y-10">
          <SectionHeading
            eyebrow="Projects"
            title="Selected builds"
            description="List of projects I'm excited about."
          />
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.title}
                className="pane flex h-full flex-col p-5"
              >
                <div className="flex items-center justify-between text-xs font-mono text-muted">
                  <span>{project.role}</span>
                  <span>{project.focus.join(' / ')}</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold">{project.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted">
                  {project.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {project.tech.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full border border-divider px-3 py-1 text-muted"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <Link
                  href={project.link}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                >
                  View project ↗
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="writing" className="space-y-10">
          <SectionHeading
            eyebrow="Writing"
            title="Changelog entries"
            description="Personal/technical blog posts. Coming soon!"
          />
          <div className="space-y-4">
            {writings.map((article) => (
              <Link
                key={article.title}
                href={article.link}
                className="pane block p-5 transition hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted">
                  <span>{article.date}</span>
                  <span>feat</span>
                </div>
                <p className="mt-2 text-lg font-semibold">{article.title}</p>
                <p className="mt-1 text-sm text-muted">{article.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="contact" className="space-y-8">
          <SectionHeading
            eyebrow="Contact"
            title="connect --via=email"
            description="Email for details, or schedule a call to jam on agentic AI, sports, and more."
          />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="pane p-6 font-mono text-sm">
              <p className="text-muted">$ connect --via=email</p>
              <Link
                href="mailto:tylerxiao@ucla.edu"
                className="mt-1 inline-flex text-lg font-semibold text-primary transition hover:text-primary/80"
              >
                tylerxiao@ucla.edu
              </Link>
              <p className="mt-5 text-muted">$ connect --via=call</p>
              <Link
                href="/schedule-a-call"
                className="mt-1 inline-flex items-center gap-2 text-base font-semibold text-primary"
              >
                Schedule a call ↗
              </Link>
            </div>
            <div className="pane p-6">
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted">
                Elsewhere
              </h3>
              <div className="mt-4 space-y-3 text-sm">
                {contactLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 text-muted transition hover:border-divider hover:text-foreground"
                  >
                    <span>{link.label}</span>
                    <span>↗</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
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
