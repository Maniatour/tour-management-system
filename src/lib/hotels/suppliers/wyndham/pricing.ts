/**
 * Wyndham SRP shows "FROM $X" as the nightly rate before taxes & fees.
 * Ops compare against booked all-in unit prices, so we convert to total.
 *
 * Example: $81.84 + $13.82 taxes/fees = $95.66
 * Default markup ≈ 16.89% of base (override with WYNDHAM_TAX_FEE_PERCENT).
 */

export function wyndhamTaxFeeRate(): number {
  const pct = Number(process.env.WYNDHAM_TAX_FEE_PERCENT ?? '16.89')
  if (!Number.isFinite(pct) || pct < 0) return 0.1689
  return pct / 100
}

export function roundMoneyUsd(amount: number): number {
  return Math.round(amount * 100) / 100
}

export type WyndhamAllInPrice = {
  basePrice: number
  taxesAndFees: number
  totalPrice: number
  /** true when taxes came from page scrape, not the default % */
  taxesFromPage: boolean
}

/**
 * Convert a scraped base (FROM $) rate into all-in price for comparison/storage.
 */
export function toWyndhamAllInPrice(
  basePrice: number,
  scrapedTaxesAndFees?: number | null
): WyndhamAllInPrice {
  const base = roundMoneyUsd(basePrice)
  if (!(base > 0)) {
    return { basePrice: 0, taxesAndFees: 0, totalPrice: 0, taxesFromPage: false }
  }

  if (
    scrapedTaxesAndFees != null &&
    Number.isFinite(scrapedTaxesAndFees) &&
    scrapedTaxesAndFees >= 0
  ) {
    const taxesAndFees = roundMoneyUsd(scrapedTaxesAndFees)
    return {
      basePrice: base,
      taxesAndFees,
      totalPrice: roundMoneyUsd(base + taxesAndFees),
      taxesFromPage: true,
    }
  }

  const taxesAndFees = roundMoneyUsd(base * wyndhamTaxFeeRate())
  return {
    basePrice: base,
    taxesAndFees,
    totalPrice: roundMoneyUsd(base + taxesAndFees),
    taxesFromPage: false,
  }
}
