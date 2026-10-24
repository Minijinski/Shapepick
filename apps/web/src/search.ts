// Search params stay plain strings (`?size=f75,f65&budget=0-150`): readable, shareable, and
// exactly what the finder engine expects. The default JSON encoding would quote every value. The
// router reads and writes them so; a link built by hand (from the catalogue's pages) too.

export const parseSearch = (search: string) => Object.fromEntries(new URLSearchParams(search))

export const stringifySearch = (search: Record<string, unknown>) => {
  const query = Object.entries(search)
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v)).replace(/%2C/gi, ',')}`,
    )
    .join('&')
  return query ? `?${query}` : ''
}
