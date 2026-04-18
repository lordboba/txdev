import { getVisitorCount, incrementVisitorCount } from '@/lib/userCount';

export async function POST() {
  const result = await incrementVisitorCount();
  if (result === null) {
    return Response.json(
      { error: 'Unable to increment count', count: null },
      { status: 503 },
    );
  }

  return Response.json({ count: result });
}

export async function GET() {
  const result = await getVisitorCount();
  if (result === null) {
    return Response.json(
      { error: 'Unable to get count', count: null },
      { status: 503 },
    );
  }
  return Response.json({ count: result });
}
