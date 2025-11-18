import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tyler Xiao — SoftwareEngineer",
  description:
    "Personal website for Tyler Xiao, showcasing product engineering work, selected projects, and ways to collaborate.",
  openGraph: {
    title: "Tyler Xiao — Software Engineer",
    description:
      "Crafting developer tools and thoughtful product experiences. Explore work history, projects, and get in touch.",
    siteName: "Tyler Xiao",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tyler Xiao — Software Engineer",
    description:
      "Crafting developer tools and thoughtful product experiences. Explore work history, projects, and get in touch.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">{children}</body>
    </html>
  );
}
