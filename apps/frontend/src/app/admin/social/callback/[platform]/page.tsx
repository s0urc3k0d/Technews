'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams, useRouter } from 'next/navigation';
import { Check, X, Loader2 } from 'lucide-react';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/config';

export default function SocialCallbackPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const platform = params.platform as string;
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setMessage(errorDescription || error || 'Erreur d\'authentification');
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('Code d\'autorisation manquant');
        return;
      }

      try {
        // Le backend gère le callback OAuth puis redirige vers /admin/social
        const callbackUrl = new URL(`${API_BASE_URL}${API_ENDPOINTS.socialCallback(platform)}`);
        callbackUrl.searchParams.set('code', code);
        if (state) callbackUrl.searchParams.set('state', state);
        window.location.href = callbackUrl.toString();
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    };

    handleCallback();
  }, [platform, searchParams]);

  const platformNames: Record<string, string> = {
    twitter: 'Twitter / X',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Connexion en cours...
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Finalisation de la connexion à {platformNames[platform] || platform}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Connexion réussie !
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {message}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
              Redirection automatique...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Erreur de connexion
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {message}
            </p>
            <button
              onClick={() => router.push('/admin/social')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Retour aux paramètres
            </button>
          </>
        )}
      </div>
    </div>
  );
}
