// Clicks on buy links (/api/out, see apps/web/src/routes/api/out.ts) come at a visitor's pace: more
// than 20 a minute from one address is no visitor, and gets a 429 from Netlify before it reaches
// the site's function or the database. Netlify applies the limit (`rateLimit`, one of the two rules
// the plan allows); this function only passes every other request on.

type Context = { next: () => Promise<Response> }

export default (_request: Request, context: Context) => context.next()

export const config = {
  path: '/api/out',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
