// ===========================================
// Header Component
// ===========================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useCategories } from '@/hooks';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { SITE_NAME } from '@/lib/config';

const navigation = [
  { name: 'Accueil', href: '/' },
  { name: 'Articles', href: '/articles' },
  { name: 'Podcasts', href: '/podcasts' },
  { name: 'Catégories', href: '/categories' },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const { toggleSearch } = useUIStore();
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data ?? [];

  const adminHref = isAuthenticated ? '/admin' : '/api/auth/login?returnTo=/admin';
  const logoutHref = '/api/auth/logout?returnTo=/';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          if (!cancelled) {
            setIsAuthenticated(false);
            setUserLabel(null);
          }
          return;
        }

        const session = await response.json();
        if (!cancelled) {
          setIsAuthenticated(true);
          setUserLabel(session?.name || session?.nickname || session?.email || null);
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
          setUserLabel(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8">
        {/* Logo */}
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <span className="font-bold text-xl text-gray-900">{SITE_NAME}</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Ouvrir le menu</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex lg:gap-x-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'text-sm font-semibold leading-6 transition-colors',
                pathname === item.href
                  ? 'text-blue-600'
                  : 'text-gray-900 hover:text-blue-600'
              )}
            >
              {item.name}
            </Link>
          ))}
          
          {/* Categories Dropdown */}
          {categories.length > 0 && (
            <div className="relative group">
              <button className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600 flex items-center gap-1">
                Plus
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-white rounded-lg shadow-lg ring-1 ring-black/5 p-2 min-w-[200px]">
                  {categories.slice(0, 8).map((category) => (
                    <Link
                      key={category.id}
                      href={`/category/${category.slug}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                    >
                      {category.icon && <span className="mr-2">{category.icon}</span>}
                      {category.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search & Auth */}
        <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-4">
          <button
            onClick={toggleSearch}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Rechercher"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
          {isAuthenticated && !authLoading && (
            <span className="hidden xl:inline text-xs text-gray-500 self-center max-w-[220px] truncate" title={userLabel || undefined}>
              Connecté {userLabel ? `: ${userLabel}` : ''}
            </span>
          )}
          <Link
            href={adminHref}
            prefetch={false}
            className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600"
          >
            {isAuthenticated ? 'Admin' : 'Se connecter'} <span aria-hidden="true">&rarr;</span>
          </Link>
          {isAuthenticated && !authLoading && (
            <Link
              href={logoutHref}
              prefetch={false}
              className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600"
            >
              Déconnexion
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && isMounted && createPortal(
        <div className="lg:hidden fixed inset-0 z-[9999]">
          <div className="fixed inset-0 bg-black/20" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-[10000] w-full max-w-sm bg-white px-6 py-6 overflow-y-auto">
            <div className="flex items-center justify-between">
              <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                <span className="font-bold text-xl">{SITE_NAME}</span>
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-gray-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Fermer</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/10">
                <div className="space-y-2 py-6">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        '-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7',
                        pathname === item.href
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
                <div className="py-6">
                  <Link
                    href={adminHref}
                    prefetch={false}
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                  >
                    {isAuthenticated ? 'Admin' : 'Se connecter'}
                  </Link>
                  {isAuthenticated && !authLoading && (
                    <Link
                      href={logoutHref}
                      prefetch={false}
                      onClick={() => setMobileMenuOpen(false)}
                      className="-mx-3 mt-2 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    >
                      Déconnexion
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
