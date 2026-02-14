// ===========================================
// Mentions Légales
// ===========================================

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions Légales',
  description: 'Mentions légales du site Revue Tech',
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl lg:text-4xl font-bold mb-8">Mentions Légales</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-8">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Éditeur du site</h2>
            <p>
              Le site <strong>Revue Tech</strong> (https://revuetech.fr) est édité par :
            </p>
            <ul className="list-disc pl-6 mt-4">
              <li><strong>Nom / Raison sociale :</strong> [À COMPLÉTER]</li>
              <li><strong>Adresse :</strong> [À COMPLÉTER]</li>
              <li><strong>Email :</strong> contact@revuetech.fr</li>
              <li><strong>Directeur de la publication :</strong> [À COMPLÉTER]</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Hébergement</h2>
            <p>
              Le site est hébergé par :
            </p>
            <ul className="list-disc pl-6 mt-4">
              <li><strong>Hébergeur :</strong> [À COMPLÉTER - ex: OVH, Scaleway, etc.]</li>
              <li><strong>Adresse :</strong> [À COMPLÉTER]</li>
              <li><strong>Téléphone :</strong> [À COMPLÉTER]</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, images, vidéos, logos, etc.) 
              est protégé par le droit d&apos;auteur. Toute reproduction, représentation, 
              modification, publication ou adaptation de tout ou partie des éléments du 
              site est interdite sans l&apos;autorisation écrite préalable de l&apos;éditeur.
            </p>
            <p className="mt-4">
              Certains articles peuvent être issus de sources externes avec leur accord. 
              Les marques et logos présents sur le site appartiennent à leurs propriétaires respectifs.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Limitation de responsabilité</h2>
            <p>
              Les informations publiées sur ce site sont fournies à titre informatif 
              et sont susceptibles d&apos;être modifiées à tout moment. L&apos;éditeur ne 
              saurait être tenu responsable des erreurs, omissions ou résultats qui 
              pourraient être obtenus par un mauvais usage de ces informations.
            </p>
            <p className="mt-4">
              L&apos;éditeur ne peut être tenu responsable des dommages directs ou indirects 
              résultant de l&apos;accès ou de l&apos;utilisation du site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Liens hypertextes</h2>
            <p>
              Le site peut contenir des liens vers des sites externes. L&apos;éditeur 
              n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité 
              quant à leur contenu ou leur disponibilité.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Crédits</h2>
            <ul className="list-disc pl-6">
              <li><strong>Développement :</strong> [À COMPLÉTER]</li>
              <li><strong>Design :</strong> [À COMPLÉTER]</li>
              <li><strong>Icônes :</strong> Emoji natifs, Heroicons</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Contact</h2>
            <p>
              Pour toute question concernant les mentions légales, vous pouvez 
              nous contacter à l&apos;adresse : <a href="mailto:contact@revuetech.fr" 
              className="text-blue-600 hover:underline">contact@revuetech.fr</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
