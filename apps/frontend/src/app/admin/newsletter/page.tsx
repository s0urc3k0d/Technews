// ===========================================
// Admin Newsletter Page
// ===========================================

'use client';

import { useState } from 'react';
import { 
  useSubscribers, 
  useNewsletters, 
  useGenerateNewsletter, 
  useSendNewsletter,
  useDeleteNewsletter 
} from '@/hooks';
import { formatDate, cn } from '@/lib/utils';
import { Button, Pagination } from '@/components';

export default function AdminNewsletterPage() {
  const [tab, setTab] = useState<'newsletters' | 'subscribers'>('newsletters');
  const [page, setPage] = useState(1);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Newsletter</h1>
          <p className="text-gray-600 mt-1">Gérez vos newsletters et abonnés</p>
        </div>
        <GenerateNewsletterButton />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => { setTab('newsletters'); setPage(1); }}
          className={cn(
            'px-4 py-2 font-medium rounded-lg transition-colors',
            tab === 'newsletters' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          📬 Newsletters
        </button>
        <button
          onClick={() => { setTab('subscribers'); setPage(1); }}
          className={cn(
            'px-4 py-2 font-medium rounded-lg transition-colors',
            tab === 'subscribers' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          👥 Abonnés
        </button>
      </div>

      {/* Content */}
      {tab === 'newsletters' ? (
        <NewslettersList page={page} setPage={setPage} />
      ) : (
        <SubscribersList page={page} setPage={setPage} />
      )}
    </div>
  );
}

// Generate Newsletter Button
function GenerateNewsletterButton() {
  const { mutate: generate, isPending } = useGenerateNewsletter();

  return (
    <Button 
      variant="primary" 
      onClick={() => generate()}
      isLoading={isPending}
    >
      🤖 Générer newsletter IA
    </Button>
  );
}

// Newsletters List
function NewslettersList({ page, setPage }: { page: number; setPage: (p: number) => void }) {
  const { data, isLoading } = useNewsletters({ page, limit: 10 });
  const { mutate: sendNewsletter, isPending: isSending } = useSendNewsletter();
  const { mutate: deleteNewsletter } = useDeleteNewsletter();

  const newsletters = data?.data ?? [];
  const pagination = data?.pagination;

  const handleSend = (id: string) => {
    if (confirm('Envoyer cette newsletter à tous les abonnés ?')) {
      sendNewsletter(id);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer cette newsletter ?')) {
      deleteNewsletter(id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Chargement...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {newsletters.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Aucune newsletter créée
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Sujet</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Statut</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Envoyé à</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {newsletters.map((newsletter) => (
              <tr key={newsletter.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{newsletter.subject}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    'px-2 py-1 text-xs font-medium rounded',
                    newsletter.status === 'SENT' ? 'bg-green-100 text-green-800' :
                    newsletter.status === 'SENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  )}>
                    {newsletter.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {formatDate(newsletter.createdAt)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {newsletter.sentCount ?? 0} abonnés
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {newsletter.status === 'DRAFT' && (
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={() => handleSend(newsletter.id)}
                        isLoading={isSending}
                      >
                        📤 Envoyer
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDelete(newsletter.id)}
                    >
                      🗑️
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="border-t px-6 py-4">
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

// Subscribers List
function SubscribersList({ page, setPage }: { page: number; setPage: (p: number) => void }) {
  const { data, isLoading } = useSubscribers({ page, limit: 20 });

  const subscribers = data?.data ?? [];
  const pagination = data?.pagination;

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Chargement...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {subscribers.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Aucun abonné
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Prénom</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Statut</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Source</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">
                  {subscriber.email}
                </td>
                <td className="px-6 py-4 text-gray-700">
                  {subscriber.firstName || '-'}
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    'px-2 py-1 text-xs font-medium rounded',
                    subscriber.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    subscriber.status === 'UNSUBSCRIBED' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  )}>
                    {subscriber.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {subscriber.source || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {formatDate(subscriber.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="border-t px-6 py-4">
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
