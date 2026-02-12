// ===========================================
// Reporting Web Vitals vers Prometheus/API
// ===========================================

'use client';

import { useEffect } from 'react';
import { onCLS, onINP, onFCP, onLCP, onTTFB, Metric } from 'web-vitals';

const VITALS_ENDPOINT = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/metrics/web-vitals`
  : null;

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
}

/**
 * Envoie les métriques Web Vitals à l'API backend pour Prometheus
 */
function sendToAnalytics(metric: Metric) {
  const body: WebVitalsMetric = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    timestamp: Date.now(),
  };

  // Log en développement
  if (process.env.NODE_ENV === 'development') {
    console.log('[Web Vitals]', body.name, body.value.toFixed(2), `(${body.rating})`);
  }

  // Envoyer à l'API si configurée
  if (VITALS_ENDPOINT) {
    // Utiliser sendBeacon pour garantir l'envoi même si la page se ferme
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon(VITALS_ENDPOINT, blob);
    } else {
      // Fallback avec fetch
      fetch(VITALS_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(console.error);
    }
  }
}

/**
 * Composant à inclure dans le layout pour activer le reporting Web Vitals
 */
export function WebVitalsReporter() {
  useEffect(() => {
    // Core Web Vitals
    onCLS(sendToAnalytics);   // Cumulative Layout Shift
    onINP(sendToAnalytics);   // Interaction to Next Paint (remplace FID)
    onLCP(sendToAnalytics);   // Largest Contentful Paint
    
    // Autres métriques importantes
    onFCP(sendToAnalytics);   // First Contentful Paint
    onTTFB(sendToAnalytics);  // Time to First Byte
  }, []);

  return null; // Ce composant ne rend rien
}

/**
 * Hook pour accéder aux métriques Web Vitals en temps réel
 */
export function useWebVitals() {
  useEffect(() => {
    const metrics: Partial<Record<string, WebVitalsMetric>> = {};

    const updateMetric = (metric: Metric) => {
      metrics[metric.name] = {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
        url: window.location.href,
        timestamp: Date.now(),
      };
    };

    onCLS(updateMetric);
    onINP(updateMetric);
    onLCP(updateMetric);
    onFCP(updateMetric);
    onTTFB(updateMetric);

    // Exposer globalement pour debug
    if (typeof window !== 'undefined') {
      (window as any).__WEB_VITALS__ = metrics;
    }
  }, []);
}

/**
 * Affiche un badge avec le score Web Vitals (pour debug/admin)
 */
export function WebVitalsDebugBadge() {
  useEffect(() => {
    const showBadge = () => {
      const metrics = (window as any).__WEB_VITALS__;
      if (!metrics) return;

      const lcp = metrics.LCP?.value;
      const cls = metrics.CLS?.value;
      const inp = metrics.INP?.value;

      let score = 'good';
      if (
        (lcp && lcp > 4000) ||
        (cls && cls > 0.25) ||
        (inp && inp > 500)
      ) {
        score = 'poor';
      } else if (
        (lcp && lcp > 2500) ||
        (cls && cls > 0.1) ||
        (inp && inp > 200)
      ) {
        score = 'needs-improvement';
      }

      console.log(`[Web Vitals Score] ${score.toUpperCase()}`);
      console.table({
        LCP: lcp ? `${lcp.toFixed(0)}ms` : 'N/A',
        CLS: cls ? cls.toFixed(3) : 'N/A',
        INP: inp ? `${inp.toFixed(0)}ms` : 'N/A',
      });
    };

    // Attendre que les métriques soient collectées
    setTimeout(showBadge, 5000);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return null;
}
