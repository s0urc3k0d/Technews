// ===========================================
// Conditions Générales d'Utilisation (CGU)
// ===========================================

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation',
  description: 'Conditions générales d\'utilisation du site RevueTech',
};

export default function CGUPage() {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl lg:text-4xl font-bold mb-8">Conditions Générales d&apos;Utilisation</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-8">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Objet</h2>
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (CGU) définissent les règles 
              d&apos;utilisation du site <strong>RevueTech</strong> (https://revuetech.fr) et de 
              ses services. En accédant au site, vous acceptez sans réserve les présentes CGU.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Accès au site</h2>
            <p>
              Le site est accessible gratuitement à tout utilisateur disposant d&apos;un accès 
              à Internet. L&apos;éditeur met tout en œuvre pour assurer l&apos;accessibilité du site 
              mais ne peut garantir une disponibilité permanente.
            </p>
            <p className="mt-4">
              L&apos;éditeur se réserve le droit de suspendre, modifier ou interrompre 
              l&apos;accès au site sans préavis pour maintenance ou amélioration.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Services proposés</h2>
            <p>Le site RevueTech propose :</p>
            <ul className="list-disc pl-6 mt-4">
              <li>Des articles d&apos;actualité sur la technologie</li>
              <li>Des podcasts tech</li>
              <li>Une newsletter par email</li>
              <li>Un espace commentaires</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Inscription à la newsletter</h2>
            <p>
              L&apos;inscription à la newsletter est gratuite et nécessite uniquement une 
              adresse email valide. Un email de confirmation sera envoyé pour valider 
              l&apos;inscription (double opt-in).
            </p>
            <p className="mt-4">
              Vous pouvez vous désinscrire à tout moment via le lien présent dans 
              chaque newsletter ou en contactant contact@revuetech.fr.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Commentaires</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">5.1 Règles de publication</h3>
            <p>En publiant un commentaire, vous vous engagez à :</p>
            <ul className="list-disc pl-6 mt-4">
              <li>Ne pas publier de contenu illégal, diffamatoire, injurieux ou discriminatoire</li>
              <li>Ne pas publier de spam ou de contenu publicitaire non autorisé</li>
              <li>Respecter les droits d&apos;auteur et de propriété intellectuelle</li>
              <li>Ne pas usurper l&apos;identité d&apos;autrui</li>
              <li>Ne pas publier de données personnelles de tiers sans leur consentement</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">5.2 Modération</h3>
            <p>
              Les commentaires sont publiés immédiatement mais font l&apos;objet d&apos;une 
              modération a posteriori. L&apos;éditeur se réserve le droit de supprimer 
              tout commentaire contraire aux présentes CGU ou à la loi.
            </p>
            <p className="mt-4">
              Tout utilisateur peut signaler un commentaire inapproprié via le 
              bouton de signalement prévu à cet effet.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">5.3 Responsabilité</h3>
            <p>
              Les utilisateurs sont seuls responsables du contenu de leurs commentaires. 
              L&apos;éditeur ne peut être tenu responsable des propos publiés par les utilisateurs.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Propriété intellectuelle</h2>
            <p>
              Tous les contenus présents sur le site (textes, images, vidéos, logos, 
              design) sont protégés par le droit d&apos;auteur. Toute reproduction ou 
              utilisation non autorisée est interdite.
            </p>
            <p className="mt-4">
              Le partage d&apos;articles via les réseaux sociaux ou par lien direct est autorisé 
              et encouragé, à condition de citer la source.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Publicité</h2>
            <p>
              Le site peut afficher des publicités via Google AdSense. Ces publicités 
              sont clairement identifiées et ne constituent pas une recommandation 
              de l&apos;éditeur pour les produits ou services annoncés.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Limitation de responsabilité</h2>
            <p>
              Les informations publiées sur le site sont fournies à titre informatif. 
              L&apos;éditeur ne garantit pas l&apos;exactitude, l&apos;exhaustivité ou l&apos;actualité 
              des informations.
            </p>
            <p className="mt-4">
              L&apos;éditeur ne saurait être tenu responsable :
            </p>
            <ul className="list-disc pl-6 mt-4">
              <li>Des erreurs ou omissions dans le contenu</li>
              <li>Des dommages résultant de l&apos;utilisation du site</li>
              <li>Du contenu des sites externes vers lesquels des liens sont proposés</li>
              <li>De l&apos;interruption du service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Données personnelles</h2>
            <p>
              La collecte et le traitement des données personnelles sont régis par notre 
              <a href="/confidentialite" className="text-blue-600 hover:underline ml-1">
                Politique de Confidentialité
              </a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Modification des CGU</h2>
            <p>
              L&apos;éditeur se réserve le droit de modifier les présentes CGU à tout moment. 
              Les utilisateurs seront informés des modifications par une mention sur le site. 
              La poursuite de l&apos;utilisation du site après modification vaut acceptation 
              des nouvelles CGU.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Droit applicable</h2>
            <p>
              Les présentes CGU sont régies par le droit français. En cas de litige, 
              les tribunaux français seront seuls compétents.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact</h2>
            <p>
              Pour toute question concernant les présentes CGU :
            </p>
            <ul className="list-disc pl-6 mt-4">
              <li><strong>Email :</strong> <a href="mailto:contact@revuetech.fr" 
                className="text-blue-600 hover:underline">contact@revuetech.fr</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
