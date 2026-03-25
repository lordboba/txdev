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
    <>
      <header className="blog-topbar">
        <Link href="/blog" className="blog-back-btn">
          &larr; All posts
        </Link>
        <Link href="/" className="blog-home-btn">
          Home
        </Link>
      </header>

      <main className="blog-main">
        <article className="blog-article">
          <header className="blog-article-header">
            <div className="blog-card-meta">
              <span className="blog-card-date">{post.formattedDate}</span>
              <span className="blog-card-dot" />
              <span className="blog-card-read">{post.readTime}</span>
            </div>
            <h1 className="blog-article-title">{post.title}</h1>
            <p className="blog-article-excerpt">{post.excerpt}</p>
            <div className="blog-card-tags">
              {post.tags.map((tag) => (
                <span key={tag} className="blog-card-tag">
                  {tag}
                </span>
              ))}
            </div>
          </header>

          <div
            className="blog-prose"
            dangerouslySetInnerHTML={{ __html: articleHtml }}
          />
        </article>
      </main>
    </>
  );
}
