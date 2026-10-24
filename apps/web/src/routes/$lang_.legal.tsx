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
import { AMAZON_PARTNER_TAG } from '~/features/product/shops'
import { messages as m } from '~/i18n/messages'
import { pageHead } from '~/seo'

// The legal notice and privacy page in English ($lang_.mentions-legales.tsx is the French one): a
// page of text rendered by the server, outside the locale's layout (no catalogue, no canvas, no
// preloader). The sitemap leaves it out.

const TITLE = 'Legal notice and privacy'
const DESCRIPTION =
  'Who publishes shapepick, who hosts it and what the site keeps of your visits: no cookies, anonymous audience measurement and a count of clicks to Amazon, with no personal data.'

export const Route = createFileRoute('/$lang_/legal')({
  // In English only: in French the page has a name of its own, in any other language there is none.
  beforeLoad: ({ params }) => {
    if (params.lang === 'fr') {
      throw redirect({ to: '/$lang/mentions-legales', params: { lang: 'fr' }, statusCode: 301 })
    }
    if (params.lang !== 'en') throw notFound()
  },
  head: () => pageHead({ locale: 'en', paths: legalPaths, title: TITLE, description: DESCRIPTION }),
  headers: () => legalHeaders,
  component: Legal,
})

function Legal() {
  const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
  return (
    <LegalPage
      locale="en"
      title={TITLE}
      lead="Who publishes shapepick, who hosts it, and what the site keeps of your visits."
      facts={['No cookies', 'No account', 'Anonymous statistics']}
    >
      <LegalSection id="publisher" n={1} title="Publisher">
        {PUBLISHER ? (
          <>
            <p>shapepick is published by {PUBLISHER.name}, who is also its publication director.</p>
            <LegalFacts
              rows={[
                ['Publisher', PUBLISHER.name],
                ['Address', PUBLISHER.address],
                ['Phone', PUBLISHER.phone],
                ['Contact', mail],
              ]}
            />
          </>
        ) : (
          <>
            <p>
              shapepick is published by a private individual, not as a business. As French law
              allows (loi pour la confiance dans l’économie numérique, article 1-1), their identity
              is not published here: it has been given to the site’s host, below.
            </p>
            <LegalFacts rows={[['Contact', mail]]} />
          </>
        )}
      </LegalSection>

      <LegalSection id="hosting" n={2} title="Hosting">
        <LegalFacts
          rows={[
            [
              'Site',
              <>
                {HOST.name}
                <br />
                {HOST.address}, United States
                <br />
                <a href={HOST.url}>netlify.com</a>
              </>,
            ],
            [
              'Database',
              <>
                {DATABASE.name}
                <br />
                {DATABASE.address}, United States
                <br />
                Data stored in Frankfurt, Germany
              </>,
            ],
          ]}
        />
        <p>
          Like any host, Netlify handles the IP address of each visit to deliver pages and protect
          the site; shapepick does not record it anywhere. Product photos are served by the site
          itself: your browser never contacts a brand’s website.
        </p>
      </LegalSection>

      <LegalSection id="audience" n={3} title="Audience measurement">
        <p>
          To learn which pages help and which to improve, shapepick counts its visits with Umami
          Cloud, an audience measurement tool that uses no cookies. These statistics are anonymous,
          for shapepick alone, and never combined with other data.
        </p>
        <LegalFacts
          rows={[
            [
              'Counted',
              'Pages viewed, without your answers to the questionnaire; the site you came from; your browser, system and kind of device; screen size and language; an approximate location (country, region, city); clicks to Amazon.',
            ],
            [
              'Never',
              'No cookie, no stored IP address, no lasting identifier: there is no way to follow you from site to site or to know who you are.',
            ],
            [
              'Provider',
              'Umami Software, Inc. (United States), on behalf of shapepick, on servers in the European Union and the United States.',
            ],
            ['Kept for', `${KEPT.audience} months`],
            ['Legal basis', 'shapepick’s legitimate interest in measuring its audience.'],
          ]}
        />
        <AudienceSwitch locale="en" />
      </LegalSection>

      <LegalSection id="clicks" n={4} title="Clicks to Amazon">
        <p>
          When you open a link to Amazon, the site also notes the click in its own database, to
          learn which models people look at and which links help.
        </p>
        <LegalFacts
          rows={[
            [
              'Noted',
              'The product, where the link sat on the page, the kind of link (product page or search), the site’s language and page, the date and time, the country and the kind of device (mobile or computer).',
            ],
            [
              'Never',
              'No IP address, no cookie, no identifier: there is no way to know who clicked.',
            ],
            ['Where', 'shapepick’s database, at Neon in Frankfurt.'],
            ['Kept for', `${KEPT.clicks} months`],
          ]}
        />
      </LegalSection>

      <LegalSection id="amazon" n={5} title="Links to Amazon.fr">
        {AMAZON_PARTNER_TAG ? (
          <>
            <p>
              The “View on Amazon” and “Search on Amazon” links lead to Amazon.fr. shapepick takes
              part in the Amazon Associates programme: these are affiliate links, and Amazon pays it
              a commission on purchases made after a click, at no extra cost to you. Commissions
              play no part in the ranking: it depends only on your answers and the products’ specs.
            </p>
            <p>
              <strong>{m.amazonNotice.en}</strong>
            </p>
          </>
        ) : (
          <>
            <p>
              The “View on Amazon” and “Search on Amazon” links lead to Amazon.fr. They are plain
              links: shapepick earns nothing from your purchases.
            </p>
            <p>
              Should the site join the Amazon Associates programme, these links will become
              affiliate links: Amazon will pay it a commission on purchases made after a click, at
              no extra cost to you. This page and the product sheets will then say so.
            </p>
          </>
        )}
        <p>On Amazon.fr, Amazon’s own privacy rules apply.</p>
      </LegalSection>

      <LegalSection id="storage" n={6} title="Storage in your browser">
        <p>
          To save you time, the site keeps a little in your browser (local storage): your answers to
          each category’s questionnaire, so you find them on your next visit, and the hints you have
          already seen, so they are not repeated. None of it ever leaves your device.
        </p>
        <p>You can clear it at any time by deleting the site’s data in your browser’s settings.</p>
      </LegalSection>

      <LegalSection id="products" n={7} title="Products and brands">
        <p>
          Specifications come from the makers and the specialist press. Prices are typical public
          prices, not offers: only the seller’s price counts. Despite our care, mistakes happen:
          check the seller’s page before you buy, and write to us if you spot one.
        </p>
        <p>
          Product names, brands and photos belong to their owners; they are only used to identify
          the models compared.
        </p>
      </LegalSection>

      <LegalSection id="contact" n={8} title="Contact and your rights">
        <p>
          A question, a mistake to report, a request about your data (access, erasure, objection):
          write to {mail}. You can also lodge a complaint with the CNIL, the French data protection
          authority, at <a href="https://www.cnil.fr/en">cnil.fr</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
