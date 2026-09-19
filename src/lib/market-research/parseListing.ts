export type ParsedListingOffer = {
  title: string | null
  currency: string
  price: number
  rating: number | null
  reviewCount: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value]
}

function parseMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100) / 100
  }
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100
  }
  return null
}

function parseCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  }
  return null
}

function typeIncludes(node: Record<string, unknown>, typeName: string): boolean {
  const raw = node['@type']
  const types = asArray(raw).map((t) => String(t).toLowerCase())
  return types.includes(typeName.toLowerCase())
}

function collectNodes(root: unknown, bag: Record<string, unknown>[]): void {
  if (Array.isArray(root)) {
    for (const item of root) collectNodes(item, bag)
    return
  }
  const rec = asRecord(root)
  if (!rec) return
  bag.push(rec)
  if (rec['@graph']) collectNodes(rec['@graph'], bag)
  if (rec.offers) collectNodes(rec.offers, bag)
  if (rec.itemOffered) collectNodes(rec.itemOffered, bag)
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const raw = match[1].trim()
    if (!raw) continue
    try {
      blocks.push(JSON.parse(raw))
    } catch {
      /* malformed ld+json */
    }
  }
  return blocks
}

function offerPrice(node: Record<string, unknown>): { price: number; currency: string } | null {
  const price =
    parseMoney(node.lowPrice) ??
    parseMoney(node.price) ??
    parseMoney(node.highPrice) ??
    parseMoney(asRecord(node.priceSpecification)?.price)
  if (price == null) return null
  const currency =
    String(node.priceCurrency || asRecord(node.priceSpecification)?.priceCurrency || 'USD')
      .trim()
      .toUpperCase() || 'USD'
  return { price, currency }
}

function ratingFrom(node: Record<string, unknown>): { rating: number | null; reviewCount: number | null } {
  const agg = asRecord(node.aggregateRating) || (typeIncludes(node, 'AggregateRating') ? node : null)
  if (!agg) return { rating: null, reviewCount: null }
  return {
    rating: parseMoney(agg.ratingValue),
    reviewCount: parseCount(agg.reviewCount ?? agg.ratingCount),
  }
}

/**
 * Best-effort public listing parse. JSON-LD Offer / AggregateOffer first.
 * A single From price cannot split Lower vs X — caller decides axis mapping.
 */
export function parseListingHtml(html: string): ParsedListingOffer | null {
  if (!html.trim()) return null
  const nodes: Record<string, unknown>[] = []
  for (const block of extractJsonLdBlocks(html)) collectNodes(block, nodes)

  let title: string | null = null
  let rating: number | null = null
  let reviewCount: number | null = null
  let best: { price: number; currency: string } | null = null

  for (const node of nodes) {
    if (!title && typeof node.name === 'string' && node.name.trim()) title = node.name.trim()
    const rated = ratingFrom(node)
    if (rating == null && rated.rating != null) rating = rated.rating
    if (reviewCount == null && rated.reviewCount != null) reviewCount = rated.reviewCount
    if (typeIncludes(node, 'Offer') || typeIncludes(node, 'AggregateOffer')) {
      const found = offerPrice(node)
      if (found && (!best || found.price < best.price)) best = found
    }
  }

  if (!best) {
    for (const node of nodes) {
      const found = offerPrice(node)
      if (found && (!best || found.price < best.price)) best = found
    }
  }

  if (!best) return null
  return {
    title,
    currency: best.currency,
    price: best.price,
    rating,
    reviewCount,
  }
}
