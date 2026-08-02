import type { Metadata } from 'next';
import { Observatory } from '@/components/concept/observatory/Observatory';

export const metadata: Metadata = {
  title: 'Concept A · Observatory — Tyler Xiao',
  description:
    'A profile concept built as a measuring instrument, with a six-ring armature that reconfigures per view.',
  robots: { index: false, follow: false },
};

export default function ObservatoryPage() {
  return <Observatory />;
}
