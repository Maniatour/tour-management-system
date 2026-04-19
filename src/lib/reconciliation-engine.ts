/** Match statement lines to operational expense rows by amount + date proximity. */

export type ExpenseCandidate = {
  source_table: 'company_expenses' | 'tour_expenses' | 'reservation_expenses' | 'ticket_bookings'
  source_id: string
  amount: number
  occurred_at: string // ISO
  label: string
}

const MS_DAY = 86400000

function dayDiff(aIso: string, bDate: string): number {
  const a = new Date(aIso).getTime()
  const b = new Date(bDate + 'T12:00:00').getTime()
  return Math.abs(a - b) / MS_DAY
}

export function scoreMatch(
  lineAmount: number,
  linePostedDate: string,
  expense: ExpenseCandidate,
  maxDayDiff = 4
): number {
  const amtOk = Math.abs(Number(expense.amount) - lineAmount) < 0.015
  if (!amtOk) return 0
  const d = dayDiff(expense.occurred_at, linePostedDate)
  if (d > maxDayDiff) return 0
  let s = 100 - d * 8
  if (expense.label.length > 2) s += 5
  return s
}

export function findBestExpenseForLine(
  lineAmount: number,
  linePostedDate: string,
  expenses: ExpenseCandidate[],
  used: Set<string>
): { expense: ExpenseCandidate; score: number } | null {
  let best: { expense: ExpenseCandidate; score: number } | null = null
  const key = (e: ExpenseCandidate) => `${e.source_table}:${e.source_id}`
  for (const e of expenses) {
    if (used.has(key(e))) continue
    const sc = scoreMatch(lineAmount, linePostedDate, e)
    if (sc > 0 && (!best || sc > best.score)) {
      best = { expense: e, score: sc }
    }
  }
  return best
}
