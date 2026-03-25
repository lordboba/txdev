import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPostMeta } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog | Tyler Xiao',
  description:
    'Personal technical blog on AI agents, backend systems, and product engineering.',
};

export default async function BlogIndexPage() {
  const posts = await getAllPostMeta();

  return (
    <>
      <header className="blog-topbar">
        <Link href="/" className="blog-back-btn">
          &larr; Back to site
        </Link>
        <span className="blog-topbar-title">Blog</span>
      </header>

      <main className="blog-main">
        <div className="blog-hero">
          <h1 className="blog-hero-title">Blog</h1>
          <p className="blog-hero-desc">
            Technical notes on AI agents, backend systems, and product
            engineering.
          </p>
        </div>

        <div className="blog-list">
          {posts.length === 0 ? (
            <div className="blog-empty">
              <p>No posts yet. Check back soon.</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="blog-card"
              >
                <div className="blog-card-meta">
                  <span className="blog-card-date">{post.formattedDate}</span>
                  <span className="blog-card-dot" />
                  <span className="blog-card-read">{post.readTime}</span>
                  <span className="blog-card-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h2 className="blog-card-title">{post.title}</h2>
                <p className="blog-card-excerpt">{post.excerpt}</p>
                <div className="blog-card-tags">
                  {post.tags.map((tag) => (
                    <span key={tag} className="blog-card-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </>
  );
}
