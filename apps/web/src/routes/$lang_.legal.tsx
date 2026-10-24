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

// The legal notice and privacy page in English ($lang_.mentions-legales.tsx is the French one): a
// page of text rendered by the server, outside the locale's layout (no catalogue, no canvas, no
// preloader). The sitemap leaves it out.

const TITLE = 'Legal notice and privacy'
const DESCRIPTION =
  'Publisher, host and data of shapepick. No cookies, only an anonymous count of clicks to Amazon.'

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
      facts={['No cookies', 'No account', 'Anonymous statistics']}
    >
      <LegalSection id="publisher" n={1} title="Publisher">
        {PUBLISHER ? (
          <>
            <p>shapepick is published by {PUBLISHER.name}, who is also its publication director.</p>
            <LegalFacts
              rows={[
                ['Name', PUBLISHER.name],
                ['Address', PUBLISHER.address],
                [
                  'Phone',
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
              shapepick is published by a private individual. Our host knows who they are, as French
              law allows (LCEN, article 1-1).
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
          Netlify sees the IP address of each visit to serve the pages and protect the site. We
          don’t keep it. Product photos come through our site, so your browser contacts no brand.
        </p>
      </LegalSection>

      <LegalSection id="clicks" n={3} title="Clicks to Amazon">
        <p>
          When you open a link to Amazon, we log the click. It shows us which models people look at.
        </p>
        <LegalFacts
          rows={[
            [
              'What we log',
              'The product, the kind of link and where it sat, the page and its language, the date and time, the country, the kind of device.',
            ],
            ['Never', 'No IP address, no cookie, no identifier. We don’t know who clicked.'],
            ['Where', 'Our database, at Neon, in Frankfurt.'],
            ['Kept for', `${KEPT.clicks} months`],
          ]}
        />
      </LegalSection>

      <LegalSection id="amazon" n={4} title="Links to Amazon.fr">
        {AMAZON_PARTNER_TAG ? (
          <>
            <p>
              Links to Amazon.fr are affiliate links. If you buy after a click, Amazon pays us a
              commission. Your price doesn’t change. The ranking ignores it, it depends only on your
              answers and the product sheets.
            </p>
            <p>
              <strong>{m.amazonNotice.en}</strong>
            </p>
          </>
        ) : (
          <p>Links to Amazon.fr are plain links. We earn nothing from your purchases.</p>
        )}
        <p>On Amazon.fr, Amazon’s privacy policy applies.</p>
      </LegalSection>

      <LegalSection id="storage" n={5} title="In your browser">
        <p>
          Your browser keeps your answers to each questionnaire and the tips you’ve seen, for your
          next visit. They stay on your device.
        </p>
        <p>To clear them, delete the site’s data in your browser settings.</p>
      </LegalSection>

      <LegalSection id="products" n={6} title="Products and brands">
        <p>
          Specs come from the makers and the specialist press. Prices are indicative, only the
          seller’s price counts. Check their page before you buy, and tell us about any mistake.
        </p>
        <p>
          Product names, brands and photos belong to their owners. They only serve to identify the
          models.
        </p>
      </LegalSection>

      <LegalSection id="contact" n={7} title="Contact and your rights">
        <p>
          A question, a mistake, a request about your data (access, erasure, objection)? Write to{' '}
          {mail}. You can also contact the CNIL, the French data protection authority, at{' '}
          <a href="https://www.cnil.fr/en">cnil.fr</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
