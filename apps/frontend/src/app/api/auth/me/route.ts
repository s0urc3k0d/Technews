import { getSession } from '@auth0/nextjs-auth0';
import { isAdminUser } from '@/lib/admin-auth';

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
    const session = await getSession();

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
    }

    const user = session.user as {
      sub?: string;
      name?: string;
      nickname?: string;
      email?: string;
      picture?: string;
      permissions?: unknown;
      [key: string]: unknown;
    };

    return Response.json(
      {
        sub: user.sub ?? null,
        name: user.name ?? null,
        nickname: user.nickname ?? null,
        email: user.email ?? null,
        picture: user.picture ?? null,
        isAdmin: isAdminUser(user),
      },
      { headers: noStoreHeaders }
    );
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }
}
