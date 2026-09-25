import type { Metadata } from 'next';
import Script from 'next/script';
import {
  Cormorant_Garamond,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
} from 'next/font/google';
import './globals.css';
import { FestivalMount } from '@/components/festival/FestivalMount';
import { getAllPostMeta } from '@/lib/blog';
import { isFestivalEnabledOnServer } from '@/lib/festival';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tylerx.dev',
  ),
  title: "Tyler Xiao's Portfolio",
  description:
    'Personal portfolio for Tyler Xiao, a UCLA computer science student building products, backend systems, and developer tools.',
  openGraph: {
    title: "Tyler Xiao's Portfolio",
    description:
      "Explore Tyler Xiao's experience, projects, writing, and contact information.",
    siteName: 'Tyler Xiao',
    images: [
      {
        url: 'https://tylerx.dev/lordboba.png',
        width: 1200,
        height: 1200,
        alt: 'Tyler Xiao avatar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Tyler Xiao's Portfolio",
    description:
      "Explore Tyler Xiao's experience, projects, writing, and contact information.",
    images: ['https://tylerx.dev/lordboba.png'],
  },
  icons: {
    icon: [
      { rel: 'icon', url: '/icon.png' },
      { rel: 'apple-touch-icon', url: '/icon.png' },
      { rel: 'shortcut icon', url: '/icon.png' },
    ],
  },
};

/*
 * Inline script to set the theme before first paint — prevents flash.
 *
 * data-color-theme is always written, never only when localStorage has a
 * value. The palette lives in [data-theme][data-color-theme] pairs, so a
 * missing attribute fell through to the bare :root block, which holds the
 * DARK tokens: a visitor in light mode who had never opened the colour
 * picker got --c-accent #ffffff, i.e. a white modal title on white and
 * invisible card frames. 'mono' matches DEFAULT_COLOR_THEME in
 * components/runtime/themePreferences.ts; the list is repeated here because
 * this string has to run before any module loads.
 */
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
    var ct = localStorage.getItem('color-theme');
    var known = ct === 'mono' || ct === 'ember' || ct === 'ice' || ct === 'terminal';
    document.documentElement.setAttribute('data-color-theme', known ? ct : 'mono');
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-color-theme', 'mono');
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const festivalOn = isFestivalEnabledOnServer();
  const festivalPosts = festivalOn ? await getAllPostMeta() : [];

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="bg-background text-foreground">
        {process.env.NODE_ENV === 'development' && (
          <>
            <Script
              src="//unpkg.com/react-grab/dist/index.global.js"
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
            <Script
              src="//unpkg.com/@react-grab/mcp/dist/client.global.js"
              strategy="lazyOnload"
            />
          </>
        )}
        <div className="grain-overlay" aria-hidden="true" />
        {children}
        {festivalOn && <FestivalMount posts={festivalPosts} />}
      </body>
    </html>
  );
}
