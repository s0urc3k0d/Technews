// ===========================================
// Footer Component
// ===========================================

import Link from 'next/link';
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/config';
import { NewsletterForm } from '@/components/forms/NewsletterForm';

const footerLinks = {
  navigation: [
    { name: 'Accueil', href: '/' },
    { name: 'Articles', href: '/articles' },
    { name: 'Podcasts', href: '/podcasts' },
    { name: 'Catégories', href: '/categories' },
  ],
  legal: [
    { name: 'Mentions légales', href: '/mentions-legales' },
    { name: 'Politique de confidentialité', href: '/confidentialite' },
    { name: 'CGU', href: '/cgu' },
  ],
  social: [
    { name: 'Twitter', href: 'https://twitter.com/technews', icon: '𝕏' },
    { name: 'YouTube', href: 'https://youtube.com/@technews', icon: '▶️' },
    { name: 'Spotify', href: 'https://open.spotify.com/show/technews', icon: '🎵' },
    { name: 'RSS', href: '/rss.xml', icon: '📡' },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand & Description */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <span className="text-3xl">🚀</span>
              <span className="font-bold text-2xl">{SITE_NAME}</span>
            </Link>
            <p className="text-gray-400 text-sm">
              {SITE_DESCRIPTION}
            </p>
            <div className="flex gap-4 mt-6">
              {footerLinks.social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xl hover:opacity-80 transition-opacity"
                  aria-label={item.name}
                >
                  {item.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Navigation</h3>
            <ul className="space-y-3">
              {footerLinks.navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Informations</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Newsletter</h3>
            <p className="text-gray-400 text-sm mb-4">
              Recevez les meilleurs articles de la semaine directement dans votre boîte mail.
            </p>
            <NewsletterForm variant="footer" />
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <p className="text-center text-gray-500 text-sm">
            © {currentYear} {SITE_NAME}. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
