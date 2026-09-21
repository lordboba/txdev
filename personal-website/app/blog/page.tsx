import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPostMeta } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog | Tyler Xiao',
  description:
    'Personal technical blog on software, backend systems, and product engineering.',
};

export default async function BlogIndexPage() {
  const posts = await getAllPostMeta();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <p className="font-[var(--font-mono)] text-[11px] font-medium uppercase tracking-[0.24em] text-muted">
          Journal
        </p>
        <div>
          <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Blog
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Technical notes on software, backend systems, and product
            engineering.
          </p>
        </div>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-sm border border-dashed border-divider bg-surface px-5 py-10 text-center text-sm text-muted">
          No posts yet. Check back soon.
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post, index) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col gap-4 rounded-sm border border-divider bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:bg-accent-muted hover:shadow-[0_16px_34px_rgba(0,0,0,0.16)] sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-[var(--font-mono)] text-muted">
                <span>{post.formattedDate}</span>
                <span className="size-1.5 rounded-full bg-divider" />
                <span className="text-accent">{post.readTime}</span>
                <span className="ml-auto rounded-sm border border-divider px-2 py-1 text-[10px] text-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold leading-tight text-foreground">
                {post.title}
              </h2>
              <p className="text-sm leading-7 text-muted">{post.excerpt}</p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-sm border border-divider bg-accent-muted px-2 py-1 text-[11px] font-[var(--font-mono)] text-accent transition-colors duration-200 group-hover:border-accent"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
