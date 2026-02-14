import type { Metadata } from 'next';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { getAllPostMeta } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog | Tyler Xiao',
  description:
    'Personal technical blog on AI agents, backend systems, and product engineering.',
};

export default async function BlogIndexPage() {
  const posts = await getAllPostMeta();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-28 top-16 h-80 w-80 rounded-full bg-accent/15 blur-[90px]" />
        <div className="absolute right-0 top-52 h-96 w-96 rounded-full bg-secondary/15 blur-[100px]" />
      </div>

      <NavBar />

      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 pb-24 pt-16 sm:px-6 sm:pt-20">
        <section className="space-y-5">
          <p className="eyebrow">blog/index.tsx</p>
          <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            My Blog
          </h1>
          <p className="max-w-3xl text-base text-muted sm:text-lg">
            This is where I unpack architecture decisions, UI experiments, and
            lessons from shipping agentic systems in the real world.
          </p>
        </section>

        <section className="grid gap-5">
          {posts.length === 0 ? (
            <div className="pane p-8">
              <p className="font-mono text-sm text-muted">
                No posts yet. Add your first Markdown file in `content/blog/`.
              </p>
            </div>
          ) : (
            posts.map((post, index) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group pane relative overflow-hidden p-6 sm:p-7"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'linear-gradient(110deg, var(--accent-muted), transparent 45%, var(--secondary-muted))',
                  }}
                />
                <div className="relative space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                    <span className="font-mono text-muted">
                      {post.formattedDate}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-divider" />
                    <span className="font-mono text-secondary">
                      {post.readTime}
                    </span>
                    <span className="ml-auto font-mono text-muted">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <h2 className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">
                    {post.title}
                  </h2>
                  <p className="max-w-3xl text-sm text-muted sm:text-base">
                    {post.excerpt}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
