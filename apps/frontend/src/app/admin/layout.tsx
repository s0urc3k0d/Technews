// ===========================================
// Admin Layout
// ===========================================

import { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/config';

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
  { name: 'Catégories', href: '/admin/categories', icon: '📁' },
  { name: 'Commentaires', href: '/admin/comments', icon: '💬' },
  { name: 'Newsletter', href: '/admin/newsletter', icon: '📬' },
  { name: 'Images', href: '/admin/images', icon: '🖼️' },
  { name: 'Paramètres', href: '/admin/settings', icon: '⚙️' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white p-6 z-40">
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

          <div className="absolute bottom-6 left-6 right-6">
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
