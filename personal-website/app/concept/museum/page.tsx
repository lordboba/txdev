import type { Metadata } from 'next';
import { Museum } from '@/components/concept/museum/Museum';

export const metadata: Metadata = {
  title: 'Concept F · Museum — Tyler Xiao',
  description:
    'A living museum of my profile, work, experiments, and homepage history.',
  robots: { index: false, follow: false },
};

export default function MuseumPage() {
  return <Museum />;
}
