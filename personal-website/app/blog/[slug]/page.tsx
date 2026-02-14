import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
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
    return {
      title: 'Post not found | Tyler Xiao',
    };
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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -left-28 top-20 h-[420px] w-[420px] rounded-full bg-accent/12 blur-[110px]" />
        <div className="absolute right-[-100px] top-64 h-[340px] w-[340px] rounded-full bg-secondary/14 blur-[90px]" />
      </div>

      <NavBar />

      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 pb-24 pt-16 sm:px-6 sm:pt-20">
        <Link
          href="/blog"
          className="w-fit font-mono text-sm text-muted transition hover:text-accent"
        >
          &larr; Back to all posts
        </Link>

        <header className="space-y-6 border-b border-divider pb-8">
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <span className="font-mono text-muted">{post.formattedDate}</span>
            <span className="h-1 w-1 rounded-full bg-divider" />
            <span className="font-mono text-secondary">{post.readTime}</span>
          </div>
          <h1 className="max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            {post.title}
          </h1>
          <p className="max-w-3xl text-base text-muted sm:text-lg">
            {post.excerpt}
          </p>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        </header>

        <article
          className="blog-prose max-w-none pb-8"
          dangerouslySetInnerHTML={{ __html: articleHtml }}
        />
      </main>
    </div>
  );
}
