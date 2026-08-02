import type { Metadata } from 'next';
import { BenchHome } from '@/components/home/BenchHome';
import { getInitialVisitorCount } from '@/lib/userCount';

export const metadata: Metadata = {
  title: 'Tyler Xiao',
  description:
    'Tyler Xiao’s studio bench: iCalarms, Personal Env, Med Negotiate, and Charades 2026, alongside work at Scale AI, SafetyKit, Ramp, and Snowflake.',
};

export default async function Home() {
  const visitorCount = await getInitialVisitorCount();

  return <BenchHome visitorCount={visitorCount} />;
}
