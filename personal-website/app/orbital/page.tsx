import type { Metadata } from 'next';
import { HomeClient } from '@/components/home/HomeClient';
import { getInitialVisitorCount } from '@/lib/userCount';

export const metadata: Metadata = {
  title: 'Orbital - Tyler Xiao',
  description: 'Orbital view',
};

export default async function OrbitalPage() {
  const visitorCount = await getInitialVisitorCount();

  return <HomeClient visitorCount={visitorCount} />;
}
