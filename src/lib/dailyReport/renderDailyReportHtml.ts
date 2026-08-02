import type { DailyReportData } from '@/lib/dailyReport/types'
import { formatReportDateLabel, formatReportDateRangeLabel, isSingleDayReport } from '@/lib/dailyReport/dateUtils'
import { formatUsd } from '@/lib/dailyReport/moneyUtils'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statRow(label: string, value: string | number): string {
  return `<tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">${esc(label)}</td><td style="padding:8px 12px;font-weight:600;color:#111827;font-size:14px;text-align:right;">${esc(String(value))}</td></tr>`
}

function breakdownTable(title: string, rows: DailyReportData['reservationSummary']['byProduct']): string {
  if (!rows.length) return ''
  const body = rows
    .map(
      (r) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;">${esc(r.name)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:center;">${r.newCount}건/${r.newGuests}명</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:center;color:#dc2626;">${r.cancelledCount}건/${r.cancelledGuests}명</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:center;font-weight:600;">${r.netCount}건/${r.netGuests}명</td>
      </tr>`
    )
    .join('')
  return `<div style="margin-top:12px;"><div style="font-size:13px;font-weight:600;margin-bottom:6px;">${esc(title)}</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f9fafb;">
      <th style="padding:6px 10px;text-align:left;">이름</th><th>신규</th><th>취소</th><th>순</th>
    </tr></thead><tbody>${body}</tbody></table></div>`
}

function sectionNotes(notes: string): string {
  if (!notes.trim()) return ''
  return `<div style="margin-top:12px;padding:12px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:6px;"><div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:4px;">추가 메모</div><div style="font-size:13px;color:#78350f;white-space:pre-wrap;">${esc(notes.trim())}</div></div>`
}

function sectionBlock(title: string, body: string): string {
  return `<div style="margin-bottom:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><div style="background:#0f172a;color:#ffffff;padding:14px 18px;font-size:16px;font-weight:600;">${esc(title)}</div><div style="padding:18px;">${body}</div></div>`
}

export function renderDailyReportEmailHtml(data: DailyReportData, locale = 'ko'): string {
  const endDate = data.reportEndDate ?? data.reportDate
  const singleDay = isSingleDayReport(data.reportDate, endDate)
  const dateLabel = formatReportDateRangeLabel(data.reportDate, endDate, locale)
  const tomorrowLabel = formatReportDateLabel(data.tomorrowSchedule.date, locale)
  const submittedBy = data.submittedByName || data.submittedByEmail || '사무실'
  const rs = data.reservationSummary
  const ts = data.tourSummary

  const reservationBody = `
    <table style="width:100%;border-collapse:collapse;">
      ${statRow('신규 접수', `${rs.newRegistrations.count}건 / ${rs.newRegistrations.guests}명`)}
      ${statRow(singleDay ? '당일 취소' : '기간 취소', `${rs.cancellationsToday.count}건 / ${rs.cancellationsToday.guests}명`)}
      ${statRow('순예약', `${rs.netReservations.count}건 / ${rs.netReservations.guests}명`)}
    </table>
    ${breakdownTable('투어 상품별', rs.byProduct)}
    ${breakdownTable('채널별', rs.byChannel)}
    ${sectionNotes(rs.notes)}
  `

  const tourFinRows = ts.tours
    .map(
      (t) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;">${esc(t.productName)}<br/><span style="color:#6b7280;">${esc(t.guideName ?? '—')}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;">${formatUsd(t.totalPayment)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;">${formatUsd(t.balanceOutstanding)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#059669;">${formatUsd(t.totalIncome)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#dc2626;">${formatUsd(t.totalExpenses)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;font-weight:600;">${formatUsd(t.netProfit)}</td>
      </tr>`
    )
    .join('')

  const tourTotalRow = ts.tours.length
    ? `<tr style="background:#f9fafb;font-weight:600;">
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;">합계</td>
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;text-align:right;">${formatUsd(ts.totals.totalPayment)}</td>
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;text-align:right;">${formatUsd(ts.totals.balanceOutstanding)}</td>
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;text-align:right;color:#059669;">${formatUsd(ts.totals.totalIncome)}</td>
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;text-align:right;color:#dc2626;">${formatUsd(ts.totals.totalExpenses)}</td>
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;text-align:right;">${formatUsd(ts.totals.netProfit)}</td>
      </tr>`
    : ''

  const tourBody = `
    ${tourFinRows ? `<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;"><thead><tr style="background:#f9fafb;">
      <th style="padding:8px;text-align:left;">상품</th><th>총매출</th><th>잔액</th><th>운영이익</th><th>지출</th><th>순수익</th>
    </tr></thead><tbody>${tourFinRows}${tourTotalRow}</tbody></table>` : `<p>${singleDay ? '오늘 투어 없음' : '해당 기간 투어 없음'}</p>`}
    ${sectionNotes(ts.notes)}
  `

  const fr = data.financialReport
  const financialBlocks = fr
    ? fr.categories
        .map((cat) => {
          const rows = cat.items
            .map((item) => {
              const amount =
                item.amount < 0
                  ? `-${formatUsd(Math.abs(item.amount))}`
                  : formatUsd(item.amount)
              const detail = [item.detail, item.paymentMethod ? `(${item.paymentMethod})` : null]
                .filter(Boolean)
                .join(' ')
              return `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;">${esc(item.label)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${esc(detail || '—')}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;">${amount}</td>
              </tr>`
            })
            .join('')
          const total =
            cat.key === 'cash'
              ? ''
              : `<div style="text-align:right;font-weight:600;color:#dc2626;font-size:13px;margin-top:6px;">합계 ${formatUsd(cat.total)}</div>`
          return `<div style="margin-bottom:16px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${esc(cat.title)}</div>
            ${rows ? `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f9fafb;"><th style="padding:6px 10px;text-align:left;">항목</th><th style="padding:6px 10px;text-align:left;">상세</th><th style="padding:6px 10px;text-align:right;">금액</th></tr></thead><tbody>${rows}</tbody></table>${total}` : '<p style="font-size:12px;color:#6b7280;">해당 항목 없음</p>'}
          </div>`
        })
        .join('')
    : ''

  const financialBody = fr
    ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      ${statRow('현금 입금', formatUsd(fr.cashInflowToday))}
      ${statRow('현금 지출', formatUsd(fr.cashOutflowToday))}
      ${statRow('순 현금 흐름', formatUsd(fr.netCashFlowToday))}
      ${statRow('현금 보유', formatUsd(fr.cashOnHand))}
    </table>
    ${financialBlocks}`
    : ''

  const todoUserBlocks = data.todoSummary.byUser
    .map((u) => {
      const completed = u.completed.map((i) => `<li>✓ ${esc(i.title)}</li>`).join('')
      const pending = u.pending.map((i) => `<li style="color:#b45309;">○ ${esc(i.title)}</li>`).join('')
      return `<div style="margin-bottom:12px;padding:10px;background:#f9fafb;border-radius:8px;">
        <div style="font-weight:600;font-size:13px;">${esc(u.userName || u.userEmail)}</div>
        ${completed ? `<ul style="margin:6px 0 0;padding-left:16px;font-size:12px;">${completed}</ul>` : ''}
        ${pending ? `<ul style="margin:6px 0 0;padding-left:16px;font-size:12px;">${pending}</ul>` : ''}
      </div>`
    })
    .join('')

  const todoBody = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      ${statRow('완료', `${data.todoSummary.completedCount}건`)}
      ${statRow('미처리', `${data.todoSummary.pendingCount}건`)}
      ${statRow('보류', `${data.todoSummary.onHoldCount}건`)}
    </table>
    ${todoUserBlocks}
    ${sectionNotes(data.todoSummary.notes)}
  `

  const tomorrowRows = data.tomorrowSchedule.tours
    .map((t) => {
      const statusColor = t.isFullyAssigned ? '#059669' : '#dc2626'
      const statusText = t.isFullyAssigned ? '배정완료' : '배정필요'
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${esc(t.productName)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${esc(t.guideName ?? '—')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${esc(t.vehicleLabel ?? '—')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:center;">${t.reservationCount}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:${statusColor};font-size:12px;">${statusText}</td>
      </tr>`
    })
    .join('')

  const tomorrowBody = `
    <p style="margin:0 0 12px;color:#6b7280;font-size:14px;">${esc(tomorrowLabel)} — 투어 ${data.tomorrowSchedule.totalTours}건 · 배정 필요 ${data.tomorrowSchedule.unassignedCount}건</p>
    ${tomorrowRows ? `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f9fafb;"><th style="padding:8px;text-align:left;">상품</th><th>가이드</th><th>차량</th><th>예약</th><th>상태</th></tr></thead><tbody>${tomorrowRows}</tbody></table>` : '<p>내일 투어 없음</p>'}
    ${sectionNotes(data.tomorrowSchedule.notes)}
  `

  const additionalBlock = data.additionalNotes.trim()
    ? sectionBlock('종합 메모', `<div style="font-size:14px;white-space:pre-wrap;">${esc(data.additionalNotes.trim())}</div>`)
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:720px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;border-radius:16px 16px 0 0;padding:28px 24px;">
      <div style="font-size:12px;opacity:0.8;">${singleDay ? 'DAILY REPORT' : 'PERIOD REPORT'}</div>
      <h1 style="margin:8px 0 4px;font-size:24px;">${esc(dateLabel)}</h1>
      <p style="margin:0;opacity:0.85;font-size:14px;">작성: ${esc(submittedBy)}</p>
    </div>
    <div style="background:#f9fafb;padding:20px 16px;border-radius:0 0 16px 16px;">
      ${sectionBlock('예약 관리 요약', reservationBody)}
      ${sectionBlock('투어 관리 요약 (재무)', tourBody)}
      ${financialBody ? sectionBlock('재무 보고', financialBody) : ''}
      ${sectionBlock('TODO 처리 현황 (사용자별)', todoBody)}
      ${singleDay ? sectionBlock('내일 투어 스케줄 · 배차', tomorrowBody) : ''}
      ${additionalBlock}
    </div>
  </div></body></html>`
}

export function dailyReportEmailSubject(data: DailyReportData): string {
  const endDate = data.reportEndDate ?? data.reportDate
  const dateLabel = formatReportDateRangeLabel(data.reportDate, endDate, 'ko')
  const kind = isSingleDayReport(data.reportDate, endDate) ? '일일' : '기간'
  return `[Daily Report] ${dateLabel} ${kind} 업무 보고`
}
