import { getAccessToken } from '@auth0/nextjs-auth0';

export async function GET() {
  try {
    const { accessToken } = await getAccessToken();

    if (!accessToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return Response.json({ accessToken });
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
