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
          <div className="label-sm flex flex-wrap items-center gap-2 text-muted">
            <span>{post.formattedDate}</span>
            <span className="size-1.5 rounded-full bg-divider" />
            <span className="text-accent">{post.readTime}</span>
          </div>
          <h1 className="display display-2 text-foreground">{post.title}</h1>
          <p className="text-base leading-8 text-muted sm:text-lg">
            {post.excerpt}
          </p>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="label-sm rounded-sm border border-divider px-2.5 py-1 text-accent transition-colors duration-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        <div
          className="blog-prose mt-10"
          dangerouslySetInnerHTML={{ __html: articleHtml }}
        />
      </article>
    </div>
  );
}
