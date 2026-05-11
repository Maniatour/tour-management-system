import { formatStatementLineDescription } from '@/lib/statement-display'

/**
 * Amex 등 «통합 명세 부모 계정 + 실제 청구 카드 자식 계정» 쌍.
 * 부모 CSV에 자식 카드 거래가 다시 포함되는 경우, 부모 목록에서는 자식과
 * 동일한 거래(일자·부호·금액·표시 설명)를 숨겨 이중 대조를 막는다.
 * (DB 행 삭제는 하지 않음 — 자식 명세·기존 매칭을 보존)
 */
export type NestedStatementAccountRule = {
  isParent: (normalizedAccountName: string) => boolean
  isChild: (normalizedAccountName: string) => boolean
}

export const NESTED_STATEMENT_ACCOUNT_RULES: readonly NestedStatementAccountRule[] = [
  {
    isParent: (n) =>
      n.includes('bonvoy') &&
      n.includes('business') &&
      (n.includes('amex') || (n.includes('american') && n.includes('express'))),
    isChild: (n) => n.includes('simplycash') && n.includes('plus'),
  },
]

export type FinancialAccountNameId = { id: string; name: string }

function normalizeAccountName(name: string): string {
  return name.toLowerCase().replace(/[\s_\-]/g, '')
}

export function resolveNestedStatementChildAccountId(
  parentAccount: FinancialAccountNameId,
  allAccounts: FinancialAccountNameId[]
): string | null {
  const pn = normalizeAccountName(parentAccount.name)
  for (const rule of NESTED_STATEMENT_ACCOUNT_RULES) {
    if (!rule.isParent(pn)) continue
    for (const a of allAccounts) {
      if (a.id === parentAccount.id) continue
      if (rule.isChild(normalizeAccountName(a.name))) return a.id
    }
  }
  return null
}

export type StatementLineNestedDedupeShape = {
  posted_date: string
  amount: number | string
  direction: string
  description: string | null
  merchant: string | null
}

/** 동일 거래 여부 판별용 — import·dedupe_key 와 무관하게 자식 명세와 맞춘다 */
export function statementLineNestedDedupeContentKey(line: StatementLineNestedDedupeShape): string {
  const rawAmt = typeof line.amount === 'string' ? parseFloat(line.amount) : line.amount
  const amt = Number.isFinite(rawAmt) ? Number(rawAmt).toFixed(2) : String(line.amount ?? '')
  const desc = formatStatementLineDescription(line.description, line.merchant)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  const pd = (line.posted_date || '').slice(0, 10)
  return `${pd}|${line.direction}|${amt}|${desc}`
}

export function filterParentLinesRemovingNestedChildDuplicates<
  T extends StatementLineNestedDedupeShape
>(parentLines: T[], childLines: readonly StatementLineNestedDedupeShape[]): T[] {
  if (childLines.length === 0) return parentLines
  const childKeys = new Set(childLines.map((l) => statementLineNestedDedupeContentKey(l)))
  return parentLines.filter((l) => !childKeys.has(statementLineNestedDedupeContentKey(l)))
}
