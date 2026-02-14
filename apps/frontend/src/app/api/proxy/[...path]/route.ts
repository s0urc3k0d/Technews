import { NextRequest } from 'next/server';

const resolveUpstream = () => {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://backend:3001'
  );
};

const buildTargetUrl = (req: NextRequest, path: string[]) => {
  const upstream = resolveUpstream().replace(/\/$/, '');
  const pathname = path.join('/');
  const search = req.nextUrl.search || '';
  return `${upstream}/${pathname}${search}`;
};

const hopByHopHeaders = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-length',
]);

async function proxy(req: NextRequest, path: string[]) {
  const targetUrl = buildTargetUrl(req, path);

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);

  const upstreamResponse = await fetch(targetUrl, {
    method,
    headers,
    body: hasBody ? req.body : undefined,
    redirect: 'manual',
    cache: 'no-store',
    duplex: hasBody ? 'half' : undefined,
  } as RequestInit & { duplex?: 'half' });

  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}
