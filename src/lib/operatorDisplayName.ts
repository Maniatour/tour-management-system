/** Compact admin header label; use `title` or tooltip for the full operator name. */
export function shortOperatorDisplayName(name: string, slug?: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'Kovegas'
  if (slug === 'kovegas' || /^kovegas\b/i.test(trimmed)) return 'Kovegas'

  const beforeSlash = trimmed.split(/\s*\/\s*/)[0]?.trim()
  if (beforeSlash) return beforeSlash

  if (trimmed.length > 12) return `${trimmed.slice(0, 10)}…`
  return trimmed
}
