import type { Metadata } from 'next';
import { Bench } from '@/components/concept/bench/Bench';

export const metadata: Metadata = {
  title: 'Concept D · Bench — Tyler Xiao',
  description:
    'A studio workbench where shipped products, active experiments, and design history become the interface.',
  robots: { index: false, follow: false },
};

export default function BenchPage() {
  return <Bench />;
}
