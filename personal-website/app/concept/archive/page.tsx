import type { Metadata } from 'next';
import { Archive } from '@/components/concept/archive/Archive';

export const metadata: Metadata = {
  title: 'Concept B · Archive — Tyler Xiao',
  description:
    'A profile concept where a rotatable monolith is the navigation and content docks beside the face you turn toward.',
  robots: { index: false, follow: false },
};

export default function ArchivePage() {
  return <Archive />;
}
