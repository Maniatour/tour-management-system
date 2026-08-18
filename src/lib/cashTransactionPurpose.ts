export type CashDirectEntryKind = 'deposit' | 'withdrawal' | 'bank_deposit'

export const PROFIT_SHARE_CATEGORY = 'Profit Share'
export const BANK_DEPOSIT_DESCRIPTION = '은행 Deposit'

export function isBankDepositDescription(description: string | null | undefined): boolean {
  const d = (description ?? '').trim()
  return d === BANK_DEPOSIT_DESCRIPTION || d.includes(BANK_DEPOSIT_DESCRIPTION)
}

export function presetCashDirectEntry(kind: CashDirectEntryKind): {
  transaction_type: CashDirectEntryKind
  description: string
  category: string
} {
  if (kind === 'bank_deposit') {
    return {
      transaction_type: 'bank_deposit',
      description: BANK_DEPOSIT_DESCRIPTION,
      category: '',
    }
  }
  if (kind === 'withdrawal') {
    return {
      transaction_type: 'withdrawal',
      description: PROFIT_SHARE_CATEGORY,
      category: PROFIT_SHARE_CATEGORY,
    }
  }
  return { transaction_type: 'deposit', description: '', category: '' }
}

export function ensureBankDepositDescription(
  kind: CashDirectEntryKind,
  description: string
): string {
  const d = description.trim()
  if (kind !== 'bank_deposit') return d
  if (!d) return BANK_DEPOSIT_DESCRIPTION
  if (d.includes(BANK_DEPOSIT_DESCRIPTION)) return d
  return `${BANK_DEPOSIT_DESCRIPTION} - ${d}`
}

export type ProfitSharePartner = 'chad' | 'joey' | 'split' | 'other'

export const PROFIT_SHARE_PARTNERS = ['Chad', 'Joey'] as const
export const PROFIT_SHARE_SPLIT_PAID_TO = 'Chad, Joey'
export const PROFIT_SHARE_PAID_TO_PRESETS = ['Chad', 'Joey', PROFIT_SHARE_SPLIT_PAID_TO] as const

export type ProfitShareExcludeFormFields = {
  profit_share_excluded: boolean
}

export function emptyProfitShareExcludeForm(): ProfitShareExcludeFormFields {
  return { profit_share_excluded: false }
}

export function isProfitShareExcluded(tx: {
  profit_share_excluded?: boolean | null
  offset_paid_to?: string | null
}): boolean {
  if (tx.profit_share_excluded) return true
  return Boolean((tx.offset_paid_to ?? '').trim())
}

export function excludeFormFromTransaction(tx: {
  profit_share_excluded?: boolean | null
  offset_paid_to?: string | null
}): ProfitShareExcludeFormFields {
  return { profit_share_excluded: isProfitShareExcluded(tx) }
}

export type ProfitShareSplitDbFields = {
  share_chad_amount: number | null
  share_joey_amount: number | null
}

export type ProfitShareSplitFormFields = {
  share_chad_amount: string
  share_joey_amount: string
}

export function emptyProfitShareSplitForm(): ProfitShareSplitFormFields {
  return { share_chad_amount: '', share_joey_amount: '' }
}

export function formatShareInput(amount: number): string {
  if (!Number.isFinite(amount)) return ''
  return String(Math.round(amount * 100) / 100)
}

export function splitAmountInHalf(amount: number): { chad: number; joey: number } {
  const rounded = Math.round(amount * 100) / 100
  const chad = Math.round((rounded / 2) * 100) / 100
  const joey = Math.round((rounded - chad) * 100) / 100
  return { chad, joey }
}

export function resolveProfitShareSplitShares(tx: {
  amount: number
  share_chad_amount?: number | null | undefined
  share_joey_amount?: number | null | undefined
}): { chad: number; joey: number; saved: boolean } {
  const chadShare = Number(tx.share_chad_amount)
  const joeyShare = Number(tx.share_joey_amount)
  if (
    Number.isFinite(chadShare) &&
    Number.isFinite(joeyShare) &&
    chadShare >= -0.0001 &&
    joeyShare >= -0.0001 &&
    chadShare + joeyShare > 0.005
  ) {
    return { chad: chadShare, joey: joeyShare, saved: true }
  }
  return { ...splitAmountInHalf(tx.amount), saved: false }
}

export function splitFormFromTransaction(tx: {
  amount: number
  share_chad_amount?: number | null
  share_joey_amount?: number | null
}): ProfitShareSplitFormFields {
  const shares = resolveProfitShareSplitShares(tx)
  return {
    share_chad_amount: formatShareInput(shares.chad),
    share_joey_amount: formatShareInput(shares.joey),
  }
}

export function applyProfitShareSplitHalves<
  T extends { amount: string } & ProfitShareSplitFormFields,
>(form: T, nextAmount = form.amount): T {
  const amt = parseFloat(nextAmount)
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ...form, amount: nextAmount }
  }
  const half = splitAmountInHalf(amt)
  return {
    ...form,
    amount: nextAmount,
    share_chad_amount: formatShareInput(half.chad),
    share_joey_amount: formatShareInput(half.joey),
  }
}

export function applyProfitSharePaidToChange<
  T extends { paid_to: string; amount: string } & ProfitShareSplitFormFields,
>(form: T, paid_to: string): T {
  const isSplit = classifyProfitSharePartner(paid_to) === 'split'
  if (isSplit) {
    return {
      ...applyProfitShareSplitHalves(form),
      paid_to,
    }
  }
  return {
    ...form,
    paid_to,
    ...emptyProfitShareSplitForm(),
  }
}

export function resolveProfitShareSplitPayload(input: {
  isSplit: boolean
  cashAmount: number
  shareChad: string
  shareJoey: string
}): { ok: false; error: string } | { ok: true; fields: ProfitShareSplitDbFields } {
  if (!input.isSplit) {
    return { ok: true, fields: { share_chad_amount: null, share_joey_amount: null } }
  }
  const chadRaw = input.shareChad.trim()
  const joeyRaw = input.shareJoey.trim()
  const half = splitAmountInHalf(input.cashAmount)
  const chad = chadRaw === '' ? half.chad : parseFloat(chadRaw)
  const joey = joeyRaw === '' ? half.joey : parseFloat(joeyRaw)
  if (!Number.isFinite(chad) || !Number.isFinite(joey) || chad < 0 || joey < 0) {
    return { ok: false, error: '합산 기재의 Chad / Joey 금액을 입력해주세요.' }
  }
  if (Math.abs(chad + joey - input.cashAmount) > 0.02) {
    return { ok: false, error: `Chad와 Joey 금액 합이 현금 출금 $${input.cashAmount.toFixed(2)}와 같아야 합니다.` }
  }
  return {
    ok: true,
    fields: {
      share_chad_amount: Math.round(chad * 100) / 100,
      share_joey_amount: Math.round(joey * 100) / 100,
    },
  }
}

export function formatProfitShareSplitLabel(tx: {
  paid_to?: string | null
  description?: string | null
  amount: number
  share_chad_amount?: number | null
  share_joey_amount?: number | null
}): string | null {
  if (classifyProfitSharePartner(tx.paid_to) !== 'split') return null
  const shares = resolveProfitShareSplitShares(tx)
  const chad = shares.chad.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const joey = shares.joey.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `Chad $${chad} / Joey $${joey}`
}

export function formatProfitShareExcludeLabel(tx: {
  profit_share_excluded?: boolean | null
  offset_paid_to?: string | null
}): string | null {
  return isProfitShareExcluded(tx) ? '상계 · 50/50 제외' : null
}

export function summarizeProfitShareRows(
  rows: Array<{
    paid_to?: string | null
    description?: string | null
    amount: number
    profit_share_excluded?: boolean | null
    offset_paid_to?: string | null
    share_chad_amount?: number | null
    share_joey_amount?: number | null
  }>
) {
  let chad = 0
  let joey = 0
  let split = 0
  let other = 0
  let excluded = 0

  const credit = (partner: ProfitSharePartner, amount: number) => {
    if (partner === 'chad') chad += amount
    else if (partner === 'joey') joey += amount
    else if (partner === 'split') split += amount
    else other += amount
  }

  for (const tx of rows) {
    if (isProfitShareExcluded(tx)) {
      excluded += tx.amount
      continue
    }
    const paidToPartner = classifyProfitSharePartner(tx.paid_to)
    if (paidToPartner === 'split') {
      const shares = resolveProfitShareSplitShares({
        amount: tx.amount,
        share_chad_amount: tx.share_chad_amount,
        share_joey_amount: tx.share_joey_amount,
      })
      chad += shares.chad
      joey += shares.joey
      split += tx.amount
      continue
    }
    credit(classifyProfitSharePartner(tx.paid_to, tx.description), tx.amount)
  }

  const pairTotal = chad + joey
  const chadPct = pairTotal > 0.005 ? (chad / pairTotal) * 100 : 0
  const joeyPct = pairTotal > 0.005 ? (joey / pairTotal) * 100 : 0
  const gap = Math.abs(chad - joey)
  const unbalanced = pairTotal > 0.005 && Math.abs(chadPct - 50) > 5
  return {
    chad,
    joey,
    split,
    other,
    excluded,
    pairTotal,
    chadPct,
    joeyPct,
    gap,
    unbalanced,
    count: rows.length,
  }
}

export function classifyProfitSharePartner(
  paidTo: string | null | undefined,
  description?: string | null
): ProfitSharePartner {
  const s = `${paidTo ?? ''} ${description ?? ''}`.toLowerCase()
  const hasChad = /\bchad\b/.test(s)
  const hasJoey = /\bjoey\b/.test(s)
  if (hasChad && hasJoey) return 'split'
  if (hasChad) return 'chad'
  if (hasJoey) return 'joey'
  return 'other'
}

export function canToggleProfitShareExcluded(tx: {
  source?: string | null
  transaction_type: string
  description?: string | null
  category?: string | null
  paid_to?: string | null
}): boolean {
  if (tx.source && tx.source !== 'cash_transactions') return false
  if (tx.transaction_type !== 'withdrawal') return false
  if (isBankDepositDescription(tx.description)) return false
  return isLikelyProfitShareCashOut(tx)
}

export function isLikelyProfitShareCashOut(tx: {
  source?: string | null
  transaction_type: string
  description?: string | null
  category?: string | null
  paid_to?: string | null
}): boolean {
  if (tx.source && tx.source !== 'cash_transactions') return false
  if (tx.transaction_type !== 'withdrawal') return false
  if (isBankDepositDescription(tx.description)) return false
  const cat = (tx.category ?? '').trim().toLowerCase()
  if (cat === 'profit share') return true
  const partner = classifyProfitSharePartner(tx.paid_to, tx.description)
  return partner === 'chad' || partner === 'joey' || partner === 'split'
}

export function cashDirectEntryTitle(kind: CashDirectEntryKind, isEdit: boolean): string {
  if (isEdit) {
    if (kind === 'bank_deposit') return '은행 Deposit 수정'
    if (kind === 'withdrawal') return '지출 수정'
    return '입금 수정'
  }
  if (kind === 'bank_deposit') return '은행 Deposit 추가'
  if (kind === 'withdrawal') return '지출 추가'
  return '입금 추가'
}

export function cashDirectEntryDescription(kind: CashDirectEntryKind): string {
  if (kind === 'bank_deposit') {
    return '투어에서 받은 현금을 은행에 입금한 내역입니다. 현금 잔액에서 차감됩니다.'
  }
  if (kind === 'withdrawal') {
    return '운영비(회사·투어 지출)가 아닌 Profit Share 현금 지급입니다. 상계를 켜면 현금 잔액에는 남고 50/50 분배에서는 빠집니다.'
  }
  return '현금 입금 내역을 기록합니다.'
}
