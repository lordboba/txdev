import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllPostMeta,
  getPostBySlug,
  renderMarkdownToHtml,
} from '@/lib/blog';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const posts = await getAllPostMeta();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    return { title: 'Post not found | Tyler Xiao' };
  }
  return {
    title: `${post.title} | Tyler Xiao`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const articleHtml = renderMarkdownToHtml(post.content);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-sm border border-divider bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:border-accent hover:text-foreground"
        >
          <span aria-hidden>&larr;</span>
          All posts
        </Link>
        <span className="text-muted" aria-hidden>
          /
        </span>
        <Link
          href="/"
          className="inline-flex items-center rounded-sm border border-transparent px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:text-foreground"
        >
          Home
        </Link>
      </div>

      <article className="rounded-sm border border-divider bg-surface p-5 sm:p-8">
        <header className="space-y-5 border-b border-divider pb-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-[var(--font-mono)] text-muted">
            <span>{post.formattedDate}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-divider" />
            <span className="text-accent">{post.readTime}</span>
          </div>
          <h1 className="font-[var(--font-display)] text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            {post.title}
          </h1>
          <p className="text-base leading-8 text-muted sm:text-lg">
            {post.excerpt}
          </p>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-divider px-2.5 py-1 text-[11px] font-[var(--font-mono)] text-accent transition-colors duration-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        <div
          className="blog-prose mt-10
          [&_h1]:font-[var(--font-display)]
          [&_h2]:font-[var(--font-display)]
          [&_h3]:font-[var(--font-display)]
          [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground
          [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold
          [&_p]:text-[1rem] [&_p]:leading-8 [&_p]:text-muted
          [&_a]:font-medium [&_a]:text-accent hover:[&_a]:underline [&_a]:underline-offset-4
          [&_blockquote]:rounded-sm [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:text-muted
          [&_code]:rounded-sm [&_code]:border [&_code]:border-divider [&_code]:bg-surface-raised [&_code]:px-1.5 [&_code]:py-0.5
          [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-divider [&_pre]:bg-surface-raised [&_pre]:p-4"
          dangerouslySetInnerHTML={{ __html: articleHtml }}
        />
      </article>
    </div>
  );
}
