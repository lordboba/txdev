import type { Metadata } from 'next';
import { Press } from '@/components/concept/press/Press';

export const metadata: Metadata = {
  title: 'Concept C · Press — Tyler Xiao',
  description:
    'A profile concept using print logic: hard grid, cropped type, one accent, and a flat orthographic solid.',
  robots: { index: false, follow: false },
};

export default function PressPage() {
  return <Press />;
}
