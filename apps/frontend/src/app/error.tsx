// ===========================================
// Error Page
// ===========================================

'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <span className="text-6xl mb-6">⚠️</span>
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Une erreur est survenue</h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        Désolé, quelque chose s'est mal passé. Veuillez réessayer.
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Réessayer
        </button>
        <a
          href="/"
          className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
