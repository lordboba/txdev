import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Tyler Xiao's Portfolio",
  description:
    "Personal portfolio for Tyler Xiao — UCLA CS '27 focused on agentic AI, backend systems, and trust & safety automation.",
  openGraph: {
    title: "Tyler Xiao's Portfolio",
    description:
      "Explore Tyler Xiao's experience, projects, and ways to collaborate on AI agents and backend systems.",
    siteName: 'Tyler Xiao',
    images: [
      {
        url: '/lordboba.png',
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
      "Explore Tyler Xiao's experience, projects, and ways to collaborate on AI agents and backend systems.",
    images: ['/lordboba.png'],
  },
  icons: {
    icon: [
      { rel: 'icon', url: '/icon.png' },
      { rel: 'apple-touch-icon', url: '/icon.png' },
      { rel: 'shortcut icon', url: '/icon.png' },
    ],
  },
};

/* Inline script to set theme before first paint — prevents flash */
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
