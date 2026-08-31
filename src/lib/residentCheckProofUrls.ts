const MAX_PROOF_FILES = 20

function isHttpUrl(value: string): boolean {
  return value.startsWith('https://') || value.startsWith('http://')
}

/** Parse stored proof field: legacy single URL or JSON array of URLs. */
export function parseResidentCheckProofUrls(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return []
  const trimmed = value.trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string' && isHttpUrl(item.trim()))
          .map((item) => item.trim())
          .slice(0, MAX_PROOF_FILES)
      }
    } catch {
      /* fall through to single-URL handling */
    }
  }

  if (isHttpUrl(trimmed)) return [trimmed]
  return []
}

export function serializeResidentCheckProofUrls(urls: string[]): string | null {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const raw of urls) {
    const url = raw.trim()
    if (!isHttpUrl(url) || seen.has(url)) continue
    seen.add(url)
    unique.push(url)
    if (unique.length >= MAX_PROOF_FILES) break
  }
  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  return JSON.stringify(unique)
}

export function primaryResidentCheckProofUrl(value: unknown): string | null {
  return parseResidentCheckProofUrls(value)[0] ?? null
}

export function hasResidentCheckProof(value: unknown): boolean {
  return parseResidentCheckProofUrls(value).length > 0
}

export { MAX_PROOF_FILES }
