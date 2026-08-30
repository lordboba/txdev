import type { Metadata } from 'next';
import { CompareBoard } from '@/components/concept/compare/CompareBoard';

export const metadata: Metadata = {
  title: 'Concept board — Tyler Xiao',
  description: 'Competing concepts when drafting website',
  robots: { index: false, follow: false },
};

export default function ConceptPage() {
  return <CompareBoard />;
}
