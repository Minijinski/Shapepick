import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import {
  AudienceSwitch,
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
import { AMAZON_PARTNER_TAG, AMAZON_US_TAG } from '~/features/product/shops'
import { messages as m } from '~/i18n/messages'
import { pageHead } from '~/seo'
import { UMAMI_WEBSITE_ID } from '~/site'

// The legal notice and privacy page in French ($lang_.legal.tsx is the English one): a page of text
// rendered by the server, outside the locale's layout (no catalogue, no canvas, no preloader). The
// sitemap leaves it out.

const TITLE = 'Mentions légales et confidentialité'
const DESCRIPTION = UMAMI_WEBSITE_ID
  ? 'Éditeur, hébergeur et données de shapepick. Pas de cookie : une mesure d’audience anonyme et un décompte des clics vers Amazon.'
  : 'Éditeur, hébergeur et données de shapepick. Pas de cookie, seulement un décompte anonyme des clics vers Amazon.'

/** The audience section, once the site counts its visits (site.ts), and the numbers after it. */
const AUDIENCE = UMAMI_WEBSITE_ID !== ''
const after = AUDIENCE ? 1 : 0

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

      {AUDIENCE && (
        <LegalSection id="audience" n={3} title="Mesure d’audience">
          <p>
            Pour savoir quelles pages servent et ce que les visiteurs cherchent, nous comptons les
            visites avec Umami Cloud, un outil sans cookie. Les chiffres sont anonymes et ne servent
            qu’à shapepick.
          </p>
          <LegalFacts
            rows={[
              [
                'Ce que nous comptons',
                'Les pages vues, vos réponses au questionnaire, les clics vers Amazon, le site d’où vous venez, le navigateur et le type d’appareil, la langue, une localisation approximative (pays, région, ville).',
              ],
              [
                'Jamais',
                'Ni cookie, ni adresse IP gardée, ni identifiant durable. Personne ne peut savoir qui vous êtes ni vous suivre sur d’autres sites.',
              ],
              [
                'Prestataire',
                'Umami Software, Inc. (États-Unis), pour shapepick, sur des serveurs dans l’Union européenne et aux États-Unis.',
              ],
              ['Durée', `${KEPT.audience} mois`],
              ['Base légale', 'Notre intérêt légitime à mesurer l’audience du site.'],
            ]}
          />
          <AudienceSwitch locale="fr" />
        </LegalSection>
      )}

      <LegalSection id="clics" n={3 + after} title="Clics vers Amazon">
        <p>
          Quand vous ouvrez un lien vers Amazon, nous notons le clic. Cela nous montre quels modèles
          intéressent.
        </p>
        <LegalFacts
          rows={[
            [
              'Ce que nous notons',
              'La boutique, le produit, le type de lien et sa place, la page et sa langue, la date et l’heure, le pays, le type d’appareil.',
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

      <LegalSection id="amazon" n={4 + after} title="Liens vers Amazon">
        {AMAZON_US_TAG && (
          <p>
            Depuis la France, l’outre-mer, la Belgique, le Luxembourg et Monaco, les liens mènent à
            Amazon.fr. Ailleurs, à Amazon.com. Le fuseau horaire de votre appareil suffit à choisir,
            nous ne le gardons pas.
          </p>
        )}
        {AMAZON_PARTNER_TAG ? (
          <>
            <p>
              Les liens vers Amazon sont des liens affiliés. Si vous achetez après un clic, Amazon
              nous verse une commission. Votre prix ne change pas. Le classement n’en tient pas
              compte, il dépend seulement de vos réponses et des fiches produits.
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
        <p>Sur Amazon, la politique de confidentialité d’Amazon s’applique.</p>
      </LegalSection>

      <LegalSection id="stockage" n={5 + after} title="Dans votre navigateur">
        <p>
          Votre navigateur garde vos réponses à chaque questionnaire et les astuces déjà vues, pour
          votre prochaine visite. Elles restent sur votre appareil.
        </p>
        {AUDIENCE && <p>Il garde aussi votre choix de compter ou non vos visites.</p>}
        <p>Pour les effacer, supprimez les données du site dans les réglages du navigateur.</p>
      </LegalSection>

      <LegalSection id="produits" n={6 + after} title="Produits et marques">
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

      <LegalSection id="contact" n={7 + after} title="Contact et droits">
        <p>
          Une question, une erreur, une demande sur vos données (accès, effacement, opposition) ?
          Écrivez-nous à {mail}. Vous pouvez aussi saisir la CNIL sur{' '}
          <a href="https://www.cnil.fr">cnil.fr</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
