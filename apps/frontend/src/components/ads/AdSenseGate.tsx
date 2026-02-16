'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

interface AdSenseGateProps {
  clientId: string;
}

const ALLOWED_EXACT_PATHS = new Set(['/','/articles','/podcasts']);

const ALLOWED_PREFIXES = ['/article/','/category/'];

function isAdAllowedPath(pathname: string): boolean {
  if (ALLOWED_EXACT_PATHS.has(pathname)) {
    return true;
  }

  return ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function AdSenseGate({ clientId }: AdSenseGateProps) {
  const pathname = usePathname() || '/';

  if (!clientId || !isAdAllowedPath(pathname)) {
    return null;
  }

  return (
    <Script
      id="adsense-script"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
