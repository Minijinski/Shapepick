import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { negotiateLocale } from '~/i18n/locale'

const detectLocale = createServerFn({ method: 'GET' }).handler(() =>
  negotiateLocale(getRequestHeader('accept-language')),
)

// "/" has no content of its own: it sends the visitor to /fr or /en.
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const lang =
      typeof window === 'undefined' ? await detectLocale() : negotiateLocale(navigator.language)
    throw redirect({ to: '/$lang', params: { lang }, statusCode: 302 })
  },
})
