import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import {
  CONTACT,
  DATABASE,
  HOST,
  KEPT,
  LegalFacts,
  LegalPage,
  LegalSection,
  PUBLISHER,
} from '~/features/legal/LegalPage'
import { legalHeaders, legalPaths } from '~/features/legal/legal'
import { AMAZON_PARTNER_TAG } from '~/features/product/shops'
import { messages as m } from '~/i18n/messages'
import { pageHead } from '~/seo'

// The legal notice and privacy page in French ($lang_.legal.tsx is the English one): a page of text
// rendered by the server, outside the locale's layout (no catalogue, no canvas, no preloader). The
// sitemap leaves it out.

const TITLE = 'Mentions légales et confidentialité'
const DESCRIPTION =
  'Qui édite shapepick, qui l’héberge et ce que le site garde de tes visites : aucun cookie, seulement un décompte des clics vers Amazon, sans donnée personnelle.'

export const Route = createFileRoute('/$lang_/mentions-legales')({
  // In French only: in English the page has a name of its own, in any other language there is none.
  beforeLoad: ({ params }) => {
    if (params.lang === 'en') {
      throw redirect({ to: '/$lang/legal', params: { lang: 'en' }, statusCode: 301 })
    }
    if (params.lang !== 'fr') throw notFound()
  },
  head: () => pageHead({ locale: 'fr', paths: legalPaths, title: TITLE, description: DESCRIPTION }),
  headers: () => legalHeaders,
  component: MentionsLegales,
})

function MentionsLegales() {
  const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
  return (
    <LegalPage
      locale="fr"
      title={TITLE}
      lead="Qui publie shapepick, qui l’héberge, et ce que le site garde de tes visites."
      facts={['Aucun cookie', 'Aucun compte', 'Statistiques anonymes']}
    >
      <LegalSection id="editeur" n={1} title="Éditeur">
        {PUBLISHER ? (
          <>
            <p>
              shapepick est édité par {PUBLISHER.name}, qui en est aussi le directeur de la
              publication.
            </p>
            <LegalFacts
              rows={[
                ['Éditeur', PUBLISHER.name],
                ['Adresse', PUBLISHER.address],
                ['Téléphone', PUBLISHER.phone],
                ['Contact', mail],
              ]}
            />
          </>
        ) : (
          <>
            <p>
              shapepick est édité par un particulier, à titre non professionnel. Comme le permet la
              loi pour la confiance dans l’économie numérique (article 1-1), son identité n’est pas
              publiée ici : elle a été communiquée à l’hébergeur du site, ci-dessous.
            </p>
            <LegalFacts rows={[['Contact', mail]]} />
          </>
        )}
      </LegalSection>

      <LegalSection id="hebergement" n={2} title="Hébergement">
        <LegalFacts
          rows={[
            [
              'Site',
              <>
                {HOST.name}
                <br />
                {HOST.address}, États-Unis
                <br />
                <a href={HOST.url}>netlify.com</a>
              </>,
            ],
            [
              'Base de données',
              <>
                {DATABASE.name}
                <br />
                {DATABASE.address}, États-Unis
                <br />
                Données stockées à Francfort, en Allemagne
              </>,
            ],
          ]}
        />
        <p>
          Comme tout hébergeur, Netlify traite l’adresse IP de chaque visite pour acheminer les
          pages et protéger le site ; shapepick ne l’enregistre nulle part. Les photos des produits
          sont servies par le site lui-même : ton navigateur ne contacte aucun site de marque.
        </p>
      </LegalSection>

      <LegalSection id="clics" n={3} title="Clics vers Amazon">
        <p>
          Quand tu ouvres un lien vers Amazon, le site note ce clic dans sa propre base de données,
          pour savoir quels modèles intéressent et quels liens servent.
        </p>
        <LegalFacts
          rows={[
            [
              'Ce qui est noté',
              'Le produit, la place du lien sur la page, le type de lien (fiche du produit ou recherche), la langue et la page du site, la date et l’heure, le pays et le type d’appareil (mobile ou ordinateur).',
            ],
            [
              'Jamais',
              'Ni adresse IP, ni cookie, ni identifiant : impossible de savoir qui a cliqué.',
            ],
            ['Où', 'La base de données de shapepick, chez Neon, à Francfort.'],
            ['Conservation', `${KEPT.clicks} mois`],
          ]}
        />
      </LegalSection>

      <LegalSection id="amazon" n={4} title="Liens vers Amazon.fr">
        {AMAZON_PARTNER_TAG ? (
          <>
            <p>
              Les liens « Voir sur Amazon » et « Chercher sur Amazon » mènent à Amazon.fr. shapepick
              participe au programme Partenaires d’Amazon : ce sont des liens affiliés, et Amazon
              lui reverse une commission sur les achats faits après un clic, sans rien changer à ton
              prix. Les commissions n’entrent pas dans le classement : il ne dépend que de tes
              réponses et des fiches des produits.
            </p>
            <p>
              <strong>{m.amazonNotice.fr}</strong>
            </p>
          </>
        ) : (
          <>
            <p>
              Les liens « Voir sur Amazon » et « Chercher sur Amazon » mènent à Amazon.fr. Ce sont
              de simples liens : shapepick ne touche rien sur tes achats.
            </p>
            <p>
              Si le site rejoint un jour le programme Partenaires d’Amazon, ces liens deviendront
              des liens affiliés : Amazon lui reversera une commission sur les achats faits après un
              clic, sans rien changer à ton prix. Cette page et les fiches des produits
              l’indiqueront alors.
            </p>
          </>
        )}
        <p>Sur Amazon.fr, ce sont les règles de confidentialité d’Amazon qui s’appliquent.</p>
      </LegalSection>

      <LegalSection id="stockage" n={5} title="Stockage dans ton navigateur">
        <p>
          Pour te faire gagner du temps, le site garde quelques informations dans ton navigateur
          (stockage local) : tes réponses au questionnaire de chaque catégorie, pour les retrouver à
          ta prochaine visite, et les astuces déjà vues, pour ne pas les répéter. Elles ne quittent
          jamais ton appareil.
        </p>
        <p>
          Tu peux les effacer à tout moment en supprimant les données du site dans les réglages de
          ton navigateur.
        </p>
      </LegalSection>

      <LegalSection id="produits" n={6} title="Produits et marques">
        <p>
          Les caractéristiques viennent des fabricants et de la presse spécialisée. Les prix sont
          des prix publics indicatifs, pas des offres : seul le prix du vendeur fait foi. Malgré le
          soin apporté, une erreur reste possible : vérifie la fiche du vendeur avant d’acheter, et
          écris-nous si tu en repères une.
        </p>
        <p>
          Les noms, marques et photos des produits appartiennent à leurs propriétaires ; ils servent
          seulement à identifier les modèles comparés.
        </p>
      </LegalSection>

      <LegalSection id="contact" n={7} title="Contact et droits">
        <p>
          Une question, une erreur à signaler, une demande sur tes données (accès, effacement,
          opposition) : écris à {mail}. Tu peux aussi adresser une réclamation à la CNIL, sur{' '}
          <a href="https://www.cnil.fr">cnil.fr</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
