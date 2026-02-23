// ===========================================
// Admin Layout
// ===========================================

import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@auth0/nextjs-auth0';
import { SITE_NAME } from '@/lib/config';
import { isAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: {
    default: 'Admin',
    template: `%s | Admin - ${SITE_NAME}`,
  },
  robots: {
    index: false,
    follow: false,
  },
};

const adminNavigation = [
  { name: 'Dashboard', href: '/admin', icon: '📊' },
  { name: 'Articles', href: '/admin/articles', icon: '📰' },
  { name: 'Commentaires', href: '/admin/comments', icon: '💬' },
  { name: 'Newsletter', href: '/admin/newsletter', icon: '📬' },
  { name: 'Shorts', href: '/admin/shorts', icon: '🎬' },
  { name: 'Social', href: '/admin/social', icon: '🌐' },
  { name: 'Webhooks', href: '/admin/webhooks', icon: '🔔' },
  { name: 'Images', href: '/admin/images', icon: '🖼️' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect('/api/auth/login?returnTo=/admin');
  }

  if (!isAdminUser(session.user as Record<string, unknown>)) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-gray-900 text-white p-6 z-40 overflow-y-auto">
          <Link href="/admin" className="flex items-center gap-2 mb-8">
            <span className="text-2xl">🚀</span>
            <span className="font-bold text-xl">{SITE_NAME}</span>
          </Link>

          <nav className="space-y-1">
            {adminNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-8">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span>←</span>
              <span>Retour au site</span>
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
