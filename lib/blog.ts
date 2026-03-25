import { promises as fs } from 'node:fs';
import path from 'node:path';

export type BlogPostMeta = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  formattedDate: string;
  tags: string[];
  readTime: string;
};

export type BlogPost = BlogPostMeta & {
  content: string;
};

const BLOG_DIRECTORY = path.join(process.cwd(), 'content', 'blog');
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

function formatPublishedDate(dateText: string): string {
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return dateText;
  return DATE_FORMATTER.format(parsed);
}

function parseTags(rawTags?: string): string[] {
  if (!rawTags) return [];
  const normalized = rawTags.trim();

  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized
      .slice(1, -1)
      .split(',')
      .map((tag) => tag.replace(/['"]/g, '').trim())
      .filter(Boolean);
  }

  return normalized
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function splitFrontmatter(rawContent: string): {
  metadata: Record<string, string>;
  content: string;
} {
  const trimmed = rawContent.trimStart();
  if (!trimmed.startsWith('---')) {
    return { metadata: {}, content: rawContent.trim() };
  }

  const endIndex = trimmed.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { metadata: {}, content: rawContent.trim() };
  }

  const rawMetadata = trimmed
    .slice(3, endIndex)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const metadataEntries = rawMetadata.map((line) => {
    const separator = line.indexOf(':');
    if (separator === -1) return [line, ''] as const;
    return [
      line.slice(0, separator).trim(),
      line.slice(separator + 1).trim(),
    ] as const;
  });

  const metadata = Object.fromEntries(metadataEntries);
  const content = trimmed.slice(endIndex + 4).trim();
  return { metadata, content };
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeHref(href: string): string {
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('/')
  ) {
    return href;
  }
  return '#';
}

function sanitizeImageSrc(src: string): string {
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('/')
  ) {
    return src;
  }
  return '';
}

function parseImageWidth(raw?: string): number | null {
  if (!raw) return null;
  const match = /(?:^|\s)(?:w|width)\s*=\s*(\d{2,4})(?:\s|$)/i.exec(raw);
  if (!match) return null;

  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed)) return null;

  // Keep widths in a reasonable range for responsive layout.
  return Math.min(1200, Math.max(120, parsed));
}

function renderInlineMarkdown(raw: string): string {
  let html = escapeHtml(raw);

  html = html.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+(?:"([^"]+)"|'([^']+)'|&quot;([^&]+)&quot;|&#39;([^&]+)&#39;))?\)/g,
    (
      _,
      altText: string,
      src: string,
      imageTitle?: string,
      singleQuotedTitle?: string,
      escapedTitle?: string,
      escapedSingleQuotedTitle?: string,
    ) => {
      const safeSrc = sanitizeImageSrc(src);
      if (!safeSrc) {
        return altText;
      }
      const width = parseImageWidth(
        imageTitle ??
          singleQuotedTitle ??
          escapedTitle ??
          escapedSingleQuotedTitle,
      );
      const widthStyle = width ? ` style="max-width:${width}px"` : '';

      return `<img src="${safeSrc}" alt="${altText}" loading="lazy" decoding="async"${widthStyle} />`;
    },
  );

  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label: string, href: string) => {
      const safeHref = sanitizeHref(href);
      const targetAttr =
        safeHref.startsWith('http://') || safeHref.startsWith('https://')
          ? ' target="_blank" rel="noreferrer noopener"'
          : '';
      return `<a href="${safeHref}"${targetAttr}>${label}</a>`;
    },
  );
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  return html;
}

export function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const html: string[] = [];

  let paragraph: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let isInCodeBlock = false;
  let codeLanguage = '';
  let codeLines: string[] = [];

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  const closeCodeBlock = () => {
    if (!isInCodeBlock) return;
    const languageClass = codeLanguage
      ? ` class="language-${codeLanguage}"`
      : '';
    const content = escapeHtml(codeLines.join('\n'));
    html.push(`<pre><code${languageClass}>${content}</code></pre>`);
    isInCodeBlock = false;
    codeLanguage = '';
    codeLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = /^(#{1,3})\s+(.+)/.exec(trimmed);
    const unorderedListMatch = /^[-*]\s+(.+)/.exec(trimmed);
    const orderedListMatch = /^\d+\.\s+(.+)/.exec(trimmed);
    const quoteMatch = /^>\s+(.+)/.exec(trimmed);
    const fenceMatch = /^```(\w+)?$/.exec(trimmed);

    if (fenceMatch) {
      closeParagraph();
      closeList();

      if (isInCodeBlock) {
        closeCodeBlock();
      } else {
        isInCodeBlock = true;
        codeLanguage = fenceMatch[1] ?? '';
      }
      continue;
    }

    if (isInCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      closeParagraph();
      closeList();
      continue;
    }

    if (headingMatch) {
      closeParagraph();
      closeList();
      const headingLevel = headingMatch[1].length;
      html.push(
        `<h${headingLevel}>${renderInlineMarkdown(headingMatch[2])}</h${headingLevel}>`,
      );
      continue;
    }

    if (quoteMatch) {
      closeParagraph();
      closeList();
      html.push(
        `<blockquote>${renderInlineMarkdown(quoteMatch[1])}</blockquote>`,
      );
      continue;
    }

    if (unorderedListMatch || orderedListMatch) {
      closeParagraph();
      const nextListType = unorderedListMatch ? 'ul' : 'ol';
      const listItem = unorderedListMatch?.[1] ?? orderedListMatch?.[1] ?? '';

      if (listType !== nextListType) {
        closeList();
        html.push(`<${nextListType}>`);
        listType = nextListType;
      }

      html.push(`<li>${renderInlineMarkdown(listItem)}</li>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  closeParagraph();
  closeList();
  closeCodeBlock();

  return html.join('\n');
}

function estimateReadTime(content: string): string {
  const words = content.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(2, Math.ceil(words / 230));
  return `${minutes} min read`;
}

async function readBlogFile(fileName: string): Promise<BlogPost | null> {
  const slug = fileName.replace(/\.md$/, '');
  const filePath = path.join(BLOG_DIRECTORY, fileName);
  const raw = await fs.readFile(filePath, 'utf-8');

  const { metadata, content } = splitFrontmatter(raw);
  if (!content) return null;

  const title = metadata.title?.trim() || slug.replaceAll('-', ' ');
  const publishedAt = metadata.date?.trim() || new Date().toISOString();
  const excerpt =
    metadata.excerpt?.trim() ||
    content
      .split('\n')
      .find((line) => line.trim().length > 0)
      ?.trim() ||
    'New post.';

  const tags = parseTags(metadata.tags);
  const readTime = metadata.readTime?.trim() || estimateReadTime(content);

  return {
    slug,
    title,
    excerpt,
    publishedAt,
    formattedDate: formatPublishedDate(publishedAt),
    tags,
    readTime,
    content,
  };
}

export async function getAllPosts(): Promise<BlogPost[]> {
  let files: string[] = [];

  try {
    files = await fs.readdir(BLOG_DIRECTORY);
  } catch (error: unknown) {
    const isMissingDirectory =
      error instanceof Error && 'code' in error && error.code === 'ENOENT';
    if (isMissingDirectory) return [];
    throw error;
  }

  const markdownFiles = files.filter((file) => file.endsWith('.md'));
  const posts = await Promise.all(
    markdownFiles.map((file) => readBlogFile(file)),
  );

  return posts
    .filter((post): post is BlogPost => post !== null)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
}

export async function getAllPostMeta(): Promise<BlogPostMeta[]> {
  const posts = await getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    formattedDate: post.formattedDate,
    tags: post.tags,
    readTime: post.readTime,
  }));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const posts = await getAllPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}

export async function getRecentPostMeta(limit = 3): Promise<BlogPostMeta[]> {
  const posts = await getAllPostMeta();
  return posts.slice(0, limit);
}
