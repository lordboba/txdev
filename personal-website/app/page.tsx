import Link from "next/link";
import Image from "next/image";
import {
  contactLinks,
  experiences,
  projects,
  quickFacts,
  writings,
} from "@/lib/siteData";

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Experience", href: "#experience" },
  { label: "Projects", href: "#projects" },
  { label: "Writing", href: "#writing" },
  { label: "Past Experience", href: "/past-experience" },
  { label: "Schedule a Call", href: "/schedule-a-call" },
];

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
    <div className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 font-[family:var(--font-sans),_Inter] text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base text-muted">{description}</p>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 blur-3xl">
        <div className="absolute -right-10 top-32 h-64 w-64 rounded-full bg-primary/30"></div>
        <div className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-secondary/20"></div>
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-20 pt-10 sm:px-8 lg:px-12">
        <header className="sticky top-4 z-20">
          <nav className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-surface/70 px-5 py-4 text-sm text-muted shadow-[var(--shadow-card)] backdrop-blur">
            <div className="mr-4 font-[family:var(--font-sans),_Inter] text-xs tracking-[0.5em] text-foreground">
              TYLER XIAO
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-3 text-xs sm:text-[0.82rem]">
              {navLinks.map((link) =>
                link.href.startsWith("#") ? (
                  <a
                    key={link.label}
                    href={link.href}
                    className="rounded-full px-3 py-1 text-muted transition hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="rounded-full px-3 py-1 text-muted transition hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          </nav>
        </header>

        <main className="mt-16 space-y-24">
          <section className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <p className="eyebrow">Product + Systems Engineer</p>
              <h1 className="mt-6 font-[family:var(--font-sans),_Inter] text-4xl font-medium leading-tight tracking-tight sm:text-6xl">
                Crafting calm, resilient tools for ambitious teams.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted">
                I help companies ship thoughtful developer and operations
                experiences—from zero to one platform strategy, to design
                systems that stay out of the way, to AI-assisted workflows that
                people actually trust.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="#contact"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 font-medium text-background shadow-[0_20px_60px_rgba(124,92,252,0.35)] transition hover:opacity-90"
                >
                  Contact
                </Link>
                <Link
                  href="/past-experience"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 font-medium text-foreground transition hover:border-white/40"
                >
                  View Past Experience
                </Link>
              </div>
              
            </div>
            <div className="mt-8">
                <div className="h-[300px] w-[300px] overflow-hidden rounded-full">
                  <Image src="/pfp.jpeg" alt="Tyler Xiao" width={300} height={300} className="h-full w-full object-cover" />
                </div>
              </div>
          </section>
          
          <section id="about" className="grid gap-10 lg:grid-cols-2">
            <SectionHeading
              eyebrow="About Snapshot"
              title="Systems thinking, product taste, and a bias for shipping."
              description="Blending engineering rigor with design craft. I value crisp communication, rapid iteration, and building trust with the teams I support."
            />
            <div className="rounded-3xl border border-white/10 bg-surface/70 p-8 shadow-[var(--shadow-card)]">
              <div className="grid gap-6">
                {quickFacts.map((fact) => (
                  <div key={fact.label}>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">
                      {fact.label}
                    </p>
                    <p className="mt-2 text-lg font-medium">{fact.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="experience" className="space-y-10">
            <SectionHeading
              eyebrow="Experience"
              title="Building resilient tools for high-velocity teams."
              description="Highlights from the last decade of product engineering and design leadership."
            />
            <div className="relative border-l border-white/10 pl-8">
              <span className="absolute -left-3 top-0 block h-6 w-6 rounded-full border-2 border-secondary bg-background"></span>
              <div className="space-y-10">
                {experiences.map((exp) => (
                  <article
                    key={`${exp.company}-${exp.role}`}
                    className="rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                      <span>
                        {exp.start} — {exp.end}
                      </span>
                      <span className="text-primary">•</span>
                      <span>{exp.focus.join(" · ")}</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold">
                      {exp.role} · {exp.company}
                    </h3>
                    <p className="mt-3 text-base text-muted">{exp.summary}</p>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <Link
                href="/past-experience"
                className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
              >
                View the full timeline →
              </Link>
            </div>
          </section>

          <section id="projects" className="space-y-10">
            <SectionHeading
              eyebrow="Selected Projects"
              title="Proof that thoughtful systems scale."
              description="A few recent bets, spanning internal tooling, design systems, and AI-enabled workflows."
            />
            <div className="grid gap-6 md:grid-cols-2">
              {projects.map((project) => (
                <article
                  key={project.title}
                  className="flex h-full flex-col rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">{project.title}</h3>
                    <span className="text-xs uppercase tracking-[0.3em] text-muted">
                      {project.role}
                    </span>
                  </div>
                  <p className="mt-3 flex-1 text-sm text-muted">
                    {project.description}
                  </p>
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
                  <Link
                    href={project.link}
                    className="mt-6 inline-flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
                  >
                    View project ↗
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section id="writing" className="space-y-10">
            <SectionHeading
              eyebrow="Writing & Speaking"
              title="Sharing what I learn along the way."
              description="Recent essays and talks on product engineering craft."
            />
            <div className="space-y-6">
              {writings.map((article) => (
                <Link
                  key={article.title}
                  href={article.link}
                  className="block rounded-3xl border border-white/10 bg-surface/70 p-6 shadow-[var(--shadow-card)] transition hover:border-white/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">{article.title}</h3>
                    <span className="text-xs uppercase tracking-[0.3em] text-muted">
                      {article.date}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted">{article.summary}</p>
                </Link>
              ))}
            </div>
          </section>

          <section id="contact" className="space-y-8">
            <SectionHeading
              eyebrow="Contact"
              title="Ready when you are."
              description="Advisory, design partnerships, or building something new. I keep the process lightweight and outcomes direct."
            />
            <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-3xl border border-white/10 bg-surface/70 p-8 shadow-[var(--shadow-card)]">
                <p className="text-lg text-muted">
                  Start with an intro email or jump straight into a 15-minute
                  call. I’ll reply within two days with a next step or helpful
                  referral.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href="mailto:hello@tylerxiao.com"
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary px-6 py-3 font-medium text-background shadow-[0_20px_60px_rgba(124,92,252,0.35)] transition hover:opacity-90"
                  >
                    Email Tyler
                  </Link>
                  <Link
                    href="/schedule-a-call"
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 font-medium text-foreground transition hover:border-white/40"
                  >
                    Schedule a Call
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-surface/50 p-6 shadow-[var(--shadow-card)]">
                <h3 className="text-sm uppercase tracking-[0.3em] text-muted">
                  Elsewhere
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  {contactLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="flex items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-muted transition hover:border-white/20 hover:text-foreground"
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
      </div>
    </div>
  );
}
