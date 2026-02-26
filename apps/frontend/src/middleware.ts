import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge';
import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';

const requireAdminAuth = withMiddlewareAuthRequired();

const ATTACK_PATTERNS: RegExp[] = [
  /cHMgYXV4/i,
  /base64\s*-d/i,
  /base64\s+--decode/i,
  /echo\s+[a-z0-9+/=]{24,}/i,
  /\/tmp\/\.xin-unix/i,
  /\/dev\/shm\/duet/i,
  /javae/i,
  /sentinel/i,
  /crontab/i,
  /chattr/i,
  /execsync\s*\(/i,
  /child_process/i,
  /process\.mainmodule/i,
  /require\s*\(\s*['"]child_process['"]\s*\)/i,
  /kill\s*-9/i,
  /xargs\b/i,
  /\bps\s+aux\b/i,
  /\bchmod\b/i,
  /\brm\s+-rf\b/i,
  /\bmk(di)?r\b/i,
  /top\s*-b\s*-n\s*1/i,
  /\|\s*sh\b/i,
];

const STATIC_PATH_PREFIXES = ['/favicon.ico', '/robots.txt', '/ads.txt', '/_next/static'];
const STATIC_FILE_EXTENSIONS = /\.(?:css|js|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|txt|xml)$/i;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildPayload(req: NextRequest): string {
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;
  const decodedPathname = safeDecode(pathname);
  const decodedSearch = safeDecode(search);
  const onceDecoded = safeDecode(decodedPathname + decodedSearch);

  const userAgent = req.headers.get('user-agent') || '';
  const referer = req.headers.get('referer') || '';
  const cookie = req.headers.get('cookie') || '';
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const realIp = req.headers.get('x-real-ip') || '';

  return [
    pathname,
    search,
    decodedPathname,
    decodedSearch,
    onceDecoded,
    userAgent,
    referer,
    cookie,
    forwarded,
    realIp,
  ].join('\n');
}

function isStaticBypassPath(pathname: string): boolean {
  if (STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return STATIC_FILE_EXTENSIONS.test(pathname);
}

function hasAttackSignature(req: NextRequest): boolean {
  const payload = buildPayload(req);
  return ATTACK_PATTERNS.some((pattern) => pattern.test(payload));
}

function hasBlockedMethod(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) {
    return false;
  }

  return !['GET', 'HEAD'].includes(method);
}

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isStaticBypassPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (hasBlockedMethod(req)) {
    return new NextResponse('Method Not Allowed', { status: 405 });
  }

  if (hasAttackSignature(req)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (req.nextUrl.pathname.startsWith('/admin')) {
    const response = await requireAdminAuth(req, event);

    if (response) {
      response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('Vary', 'Cookie, Authorization');
      return response;
    }

    const fallback = NextResponse.next();
    fallback.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
    fallback.headers.set('Pragma', 'no-cache');
    fallback.headers.set('Expires', '0');
    fallback.headers.set('Vary', 'Cookie, Authorization');
    return fallback;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
