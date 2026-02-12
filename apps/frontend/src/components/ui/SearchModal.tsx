// ===========================================
// Search Modal Component
// ===========================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUIStore } from '@/lib/store';
import { useArticles } from '@/hooks';
import { debounce } from '@/lib/utils';

export function SearchModal() {
  const { isSearchOpen, toggleSearch, closeSearch } = useUIStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounce search query
  const debouncedSetQuery = useCallback(
    debounce((value: string) => {
      setDebouncedQuery(value);
    }, 300),
    []
  );

  // Search results
  const { data, isLoading } = useArticles({ 
    search: debouncedQuery,
    limit: 5,
  }, { enabled: debouncedQuery.length >= 2 });

  const results = data?.data ?? [];

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
      }
      // Close with Escape
      if (e.key === 'Escape' && isSearchOpen) {
        closeSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, toggleSearch, closeSearch]);

  // Focus input when opening
  useEffect(() => {
    if (isSearchOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      setQuery('');
      setDebouncedQuery('');
      document.body.style.overflow = '';
    }
  }, [isSearchOpen]);

  // Handle input change
  const handleInputChange = (value: string) => {
    setQuery(value);
    debouncedSetQuery(value);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      closeSearch();
    }
  };

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeSearch}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-20 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <form onSubmit={handleSubmit}>
            <div className="flex items-center px-4 border-b">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Rechercher des articles..."
                className="flex-1 px-4 py-4 outline-none text-lg"
              />
              <kbd className="hidden sm:inline-flex px-2 py-1 text-xs text-gray-400 bg-gray-100 rounded">
                Échap
              </kbd>
            </div>
          </form>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Loading */}
            {isLoading && query.length >= 2 && (
              <div className="p-4 text-center text-gray-500">
                Recherche en cours...
              </div>
            )}

            {/* No results */}
            {!isLoading && debouncedQuery.length >= 2 && results.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-gray-500">Aucun résultat pour "{debouncedQuery}"</p>
                <p className="text-sm text-gray-400 mt-2">
                  Essayez d'autres mots-clés
                </p>
              </div>
            )}

            {/* Results list */}
            {results.length > 0 && (
              <div className="p-2">
                {results.map((article) => (
                  <Link
                    key={article.id}
                    href={`/article/${article.slug}`}
                    onClick={closeSearch}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl shrink-0">
                        {article.type === 'PODCAST' ? '🎙️' : '📰'}
                      </span>
                      <div>
                        <h3 className="font-medium text-gray-900 line-clamp-1">
                          {article.title}
                        </h3>
                        {article.excerpt && (
                          <p className="text-sm text-gray-500 line-clamp-1 mt-1">
                            {article.excerpt}
                          </p>
                        )}
                        {article.category && (
                          <span className="inline-block text-xs text-blue-600 mt-1">
                            {article.category.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}

                {/* View all results */}
                {data && data.pagination.total > 5 && (
                  <button
                    onClick={() => {
                      router.push(`/search?q=${encodeURIComponent(query)}`);
                      closeSearch();
                    }}
                    className="w-full p-3 text-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Voir tous les résultats ({data.pagination.total})
                  </button>
                )}
              </div>
            )}

            {/* Empty state */}
            {query.length < 2 && (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">
                  Tapez au moins 2 caractères pour rechercher
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white rounded border">↓</kbd>
                Naviguer
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border">⏎</kbd>
                Ouvrir
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-white rounded border">K</kbd>
              Rechercher
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
