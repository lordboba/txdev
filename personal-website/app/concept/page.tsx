import type { Metadata } from 'next';
import { CompareBoard } from '@/components/concept/compare/CompareBoard';

export const metadata: Metadata = {
  title: 'Concept board — Tyler Xiao',
  description:
    'Four directions for a personal profile concept, shown side by side with identical content.',
  robots: { index: false, follow: false },
};

export default function ConceptPage() {
  return <CompareBoard />;
}
