// ===========================================
// Root Layout
// ===========================================

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/providers';
import { Header, Footer } from '@/components/layout';
import { SearchModal } from '@/components/ui';
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from '@/lib/config';

const inter = Inter({ subsets: ['latin'] });

// ID AdSense
const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_ID || 'ca-pub-7283351114219521';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ['tech', 'actualités', 'technologie', 'podcast', 'innovation', 'IA', 'développement'],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  other: {
    'google-adsense-account': ADSENSE_ID,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        {/* Google AdSense - Vérification du compte */}
        <meta name="google-adsense-account" content={ADSENSE_ID} />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col bg-gray-50`}>
        {/* Google AdSense Script */}
        <Script
          id="adsense-script"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Providers>
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          <SearchModal />
        </Providers>
      </body>
    </html>
  );
}
