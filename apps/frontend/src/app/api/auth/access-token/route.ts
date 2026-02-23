import { getAccessToken } from '@auth0/nextjs-auth0';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0',
  Pragma: 'no-cache',
  Expires: '0',
  Vary: 'Cookie, Authorization',
};

export async function GET() {
  try {
    const { accessToken } = await getAccessToken();

    if (!accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
    }

    return Response.json({ accessToken }, { headers: noStoreHeaders });
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }
}
