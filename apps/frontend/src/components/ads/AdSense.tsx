// ===========================================
// Composants Google AdSense pour la monétisation
// ===========================================

'use client';

import { useEffect, useRef } from 'react';

// ID Publisher AdSense
const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_ID || 'ca-pub-7283351114219521';

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Composant générique pour afficher une bannière AdSense
 */
export function AdBanner({ 
  slot, 
  format = 'auto', 
  responsive = true, 
  className = '',
  style 
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const isAdLoaded = useRef(false);

  useEffect(() => {
    // Éviter les rechargements multiples
    if (isAdLoaded.current) return;
    
    // Vérifier si AdSense est chargé
    if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        isAdLoaded.current = true;
      } catch (error) {
        console.error('Erreur AdSense:', error);
      }
    }
  }, []);

  // Afficher un placeholder en dev si pas de slot défini
  if (!slot && process.env.NODE_ENV === 'development') {
    return (
      <div className={`bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 text-sm ${className}`}
           style={{ minHeight: '90px', ...style }}>
        <span>📢 Emplacement publicitaire (slot: {slot})</span>
      </div>
    );
  }

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle ${className}`}
      style={{ display: 'block', ...style }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}

/**
 * Bannière horizontale pour le header (728x90 ou responsive)
 */
export function HeaderAdBanner({ slot }: { slot: string }) {
  return (
    <div className="w-full flex justify-center py-2 bg-gray-50">
      <AdBanner
        slot={slot}
        format="horizontal"
        responsive={true}
        style={{ width: '100%', maxWidth: '728px', height: '90px' }}
      />
    </div>
  );
}

/**
 * Bannière pour la sidebar (300x250 ou 300x600)
 */
export function SidebarAdBanner({ slot, tall = false }: { slot: string; tall?: boolean }) {
  return (
    <div className="sticky top-4">
      <AdBanner
        slot={slot}
        format="rectangle"
        responsive={false}
        className="mx-auto"
        style={{ 
          width: '300px', 
          height: tall ? '600px' : '250px' 
        }}
      />
    </div>
  );
}

/**
 * Publicité In-Article (insérée dans le contenu)
 */
export function InArticleAdBanner({ slot }: { slot: string }) {
  return (
    <div className="my-8 flex justify-center">
      <AdBanner
        slot={slot}
        format="auto"
        responsive={true}
        className="max-w-full"
        style={{ minHeight: '250px' }}
      />
    </div>
  );
}

/**
 * Bannière pour le footer
 */
export function FooterAdBanner({ slot }: { slot: string }) {
  return (
    <div className="w-full py-4 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <AdBanner
          slot={slot}
          format="horizontal"
          responsive={true}
          style={{ width: '100%', height: '90px' }}
        />
      </div>
    </div>
  );
}

/**
 * Composant pour insérer le script AdSense dans le head
 * À utiliser dans le layout principal
 */
export function AdSenseScript() {
  // Toujours charger le script AdSense
  if (!ADSENSE_CLIENT_ID) {
    return null;
  }

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
    />
  );
}

/**
 * Hook pour gérer le consentement publicitaire (RGPD)
 */
export function useAdConsent() {
  const hasConsent = typeof window !== 'undefined' 
    ? localStorage.getItem('ad-consent') === 'true'
    : false;

  const grantConsent = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ad-consent', 'true');
      // Recharger les pubs après consentement
      window.location.reload();
    }
  };

  const revokeConsent = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ad-consent', 'false');
    }
  };

  return { hasConsent, grantConsent, revokeConsent };
}
