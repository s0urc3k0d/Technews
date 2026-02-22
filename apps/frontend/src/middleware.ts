import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge';
import { NextRequest, NextResponse } from 'next/server';

const requireAdminAuth = withMiddlewareAuthRequired();

const ATTACK_PATTERNS: RegExp[] = [
  /cHMgYXV4/i,
  /base64\s*-d/i,
  /\/tmp\/\.xin-unix/i,
  /\/dev\/shm\/duet/i,
  /crontab/i,
  /chattr/i,
  /kill\s*-9/i,
  /top\s*-b\s*-n\s*1/i,
  /\|\s*sh\b/i,
];

function hasAttackSignature(req: NextRequest): boolean {
  const urlPayload = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const userAgent = req.headers.get('user-agent') || '';
  const referer = req.headers.get('referer') || '';
  const cookie = req.headers.get('cookie') || '';
  const payload = `${urlPayload}\n${userAgent}\n${referer}\n${cookie}`;
  return ATTACK_PATTERNS.some((pattern) => pattern.test(payload));
}

export default function middleware(req: NextRequest) {
  if (hasAttackSignature(req)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (req.nextUrl.pathname.startsWith('/admin')) {
    return requireAdminAuth(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|ads.txt).*)'],
};
