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
  'Éditeur, hébergeur et données de shapepick. Pas de cookie, seulement un décompte anonyme des clics vers Amazon.'

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
      facts={['Aucun cookie', 'Aucun compte', 'Statistiques anonymes']}
    >
      <LegalSection id="editeur" n={1} title="Éditeur">
        {PUBLISHER ? (
          <>
            <p>shapepick est édité par {PUBLISHER.name}, qui dirige aussi sa publication.</p>
            <LegalFacts
              rows={[
                ['Nom', PUBLISHER.name],
                ['Adresse', PUBLISHER.address],
                [
                  'Téléphone',
                  <a href={`tel:${PUBLISHER.phone.replace(/\s/g, '')}`}>{PUBLISHER.phone}</a>,
                ],
                ...(PUBLISHER.registration ? ([['SIREN', PUBLISHER.registration]] as const) : []),
                ['Contact', mail],
              ]}
            />
          </>
        ) : (
          <>
            <p>
              shapepick est édité par un particulier. Son identité est connue de notre hébergeur,
              comme le permet la loi (LCEN, article 1-1).
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
          Netlify voit l’adresse IP de chaque visite pour servir les pages et protéger le site. Nous
          ne la gardons pas. Les photos des produits passent par notre site, votre navigateur ne
          contacte aucune marque.
        </p>
      </LegalSection>

      <LegalSection id="clics" n={3} title="Clics vers Amazon">
        <p>
          Quand vous ouvrez un lien vers Amazon, nous notons le clic. Cela nous montre quels modèles
          intéressent.
        </p>
        <LegalFacts
          rows={[
            [
              'Ce que nous notons',
              'Le produit, le type de lien et sa place, la page et sa langue, la date et l’heure, le pays, le type d’appareil.',
            ],
            [
              'Jamais',
              'Ni adresse IP, ni cookie, ni identifiant. Nous ne savons pas qui a cliqué.',
            ],
            ['Où', 'Notre base de données, chez Neon, à Francfort.'],
            ['Durée', `${KEPT.clicks} mois`],
          ]}
        />
      </LegalSection>

      <LegalSection id="amazon" n={4} title="Liens vers Amazon.fr">
        {AMAZON_PARTNER_TAG ? (
          <>
            <p>
              Les liens vers Amazon.fr sont des liens affiliés. Si vous achetez après un clic,
              Amazon nous verse une commission. Votre prix ne change pas. Le classement n’en tient
              pas compte, il dépend seulement de vos réponses et des fiches produits.
            </p>
            <p>
              <strong>{m.amazonNotice.fr}</strong>
            </p>
          </>
        ) : (
          <p>
            Les liens vers Amazon.fr sont de simples liens. Nous ne touchons rien sur vos achats.
          </p>
        )}
        <p>Sur Amazon.fr, la politique de confidentialité d’Amazon s’applique.</p>
      </LegalSection>

      <LegalSection id="stockage" n={5} title="Dans votre navigateur">
        <p>
          Votre navigateur garde vos réponses à chaque questionnaire et les astuces déjà vues, pour
          votre prochaine visite. Elles restent sur votre appareil.
        </p>
        <p>Pour les effacer, supprimez les données du site dans les réglages du navigateur.</p>
      </LegalSection>

      <LegalSection id="produits" n={6} title="Produits et marques">
        <p>
          Les caractéristiques viennent des fabricants et de la presse spécialisée. Les prix sont
          indicatifs, seul le prix du vendeur fait foi. Vérifiez sa fiche avant d’acheter, et
          signalez-nous toute erreur.
        </p>
        <p>
          Les noms, marques et photos appartiennent à leurs propriétaires. Ils servent seulement à
          identifier les modèles.
        </p>
      </LegalSection>

      <LegalSection id="contact" n={7} title="Contact et droits">
        <p>
          Une question, une erreur, une demande sur vos données (accès, effacement, opposition) ?
          Écrivez-nous à {mail}. Vous pouvez aussi saisir la CNIL sur{' '}
          <a href="https://www.cnil.fr">cnil.fr</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
