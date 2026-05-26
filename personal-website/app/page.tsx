import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { HomeClient } from '@/components/home/HomeClient';
import { getVisitorCount, incrementVisitorCount } from '@/lib/userCount';

export const metadata: Metadata = {
  title: 'Tyler Xiao',
  description:
    'Tyler Xiao portfolio for AI systems, backend infrastructure, and product engineering.',
};

async function getInitialVisitorCount() {
  const requestHeaders = await headers();
  const isPrefetch =
    requestHeaders.get('purpose') === 'prefetch' ||
    requestHeaders.get('next-router-prefetch') === '1' ||
    requestHeaders.get('x-middleware-prefetch') === '1';

  return isPrefetch ? getVisitorCount() : incrementVisitorCount();
}

export default async function Home() {
  const visitorCount = await getInitialVisitorCount();

  return <HomeClient visitorCount={visitorCount} />;
}
