import { parseListingHtml, type ParsedListingOffer } from './parseListing'

const FETCH_TIMEOUT_MS = 12_000
const USER_AGENT =
  'Mozilla/5.0 (compatible; KovegasMarketResearch/1.0; +https://www.kovegas.com)'

export type ListingFetchResult =
  | { ok: true; offer: ParsedListingOffer; status: number }
  | { ok: false; reason: 'http_error' | 'parse_failed'; status?: number; message: string }

export async function fetchPublicListing(
  url: string,
  fetcher: typeof fetch = fetch
): Promise<ListingFetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetcher(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': USER_AGENT,
      },
    })
    if (!response.ok) {
      return {
        ok: false,
        reason: 'http_error',
        status: response.status,
        message: `HTTP ${response.status}`,
      }
    }
    const html = await response.text()
    const offer = parseListingHtml(html)
    if (!offer) {
      return {
        ok: false,
        reason: 'parse_failed',
        status: response.status,
        message: 'JSON-LD Offer not found',
      }
    }
    return { ok: true, offer, status: response.status }
  } catch (error) {
    return {
      ok: false,
      reason: 'http_error',
      message: error instanceof Error ? error.message : 'fetch failed',
    }
  } finally {
    clearTimeout(timer)
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
