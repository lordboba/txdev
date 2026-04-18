import { ThemeBar } from '@/components/ThemeBar';
import { NavBar } from '@/components/NavBar';

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <NavBar />
      <main className="flex-1">{children}</main>
      <ThemeBar />
    </div>
  );
}
