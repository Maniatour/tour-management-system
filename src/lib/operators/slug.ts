const RESERVED_SLUGS = new Set([
  'kovegas',
  'admin',
  'api',
  'www',
  'app',
  'mail',
  'support',
  'help',
  'status',
  'cdn',
  'static',
  'assets',
  'null',
  'undefined',
])

export function normalizeOperatorSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function validateOperatorSlug(slug: string): string | null {
  const normalized = normalizeOperatorSlug(slug)
  if (normalized.length < 3 || normalized.length > 48) {
    return 'Slug must be 3–48 characters.'
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return 'Slug may only contain lowercase letters, numbers, and hyphens.'
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return `Slug "${normalized}" is reserved.`
  }
  return null
}
