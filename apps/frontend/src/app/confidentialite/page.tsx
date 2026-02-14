// ===========================================
// Politique de Confidentialité (RGPD)
// ===========================================

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité',
  description: 'Politique de confidentialité et protection des données personnelles - Revue Tech',
};

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl lg:text-4xl font-bold mb-8">Politique de Confidentialité</h1>
        
        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-8">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p>
              La présente politique de confidentialité décrit comment <strong>Revue Tech</strong> 
              (https://revuetech.fr) collecte, utilise et protège vos données personnelles 
              conformément au Règlement Général sur la Protection des Données (RGPD).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Responsable du traitement</h2>
            <ul className="list-disc pl-6">
              <li><strong>Identité :</strong> [À COMPLÉTER]</li>
              <li><strong>Adresse :</strong> [À COMPLÉTER]</li>
              <li><strong>Email :</strong> privacy@revuetech.fr</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Données collectées</h2>
            <p>Nous collectons les données suivantes :</p>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Newsletter</h3>
            <ul className="list-disc pl-6">
              <li>Adresse email</li>
              <li>Date d&apos;inscription</li>
              <li>Statistiques d&apos;ouverture et de clics (via Resend)</li>
            </ul>
            <p className="mt-2">
              <strong>Base légale :</strong> Consentement (opt-in avec confirmation par email)
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Commentaires</h3>
            <ul className="list-disc pl-6">
              <li>Nom ou pseudonyme</li>
              <li>Adresse email</li>
              <li>Contenu du commentaire</li>
              <li>Adresse IP (pour modération anti-spam)</li>
              <li>Date et heure de publication</li>
            </ul>
            <p className="mt-2">
              <strong>Base légale :</strong> Intérêt légitime (modération) et consentement
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">3.3 Données techniques</h3>
            <ul className="list-disc pl-6">
              <li>Adresse IP</li>
              <li>Type de navigateur</li>
              <li>Pages visitées</li>
              <li>Durée de visite</li>
            </ul>
            <p className="mt-2">
              <strong>Base légale :</strong> Intérêt légitime (amélioration du service, sécurité)
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Finalités du traitement</h2>
            <ul className="list-disc pl-6">
              <li>Envoi de la newsletter (si inscrit)</li>
              <li>Publication et modération des commentaires</li>
              <li>Amélioration du site et de l&apos;expérience utilisateur</li>
              <li>Statistiques anonymisées de fréquentation</li>
              <li>Détection et prévention des abus (spam, fraude)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Durée de conservation</h2>
            <ul className="list-disc pl-6">
              <li><strong>Newsletter :</strong> Jusqu&apos;à désinscription + 3 ans d&apos;archivage</li>
              <li><strong>Commentaires :</strong> Durée de publication de l&apos;article + 3 ans</li>
              <li><strong>Logs techniques :</strong> 12 mois maximum</li>
              <li><strong>Cookies :</strong> 13 mois maximum</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Destinataires des données</h2>
            <p>Vos données peuvent être transmises à :</p>
            <ul className="list-disc pl-6">
              <li><strong>Resend</strong> - Service d&apos;envoi d&apos;emails (newsletter)</li>
              <li><strong>Notre hébergeur</strong> - Stockage des données</li>
              <li><strong>Google AdSense</strong> - Publicité (si activé)</li>
            </ul>
            <p className="mt-4">
              Ces prestataires sont soumis au RGPD ou offrent des garanties équivalentes 
              (clauses contractuelles types).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Vos droits</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-6 mt-4">
              <li><strong>Droit d&apos;accès :</strong> Obtenir une copie de vos données</li>
              <li><strong>Droit de rectification :</strong> Corriger vos données inexactes</li>
              <li><strong>Droit à l&apos;effacement :</strong> Demander la suppression de vos données</li>
              <li><strong>Droit à la portabilité :</strong> Recevoir vos données dans un format structuré</li>
              <li><strong>Droit d&apos;opposition :</strong> Vous opposer au traitement de vos données</li>
              <li><strong>Droit de limitation :</strong> Limiter le traitement de vos données</li>
              <li><strong>Droit de retrait du consentement :</strong> Retirer votre consentement à tout moment</li>
            </ul>
            <p className="mt-4">
              Pour exercer ces droits, contactez-nous à : 
              <a href="mailto:privacy@revuetech.fr" className="text-blue-600 hover:underline">
                privacy@revuetech.fr
              </a>
            </p>
            <p className="mt-4">
              Vous pouvez également déposer une réclamation auprès de la CNIL : 
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" 
                 className="text-blue-600 hover:underline">www.cnil.fr</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Cookies</h2>
            <p>
              Ce site utilise des cookies pour améliorer votre expérience. 
              Voici les types de cookies utilisés :
            </p>
            <ul className="list-disc pl-6 mt-4">
              <li><strong>Cookies essentiels :</strong> Nécessaires au fonctionnement du site (session, préférences)</li>
              <li><strong>Cookies analytiques :</strong> Mesure d&apos;audience anonymisée</li>
              <li><strong>Cookies publicitaires :</strong> Google AdSense (si activé, avec votre consentement)</li>
            </ul>
            <p className="mt-4">
              Vous pouvez gérer vos préférences de cookies via les paramètres de votre navigateur.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées 
              pour protéger vos données :
            </p>
            <ul className="list-disc pl-6 mt-4">
              <li>Chiffrement HTTPS (TLS)</li>
              <li>Mots de passe hashés</li>
              <li>Accès restreint aux données</li>
              <li>Sauvegardes régulières</li>
              <li>Mises à jour de sécurité</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Modifications</h2>
            <p>
              Cette politique de confidentialité peut être mise à jour. 
              Nous vous informerons de tout changement significatif par email 
              ou via une notification sur le site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Contact</h2>
            <p>
              Pour toute question relative à cette politique ou à vos données personnelles :
            </p>
            <ul className="list-disc pl-6 mt-4">
              <li><strong>Email :</strong> <a href="mailto:privacy@revuetech.fr" 
                className="text-blue-600 hover:underline">privacy@revuetech.fr</a></li>
              <li><strong>Adresse :</strong> [À COMPLÉTER]</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
