'use client'

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import {
  duplicateExtraKeysToSelect,
  findPnlDetailDuplicateGroups,
  pnlDetailLineKey,
} from '@/lib/pnl-expense-detail-duplicates'
import type { PnlDetailLine } from '@/components/reports/PnlUnifiedExpenseDetailDialog'
import type { PnlTableRow } from '@/lib/pnlStandardCategoryTable'
import type { PnlDepositTableRow } from '@/lib/pnlPaymentRecords'
import {
  BULK_COMPANY_DUP_AMOUNT_EPS,
  BULK_COMPANY_DUP_DAY_WINDOW,
} from '@/lib/statement-bulk-company-duplicate-check'

export type PnlTaxReportExpenseRow = {
  kind: 'group-header' | 'leaf' | 'unmatched'
  label: string
  indent?: boolean
  monthly: Record<string, number>
  total: number
}

export type PnlTaxReportDepositRow = {
  kind: 'group' | 'bucket'
  label: string
  indent?: boolean
  excludeFromNet?: boolean
  monthly: Record<string, number>
  total: number
}

export type PnlTaxReadinessStats = {
  totalAmount: number
  totalCount: number
  reconciledAmount: number
  reconciledCount: number
  unmatchedAmount: number
  unmatchedCount: number
  coverage: number
  dupGroupCount: number
  dupExtraCount: number
  dupExtraAmount: number
}

export type PnlTaxReportExportData = {
  dateRange: { start: string; end: string }
  ledgerBaseDate: string
  months: string[]
  formatMonthLabel: (ym: string) => string
  taxReadiness: PnlTaxReadinessStats
  expenseRows: PnlTaxReportExpenseRow[]
  expenseColTotals: Record<string, number>
  expenseGrandTotal: number
  depositRows: PnlTaxReportDepositRow[]
  depositNetColTotals: Record<string, number>
  depositNetTotal: number
  statementInflowMonthly: Record<string, number>
  statementInflowTotal: number
  profitByMonth: Record<string, number>
  profitTotal: number
  refProfitByMonth: Record<string, number>
  refProfitTotal: number
  excludedExpenseTotal: number
  excludedExpenseCount: number
  excludedInflowTotal: number
  excludedInflowCount: number
}

function fmtMoney(n: number): string {
  if (Math.abs(n) < 0.005) return '—'
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmtPct(n: number): string {
  return `${(n * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

export function computePnlTaxReadinessStats(
  lines: PnlDetailLine[],
  dismissedDuplicateKeys?: Set<string>
): PnlTaxReadinessStats {
  let totalAmount = 0
  let reconciledAmount = 0
  let reconciledCount = 0
  for (const l of lines) {
    const amt = Number(l.amount) || 0
    totalAmount += amt
    if (l.statementReconciled) {
      reconciledAmount += amt
      reconciledCount += 1
    }
  }
  const totalCount = lines.length
  const unmatchedCount = totalCount - reconciledCount
  const unmatchedAmount = totalAmount - reconciledAmount
  const coverage = totalAmount > 0 ? reconciledAmount / totalAmount : 0

  const dupGroups = findPnlDetailDuplicateGroups(lines, dismissedDuplicateKeys)
  const dupExtraKeys = duplicateExtraKeysToSelect(lines, dupGroups)
  const dupExtraKeySet = new Set(dupExtraKeys)
  let dupExtraAmount = 0
  for (const l of lines) {
    if (dupExtraKeySet.has(pnlDetailLineKey(l))) dupExtraAmount += Number(l.amount) || 0
  }

  return {
    totalAmount,
    totalCount,
    reconciledAmount,
    reconciledCount,
    unmatchedAmount,
    unmatchedCount,
    coverage,
    dupGroupCount: dupGroups.length,
    dupExtraCount: dupExtraKeys.length,
    dupExtraAmount,
  }
}

export function buildPnlTaxReportExpenseRows(
  tableRows: PnlTableRow[],
  monthlyCells: Record<string, Record<string, number>>,
  rowTotals: Record<string, number>
): PnlTaxReportExpenseRow[] {
  return tableRows.map((row) => {
    if (row.kind === 'group-header') {
      const monthly: Record<string, number> = {}
      for (const leafId of row.leafIds) {
        const cells = monthlyCells[leafId] ?? {}
        for (const [ym, v] of Object.entries(cells)) {
          monthly[ym] = (monthly[ym] ?? 0) + v
        }
      }
      const total = row.leafIds.reduce((s, id) => s + (rowTotals[id] ?? 0), 0)
      return { kind: 'group-header', label: row.label, monthly, total }
    }
    const dataKey = row.rowKey
    return {
      kind: row.kind === 'unmatched' ? 'unmatched' : 'leaf',
      label: row.label,
      ...(row.kind === 'leaf' && row.indentSubcategory ? { indent: row.indentSubcategory } : {}),
      monthly: { ...(monthlyCells[dataKey] ?? {}) },
      total: rowTotals[dataKey] ?? 0,
    }
  })
}

function bucketKeysInDepositGroup(tableRows: PnlDepositTableRow[], groupIndex: number): string[] {
  const keys: string[] = []
  for (let i = groupIndex + 1; i < tableRows.length; i++) {
    const r = tableRows[i]
    if (r.kind === 'group') break
    if (r.kind === 'bucket') keys.push(r.rowKey)
  }
  return keys
}

export function buildPnlTaxReportDepositRows(
  tableRows: PnlDepositTableRow[],
  monthlyCells: Record<string, Record<string, number>>,
  rowTotals: Record<string, number>
): PnlTaxReportDepositRow[] {
  return tableRows.map((row, rowIndex) => {
    if (row.kind === 'group') {
      const leafKeys = bucketKeysInDepositGroup(tableRows, rowIndex)
      const monthly: Record<string, number> = {}
      for (const key of leafKeys) {
        const cells = monthlyCells[key] ?? {}
        for (const [ym, v] of Object.entries(cells)) {
          monthly[ym] = (monthly[ym] ?? 0) + v
        }
      }
      const total = leafKeys.reduce((s, id) => s + (rowTotals[id] ?? 0), 0)
      return { kind: 'group', label: row.label, monthly, total }
    }
    const dataKey = row.rowKey
    return {
      kind: 'bucket',
      label: row.label,
      ...(row.indent ? { indent: row.indent } : {}),
      ...(row.excludeFromNetTotal ? { excludeFromNet: row.excludeFromNetTotal } : {}),
      monthly: { ...(monthlyCells[dataKey] ?? {}) },
      total: rowTotals[dataKey] ?? 0,
    }
  })
}

function cellHtml(v: number): string {
  return fmtMoney(v)
}

function buildMonthHeaderCells(months: string[], formatMonthLabel: (ym: string) => string): string {
  return months.map((ym) => `<th>${formatMonthLabel(ym)}</th>`).join('')
}

function buildMonthDataCells(months: string[], monthly: Record<string, number>): string {
  return months.map((ym) => `<td class="num">${cellHtml(monthly[ym] ?? 0)}</td>`).join('')
}

export function buildPnlTaxReportHtml(data: PnlTaxReportExportData): string {
  const generatedAt = new Date().toLocaleString('ko-KR')
  const { taxReadiness: tr } = data
  const coveragePct = tr.coverage
  const coverageColor =
    coveragePct >= 0.95 ? '#047857' : coveragePct >= 0.7 ? '#b45309' : '#be123c'

  const expenseBody = data.expenseRows
    .map((row) => {
      const rowClass =
        row.kind === 'group-header'
          ? 'row-group'
          : row.kind === 'unmatched'
            ? 'row-unmatched'
            : row.indent
              ? 'row-leaf-indent'
              : 'row-leaf'
      const label = row.kind === 'leaf' && row.indent ? `↳ ${row.label}` : row.label
      return `<tr class="${rowClass}">
        <td class="label">${label}</td>
        ${buildMonthDataCells(data.months, row.monthly)}
        <td class="num total">${cellHtml(row.total)}</td>
      </tr>`
    })
    .join('')

  const depositBody = data.depositRows
    .map((row) => {
      const rowClass = row.kind === 'group' ? 'row-group' : row.excludeFromNet ? 'row-cash' : 'row-leaf'
      const label = row.indent ? `↳ ${row.label}` : row.label
      return `<tr class="${rowClass}">
        <td class="label">${label}</td>
        ${buildMonthDataCells(data.months, row.monthly)}
        <td class="num total">${cellHtml(row.total)}</td>
      </tr>`
    })
    .join('')

  const profitRows = data.months
    .map((ym) => {
      const v = data.profitByMonth[ym] ?? 0
      const cls = v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : ''
      return `<td class="num ${cls}">${cellHtml(v)}</td>`
    })
    .join('')

  const refProfitRows = data.months
    .map((ym) => {
      const v = data.refProfitByMonth[ym] ?? 0
      const cls = v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : ''
      return `<td class="num ${cls}">${cellHtml(v)}</td>`
    })
    .join('')

  const profitTotalCls =
    data.profitTotal > 0.005 ? 'pos' : data.profitTotal < -0.005 ? 'neg' : ''
  const refProfitTotalCls =
    data.refProfitTotal > 0.005 ? 'pos' : data.refProfitTotal < -0.005 ? 'neg' : ''

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>통합 PNL 세금 보고용 리포트</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      font-size: 11px;
      color: #111827;
      margin: 0;
      padding: 16px 20px;
      line-height: 1.45;
    }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 18px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .meta { color: #4b5563; font-size: 11px; margin-bottom: 14px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .summary-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
      background: #f9fafb;
    }
    .summary-card .k { font-size: 10px; color: #6b7280; margin-bottom: 4px; }
    .summary-card .v { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .tax-box {
      border: 1px solid #dbeafe;
      background: #eff6ff;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .tax-box h2 { border: none; margin-top: 0; }
    .coverage-bar {
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin: 6px 0;
    }
    .coverage-fill { height: 100%; background: ${coverageColor}; }
    .tax-tiles {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
    }
    .tax-tile {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px;
      background: #fff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 10px;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 4px 6px;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      text-align: right;
      white-space: nowrap;
    }
    th:first-child, td.label { text-align: left; min-width: 140px; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    td.total { font-weight: 600; background: #f9fafb; }
    tr.row-group td { background: #e5e7eb; font-weight: 700; }
    tr.row-unmatched td.label { background: #fffbeb; }
    tr.row-leaf-indent td.label { padding-left: 18px; }
    tr.row-cash td.label { color: #0f766e; }
    tr.footer td { font-weight: 700; background: #f3f4f6; }
    tr.footer-net td { background: #d1fae5; font-weight: 700; }
    tr.profit-row td { background: #e0e7ff; font-weight: 700; }
    .pos { color: #047857; }
    .neg { color: #b91c1c; }
    .note {
      font-size: 10px;
      color: #4b5563;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px;
      margin-top: 12px;
    }
    .footnote {
      margin-top: 16px;
      font-size: 9px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
    }
    @media print {
      body { padding: 10px 14px; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <h1>통합 PNL · 세금 보고용 리포트</h1>
  <div class="meta">
    기간: <strong>${data.dateRange.start}</strong> ~ <strong>${data.dateRange.end}</strong> ·
    원장 기준일: <strong>${data.ledgerBaseDate}</strong> ·
    생성: ${generatedAt}
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="k">입금 순합계 (상태별)</div>
      <div class="v">${fmtMoney(data.depositNetTotal)}</div>
    </div>
    <div class="summary-card">
      <div class="k">지출 합계</div>
      <div class="v">${fmtMoney(data.expenseGrandTotal)}</div>
    </div>
    <div class="summary-card">
      <div class="k">순수익 (입금 순합계 − 지출)</div>
      <div class="v">${fmtMoney(data.profitTotal)}</div>
    </div>
    <div class="summary-card">
      <div class="k">참고 순이익 (명세+현금−지출)</div>
      <div class="v">${fmtMoney(data.refProfitTotal)}</div>
    </div>
  </div>

  <div class="tax-box">
    <h2>세금 보고 준비도 · 명세 대조 커버리지</h2>
    <p>통합 지출 합계 <strong>${fmtMoney(tr.totalAmount)}</strong> 중 은행·카드 명세와 연결된 비율 (중복 기준: 금액 ±$${BULK_COMPANY_DUP_AMOUNT_EPS}, 등록일 ±${BULK_COMPANY_DUP_DAY_WINDOW}일)</p>
    <div class="coverage-bar"><div class="coverage-fill" style="width:${Math.min(100, Math.max(0, coveragePct * 100))}%"></div></div>
    <div><strong style="color:${coverageColor}">${fmtPct(coveragePct)}</strong> (${fmtMoney(tr.reconciledAmount)} / ${fmtMoney(tr.totalAmount)}) · 연결 ${tr.reconciledCount}건 · 미대조 ${tr.unmatchedCount}건</div>
    <div class="tax-tiles">
      <div class="tax-tile"><div class="k">명세 연결됨</div><div class="v">${fmtMoney(tr.reconciledAmount)}</div><div class="k">${tr.reconciledCount}건</div></div>
      <div class="tax-tile"><div class="k">명세 미대조</div><div class="v">${fmtMoney(tr.unmatchedAmount)}</div><div class="k">${tr.unmatchedCount}건</div></div>
      <div class="tax-tile"><div class="k">중복 의심(삭제 후보)</div><div class="v">${fmtMoney(tr.dupExtraAmount)}</div><div class="k">${tr.dupGroupCount}그룹 · ${tr.dupExtraCount}건</div></div>
    </div>
  </div>

  <h2>통합 입금 (payment_records · submit_on 기준)</h2>
  <table>
    <thead>
      <tr>
        <th>구분</th>
        ${buildMonthHeaderCells(data.months, data.formatMonthLabel)}
        <th>합계</th>
      </tr>
    </thead>
    <tbody>
      ${depositBody}
      <tr class="footer-net">
        <td class="label">순합계 (상태별, 현금 행 제외)</td>
        ${buildMonthDataCells(data.months, data.depositNetColTotals)}
        <td class="num total">${cellHtml(data.depositNetTotal)}</td>
      </tr>
      <tr class="row-leaf">
        <td class="label">참고 › 명세 입금 (statement_lines)</td>
        ${buildMonthDataCells(data.months, data.statementInflowMonthly)}
        <td class="num total">${cellHtml(data.statementInflowTotal)}</td>
      </tr>
    </tbody>
  </table>

  <h2>통합 지출 (표준 카테고리 · exclude_from_pnl 제외)</h2>
  <table>
    <thead>
      <tr>
        <th>표준 카테고리</th>
        ${buildMonthHeaderCells(data.months, data.formatMonthLabel)}
        <th>합계</th>
      </tr>
    </thead>
    <tbody>
      ${expenseBody}
      <tr class="footer">
        <td class="label">월 합계</td>
        ${buildMonthDataCells(data.months, data.expenseColTotals)}
        <td class="num total">${cellHtml(data.expenseGrandTotal)}</td>
      </tr>
    </tbody>
  </table>

  <h2>순수익</h2>
  <table>
    <thead>
      <tr>
        <th>구분</th>
        ${buildMonthHeaderCells(data.months, data.formatMonthLabel)}
        <th>기간 합계</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="label">입금 순합계</td>
        ${buildMonthDataCells(data.months, data.depositNetColTotals)}
        <td class="num total">${cellHtml(data.depositNetTotal)}</td>
      </tr>
      <tr>
        <td class="label">지출 월 합계</td>
        ${buildMonthDataCells(data.months, data.expenseColTotals)}
        <td class="num total">${cellHtml(data.expenseGrandTotal)}</td>
      </tr>
      <tr class="profit-row">
        <td class="label">= 순수익</td>
        ${profitRows}
        <td class="num total ${profitTotalCls}">${cellHtml(data.profitTotal)}</td>
      </tr>
      <tr>
        <td class="label">참고 (명세 입금 + 현금 − 지출)</td>
        ${refProfitRows}
        <td class="num total ${refProfitTotalCls}">${cellHtml(data.refProfitTotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="note">
    <strong>PNL 제외 항목</strong> — 지출 ${data.excludedExpenseCount.toLocaleString()}건 (${fmtMoney(data.excludedExpenseTotal)}),
    명세 입금 ${data.excludedInflowCount.toLocaleString()}건 (${fmtMoney(data.excludedInflowTotal)}).
    위 표 합계에는 포함되지 않습니다.
  </div>

  <div class="footnote">
    Tour Management System · 통합 PNL 세금 보고용 출력 · 화면 데이터 기준 스냅샷
  </div>
</body>
</html>`
}

export function printPnlTaxReport(data: PnlTaxReportExportData): void {
  const html = buildPnlTaxReportHtml(data)
  const win = window.open('', '_blank')
  if (!win) return

  const doc = win.document
  doc.open()
  doc.write(html)
  doc.close()

  const runPrint = () => {
    try {
      win.focus()
      win.print()
    } catch {
      /* ignore */
    }
    const closeWhenDone = () => {
      try {
        if (!win.closed) win.close()
      } catch {
        /* ignore */
      }
    }
    win.addEventListener('afterprint', closeWhenDone, { once: true })
  }

  if (doc.readyState === 'complete') {
    requestAnimationFrame(() => requestAnimationFrame(runPrint))
  } else {
    win.addEventListener('load', runPrint, { once: true })
  }
}

export async function downloadPnlTaxReportPdf(data: PnlTaxReportExportData): Promise<void> {
  const parsed = new DOMParser().parseFromString(buildPnlTaxReportHtml(data), 'text/html')
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '1200px'
  container.style.background = '#fff'
  const styleEl = parsed.querySelector('style')
  if (styleEl?.textContent) {
    const embeddedStyle = document.createElement('style')
    embeddedStyle.textContent = styleEl.textContent
    container.appendChild(embeddedStyle)
  }
  const bodyClone = document.createElement('div')
  bodyClone.innerHTML = parsed.body.innerHTML
  container.appendChild(bodyClone)
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 8
    const contentWidth = pageWidth - margin * 2
    const imgHeight = (canvas.height * contentWidth) / canvas.width

    let heightLeft = imgHeight
    let position = margin

    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight)
    heightLeft -= pageHeight - margin * 2

    while (heightLeft > 0) {
      pdf.addPage()
      position = margin - (imgHeight - heightLeft)
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight)
      heightLeft -= pageHeight - margin * 2
    }

    const fileName = `통합PNL_세금보고_${data.dateRange.start}_${data.dateRange.end}.pdf`
    pdf.save(fileName)
  } finally {
    document.body.removeChild(container)
  }
}
