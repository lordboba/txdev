import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Tyler Xiao's Portfolio",
  description:
    "Personal portfolio for Tyler Xiao — UCLA CSE '27 focused on agentic AI, backend systems, and trust & safety automation.",
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
    icon: '/lordboba.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
