import { API_BASE_URL, API_ENDPOINTS, SITE_NAME } from '@/lib/config';

export const dynamic = 'force-dynamic';

interface ConfirmPageProps {
  searchParams: Promise<{ token?: string }>;
}

async function confirmSubscription(token: string): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.newsletterConfirm}?token=${encodeURIComponent(token)}`,
      { cache: 'no-store' }
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        message: payload.error || payload.message || 'Lien de confirmation invalide ou expiré.',
      };
    }

    return {
      ok: true,
      message: payload.message || 'Votre inscription est confirmée. Merci !',
    };
  } catch {
    return {
      ok: false,
      message: 'Impossible de confirmer votre inscription pour le moment.',
    };
  }
}

export default async function NewsletterConfirmPage({ searchParams }: ConfirmPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Confirmation impossible</h1>
          <p className="text-gray-600 mb-6">Le lien de confirmation est incomplet.</p>
          <a href="/" className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }

  const result = await confirmSubscription(token);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          {result.ok ? 'Inscription confirmée' : 'Confirmation échouée'}
        </h1>
        <p className="text-gray-600 mb-6">{result.message}</p>
        <a href="/" className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Retour sur {SITE_NAME}
        </a>
      </div>
    </div>
  );
}