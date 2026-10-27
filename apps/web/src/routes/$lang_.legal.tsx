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

// The legal notice and privacy page in English ($lang_.mentions-legales.tsx is the French one): a
// page of text rendered by the server, outside the locale's layout (no catalogue, no canvas, no
// preloader). The sitemap leaves it out.

const TITLE = 'Legal notice and privacy'
const DESCRIPTION = UMAMI_WEBSITE_ID
  ? 'Publisher, host and data of shapepick. No cookies: anonymous audience measurement and a count of clicks to Amazon.'
  : 'Publisher, host and data of shapepick. No cookies, only an anonymous count of clicks to Amazon.'

/** The audience section, once the site counts its visits (site.ts), and the numbers after it. */
const AUDIENCE = UMAMI_WEBSITE_ID !== ''
const after = AUDIENCE ? 1 : 0

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

      {AUDIENCE && (
        <LegalSection id="audience" n={3} title="Audience measurement">
          <p>
            To learn which pages help and what visitors look for, we count visits with Umami Cloud,
            a tool without cookies. The figures are anonymous and only for shapepick.
          </p>
          <LegalFacts
            rows={[
              [
                'What we count',
                'Pages viewed, your answers to the questionnaire, clicks to Amazon, the site you came from, your browser and kind of device, the language, an approximate location (country, region, city).',
              ],
              [
                'Never',
                'No cookie, no IP address kept, no lasting identifier. No one can tell who you are or follow you to other sites.',
              ],
              [
                'Provider',
                'Umami Software, Inc. (United States), for shapepick, on servers in the European Union and the United States.',
              ],
              ['Kept for', `${KEPT.audience} months`],
              ['Legal basis', 'Our legitimate interest in measuring the site’s audience.'],
            ]}
          />
          <AudienceSwitch locale="en" />
        </LegalSection>
      )}

      <LegalSection id="clicks" n={3 + after} title="Clicks to Amazon">
        <p>
          When you open a link to Amazon, we log the click. It shows us which models people look at.
        </p>
        <LegalFacts
          rows={[
            [
              'What we log',
              'The shop, the product, the kind of link and where it sat, the page and its language, the date and time, the country, the kind of device.',
            ],
            ['Never', 'No IP address, no cookie, no identifier. We don’t know who clicked.'],
            ['Where', 'Our database, at Neon, in Frankfurt.'],
            ['Kept for', `${KEPT.clicks} months`],
          ]}
        />
      </LegalSection>

      <LegalSection id="amazon" n={4 + after} title="Links to Amazon">
        {AMAZON_US_TAG && (
          <p>
            From France, its overseas territories, Belgium, Luxembourg and Monaco, links lead to
            Amazon.fr. Elsewhere, to Amazon.com. Your device’s time zone is enough to choose, we
            don’t keep it.
          </p>
        )}
        {AMAZON_PARTNER_TAG ? (
          <>
            <p>
              Links to Amazon are affiliate links. If you buy after a click, Amazon pays us a
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
        <p>On Amazon, Amazon’s privacy policy applies.</p>
      </LegalSection>

      <LegalSection id="storage" n={5 + after} title="In your browser">
        <p>
          Your browser keeps your answers to each questionnaire and the tips you’ve seen, for your
          next visit. They stay on your device.
        </p>
        {AUDIENCE && <p>It also keeps your choice to count your visits or not.</p>}
        <p>To clear them, delete the site’s data in your browser settings.</p>
      </LegalSection>

      <LegalSection id="products" n={6 + after} title="Products and brands">
        <p>
          Specs come from the makers and the specialist press. Prices are indicative, only the
          seller’s price counts. Check their page before you buy, and tell us about any mistake.
        </p>
        <p>
          Product names, brands and photos belong to their owners. They only serve to identify the
          models.
        </p>
      </LegalSection>

      <LegalSection id="contact" n={7 + after} title="Contact and your rights">
        <p>
          A question, a mistake, a request about your data (access, erasure, objection)? Write to{' '}
          {mail}. You can also contact the CNIL, the French data protection authority, at{' '}
          <a href="https://www.cnil.fr/en">cnil.fr</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
