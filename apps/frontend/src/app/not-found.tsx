// ===========================================
// Not Found Page
// ===========================================

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <span className="text-6xl mb-6">🔍</span>
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Page non trouvée</h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retour à l'accueil
        </Link>
        <Link
          href="/articles"
          className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          Voir les articles
        </Link>
      </div>
    </div>
  );
}
