import {
  isBalanceReceivedPaymentStatus,
  isRefundedPaymentStatus,
  isReturnedPaymentStatus,
  paymentRecordAmountToNumber,
} from '@/utils/reservationPricingBalance'

/** 통합 PNL 입금 표 — 버킷 키 (상태별·현금별, 상호 배타) */
export type PnlDepositBucketKey =
  | 'deposit_received'
  | 'balance_received'
  | 'partner_received'
  | 'customer_cc_charged'
  | 'commission_received'
  | 'refunded'
  | 'returned'
  | 'other_inflow'
  | 'other_outflow'
  | 'cash_deposit'
  | 'cash_refund'

export type PnlDepositTableRow =
  | { kind: 'group'; rowKey: string; label: string }
  | {
      kind: 'bucket'
      rowKey: PnlDepositBucketKey
      label: string
      indent?: boolean
      /** true면 하단 「순합계」에 포함하지 않음 (현금 결제수단 요약용) */
      excludeFromNetTotal?: boolean
    }

export type PnlPaymentRecordLine = {
  id: string
  bucketKey: PnlDepositBucketKey
  yearMonth: string
  signedAmount: number
  submit_on: string | null
  reservation_id: string
  payment_status: string | null
  payment_method: string | null
  amount: number
  note: string | null
  submit_by: string | null
  isCashPaymentMethod: boolean
}

const CASH_INFLOW_STATUSES = new Set([
  'Deposit Received',
  'Balance Received',
  'Partner Received',
  "Customer's CC Charged",
  'Commission Received !',
])

function isCustomerCcChargedStatus(status: string): boolean {
  const s = status.trim().toLowerCase()
  return s.includes("customer's cc charged") || s.includes('customer cc charged')
}

function isCommissionReceivedStatus(status: string): boolean {
  const s = status.trim()
  return s === 'Commission Received !' || s.toLowerCase() === 'commission received !'
}

/** PaymentRecordsHistoryTab·잔액 산식과 동일한 부호 */
export function signedPaymentRecordAmount(
  amount: unknown,
  paymentStatus: string | null | undefined
): number {
  const v = paymentRecordAmountToNumber(amount)
  const status = (paymentStatus ?? '').trim()
  if (!status) return v
  if (isRefundedPaymentStatus(status) || isReturnedPaymentStatus(status)) {
    if (v === 0) return 0
    return -Math.abs(v)
  }
  if (status.toLowerCase() === 'deleted') {
    if (v === 0) return 0
    return -Math.abs(v)
  }
  return v
}

/** 상태 기준 단일 버킷 (현금 행과 별도) */
export function resolvePnlDepositStatusBucket(paymentStatus: string | null | undefined): PnlDepositBucketKey {
  const status = (paymentStatus ?? '').trim()
  if (!status) return 'other_inflow'
  if (isRefundedPaymentStatus(status)) return 'refunded'
  if (isReturnedPaymentStatus(status)) return 'returned'
  if (status === 'Deposit Received') return 'deposit_received'
  if (isBalanceReceivedPaymentStatus(status)) return 'balance_received'
  if (status === 'Partner Received') return 'partner_received'
  if (isCustomerCcChargedStatus(status)) return 'customer_cc_charged'
  if (isCommissionReceivedStatus(status)) return 'commission_received'

  const signed = signedPaymentRecordAmount(1, status)
  return signed < 0 ? 'other_outflow' : 'other_inflow'
}

export function resolvePnlDepositCashBucket(
  paymentStatus: string | null | undefined,
  signedAmount: number
): PnlDepositBucketKey | null {
  if (signedAmount > 0.005 && CASH_INFLOW_STATUSES.has((paymentStatus ?? '').trim())) {
    return 'cash_deposit'
  }
  if (signedAmount < -0.005) return 'cash_refund'
  return null
}

export function buildPnlDepositTableRows(locale: string): PnlDepositTableRow[] {
  const ko = !locale.startsWith('en')
  return [
    { kind: 'group', rowKey: 'grp-inflow', label: ko ? '입금' : 'Deposits' },
    {
      kind: 'bucket',
      rowKey: 'deposit_received',
      label: ko ? '예약금 입금 (Deposit Received)' : 'Deposit Received',
      indent: true,
    },
    {
      kind: 'bucket',
      rowKey: 'balance_received',
      label: ko ? '잔금 입금 (Balance Received)' : 'Balance Received',
      indent: true,
    },
    {
      kind: 'bucket',
      rowKey: 'partner_received',
      label: ko ? '파트너 입금 (Partner Received)' : 'Partner Received',
      indent: true,
    },
    {
      kind: 'bucket',
      rowKey: 'customer_cc_charged',
      label: ko ? "고객 카드 청구 (Customer's CC Charged)" : "Customer's CC Charged",
      indent: true,
    },
    {
      kind: 'bucket',
      rowKey: 'commission_received',
      label: ko ? '커미션 수령 (Commission Received)' : 'Commission Received',
      indent: true,
    },
    {
      kind: 'bucket',
      rowKey: 'other_inflow',
      label: ko ? '기타 입금' : 'Other inflows',
      indent: true,
    },
    { kind: 'group', rowKey: 'grp-refund', label: ko ? '환불' : 'Refunds' },
    {
      kind: 'bucket',
      rowKey: 'refunded',
      label: ko ? '환불 (우리 · Refunded)' : 'Refunded (us)',
      indent: true,
    },
    {
      kind: 'bucket',
      rowKey: 'returned',
      label: ko ? '환불 (파트너 · Returned)' : 'Returned (partner)',
      indent: true,
    },
    {
      kind: 'bucket',
      rowKey: 'other_outflow',
      label: ko ? '기타 환불·차감' : 'Other refunds',
      indent: true,
    },
    { kind: 'group', rowKey: 'grp-cash', label: ko ? '현금 결제수단' : 'Cash payment method' },
    {
      kind: 'bucket',
      rowKey: 'cash_deposit',
      label: ko ? '현금 입금' : 'Cash deposits',
      indent: true,
      excludeFromNetTotal: true,
    },
    {
      kind: 'bucket',
      rowKey: 'cash_refund',
      label: ko ? '현금 환불' : 'Cash refunds',
      indent: true,
      excludeFromNetTotal: true,
    },
  ]
}

export function yearMonthFromSubmitOn(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

export function enumerateMonthsInclusive(startYmd: string, endYmd: string): string[] {
  const s = new Date(startYmd + 'T00:00:00')
  const e = new Date(endYmd + 'T23:59:59')
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return []
  const out: string[] = []
  const cur = new Date(s.getFullYear(), s.getMonth(), 1)
  const endM = new Date(e.getFullYear(), e.getMonth(), 1)
  while (cur <= endM) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

export function formatPnlMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10))
  if (!y || !m) return ym
  return `${y}년 ${m}월`
}

export function formatPnlMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

type RawPaymentRecord = {
  id: string
  amount: unknown
  payment_status: string | null
  payment_method: string | null
  reservation_id: string
  submit_on: string | null
  note: string | null
  submit_by: string | null
}

export function aggregatePnlPaymentRecords(
  rows: RawPaymentRecord[],
  cashPaymentMethodIds: Set<string>
): {
  statusMonthly: Record<string, Record<string, number>>
  cashMonthly: Record<string, Record<string, number>>
  statusLines: PnlPaymentRecordLine[]
  cashLines: PnlPaymentRecordLine[]
} {
  const statusMonthly: Record<string, Record<string, number>> = {}
  const cashMonthly: Record<string, Record<string, number>> = {}
  const statusLines: PnlPaymentRecordLine[] = []
  const cashLines: PnlPaymentRecordLine[] = []

  const addTo = (
    target: Record<string, Record<string, number>>,
    bucket: PnlDepositBucketKey,
    ym: string,
    amt: number
  ) => {
    if (!target[bucket]) target[bucket] = {}
    target[bucket][ym] = (target[bucket][ym] || 0) + amt
  }

  for (const r of rows) {
    if (!r.submit_on) continue
    const ym = yearMonthFromSubmitOn(r.submit_on)
    const status = r.payment_status
    const signed = signedPaymentRecordAmount(r.amount, status)
    if (Math.abs(signed) < 0.005) continue

    const pm = (r.payment_method ?? '').trim()
    const isCash = pm !== '' && cashPaymentMethodIds.has(pm)
    const statusBucket = resolvePnlDepositStatusBucket(status)

    addTo(statusMonthly, statusBucket, ym, signed)
    statusLines.push({
      id: r.id,
      bucketKey: statusBucket,
      yearMonth: ym,
      signedAmount: signed,
      submit_on: r.submit_on,
      reservation_id: r.reservation_id,
      payment_status: status,
      payment_method: r.payment_method,
      amount: paymentRecordAmountToNumber(r.amount),
      note: r.note,
      submit_by: r.submit_by,
      isCashPaymentMethod: isCash,
    })

    if (isCash) {
      const cashBucket = resolvePnlDepositCashBucket(status, signed)
      if (cashBucket) {
        addTo(cashMonthly, cashBucket, ym, signed)
        cashLines.push({
          ...statusLines[statusLines.length - 1],
          bucketKey: cashBucket,
        })
      }
    }
  }

  return { statusMonthly, cashMonthly, statusLines, cashLines }
}

export function mergePnlDepositMonthlyCells(
  statusMonthly: Record<string, Record<string, number>>,
  cashMonthly: Record<string, Record<string, number>>
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const [k, v] of Object.entries(statusMonthly)) {
    out[k] = { ...v }
  }
  for (const [k, v] of Object.entries(cashMonthly)) {
    out[k] = { ...v }
  }
  return out
}
