import { getAccessToken } from '@auth0/nextjs-auth0';

const resolveUpstream = () => {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.BACKEND_INTERNAL_URL ||
    process.env.SERVICE_URL_BACKEND ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://backend:3001'
  );
};

export async function GET() {
  try {
    const { accessToken } = await getAccessToken();

    if (!accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const upstream = resolveUpstream().replace(/\/$/, '');
    const response = await fetch(`${upstream}/api/v1/shorts/thumbnail`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => '');
      return new Response(payload || 'Unable to fetch shorts thumbnail', { status: response.status });
    }

    const headers = new Headers();
    const contentType = response.headers.get('content-type') || 'image/png';
    const contentLength = response.headers.get('content-length');

    headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);

    return new Response(response.body, { status: 200, headers });
  } catch {
    return Response.json({ error: 'Unable to stream shorts thumbnail' }, { status: 500 });
  }
}