import assert from 'node:assert/strict';
import test from 'node:test';

async function loadBlog() {
  try {
    return await import('./blog.ts');
  } catch (error) {
    assert.fail(
      `lib/blog.ts must be importable under Node's type stripping: ${error.message}`,
    );
  }
}

test('markdown headings are demoted one level so the post title is the only h1', async () => {
  const { renderMarkdownToHtml } = await loadBlog();
  const html = renderMarkdownToHtml(
    ['# Section', 'Body.', '## Sub', '### Deeper'].join('\n'),
  );

  assert.doesNotMatch(html, /<h1[\s>]/);
  assert.match(html, /^<h2>Section<\/h2>/);
  assert.match(html, /<h3>Sub<\/h3>/);
  assert.match(html, /<h4>Deeper<\/h4>/);
});

test('prose gets curly quotes, dashes and an ellipsis', async () => {
  const { renderMarkdownToHtml } = await loadBlog();
  const html = renderMarkdownToHtml(
    `I'm here -- "quoted" (June - December)... 'single' 15-minute`,
  );

  assert.equal(
    html,
    '<p>I’m here — “quoted” (June – December)… ‘single’ 15-minute</p>',
  );
});

test('code spans, fenced blocks and link attributes keep straight punctuation', async () => {
  const { renderMarkdownToHtml } = await loadBlog();
  const html = renderMarkdownToHtml(
    [
      "Run `a -- b` and [it's docs](https://example.com/a--b?q='x') now.",
      '```',
      'const s = \'straight\' -- "here"...',
      '```',
    ].join('\n'),
  );

  assert.match(html, /<code>a -- b<\/code>/);
  assert.match(html, /href="https:\/\/example\.com\/a--b\?q=&#39;x&#39;"/);
  assert.match(html, /it’s docs<\/a>/);
  assert.match(
    html,
    /<pre><code>const s = &#39;straight&#39; -- &quot;here&quot;\.\.\.<\/code><\/pre>/,
  );
});
