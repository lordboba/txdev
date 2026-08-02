import type { Metadata } from 'next';
import { Museum } from '@/components/concept/museum/Museum';

export const metadata: Metadata = {
  title: 'Concept F · Museum — Tyler Xiao',
  description:
    'A living museum of Tyler Xiao’s profile, work, experiments, and six real homepage eras.',
  robots: { index: false, follow: false },
};

export default function MuseumPage() {
  return <Museum />;
}
