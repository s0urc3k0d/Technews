// ===========================================
// Newsletter Form Component
// ===========================================

'use client';

import { useState, FormEvent } from 'react';
import { useSubscribe } from '@/hooks';
import { isValidEmail } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface NewsletterFormProps {
  variant?: 'default' | 'footer' | 'hero';
  className?: string;
}

export function NewsletterForm({ variant = 'default', className }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const { mutate: subscribe, isPending, isSuccess, isError, error } = useSubscribe();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      return;
    }

    subscribe({ 
      email, 
      firstName: firstName || undefined,
      source: 'website',
    });
  };

  if (isSuccess) {
    return (
      <div className={cn(
        'rounded-lg p-4',
        variant === 'footer' ? 'bg-gray-800' : 'bg-green-50 border border-green-200',
        className
      )}>
        <p className={cn(
          'text-sm font-medium',
          variant === 'footer' ? 'text-green-400' : 'text-green-800'
        )}>
          ✅ Merci ! Vérifiez votre boîte mail pour confirmer votre inscription.
        </p>
      </div>
    );
  }

  // Footer variant (compact)
  if (variant === 'footer') {
    return (
      <form onSubmit={handleSubmit} className={cn('space-y-3', className)}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre email"
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={isPending}
          className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Inscription...' : "S'inscrire"}
        </button>
        {isError && (
          <p className="text-red-400 text-sm">{error.message}</p>
        )}
      </form>
    );
  }

  // Hero variant (horizontal, large)
  if (variant === 'hero') {
    return (
      <form onSubmit={handleSubmit} className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Prénom (optionnel)"
          className="w-full px-5 py-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre email"
          required
          className="w-full min-w-0 px-5 py-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={isPending}
          className="md:col-span-2 w-full px-6 py-4 text-lg bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Inscription...' : "S'inscrire gratuitement"}
        </button>
        {isError && (
          <p className="text-red-600 text-sm md:col-span-2">{error.message}</p>
        )}
      </form>
    );
  }

  // Default variant
  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <div>
        <label htmlFor="newsletter-email" className="block text-sm font-medium text-gray-700 mb-1">
          Adresse email
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.com"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Inscription en cours...' : "S'inscrire à la newsletter"}
      </button>
      {isError && (
        <p className="text-red-600 text-sm">{error.message}</p>
      )}
      <p className="text-xs text-gray-500 text-center">
        Pas de spam, désabonnement en un clic.
      </p>
    </form>
  );
}
