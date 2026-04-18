import { headers } from 'next/headers';
import { HomeClient } from '@/components/home/HomeClient';
import { getVisitorCount, incrementVisitorCount } from '@/lib/userCount';

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
