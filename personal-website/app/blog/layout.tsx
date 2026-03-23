import { ThemeBar } from '@/components/ThemeBar';

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="blog-shell">
      {children}
      <ThemeBar />
    </div>
  );
}
