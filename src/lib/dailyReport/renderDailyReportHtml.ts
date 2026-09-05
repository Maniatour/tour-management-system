import type { DailyReportData, DailyReportTourReportEntry, DailyReportTourReportStaffRole } from '@/lib/dailyReport/types'
import { formatReportDateLabel, formatReportDateRangeLabel, isSingleDayReport } from '@/lib/dailyReport/dateUtils'
import { formatUsd } from '@/lib/dailyReport/moneyUtils'
import { getStatusText } from '@/utils/tourStatusUtils'
import { displaySkipReasonLabel, displayVehicleConditionLabel } from '@/lib/tourReportExtras'

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

function statRowHtml(label: string, valueHtml: string): string {
  return `<tr><td style="padding:8px 12px;color:#6b7280;font-size:14px;">${esc(label)}</td><td style="padding:8px 12px;font-weight:600;color:#111827;font-size:14px;text-align:right;">${valueHtml}</td></tr>`
}

function formatBreakdownCount(count: number, guests: number): string {
  if (count === 0 && guests === 0) return '-'
  return `${count} 예약 (${guests}인)`
}

function breakdownTable(title: string, rows: DailyReportData['reservationSummary']['byProduct']): string {
  if (!rows.length) return ''
  const body = rows
    .map(
      (r) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;">${esc(r.name)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:center;">${formatBreakdownCount(r.newCount, r.newGuests)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:center;color:#dc2626;">${formatBreakdownCount(r.cancelledCount, r.cancelledGuests)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:center;font-weight:600;">${formatBreakdownCount(r.netCount, r.netGuests)}</td>
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

const WEATHER_KO: Record<string, string> = {
  sunny: '맑음',
  cloudy: '흐림',
  rainy: '비',
  snowy: '눈',
  windy: '바람',
  foggy: '안개',
}

const MOOD_KO: Record<string, string> = {
  excellent: '매우 좋음',
  good: '좋음',
  average: '보통',
  poor: '나쁨',
  terrible: '매우 나쁨',
}

function staffRoleKo(role: DailyReportTourReportStaffRole): string {
  if (role === 'assistant') return '어시'
  if (role === 'guide') return '가이드'
  return '기타'
}

function tourReportEntryHtml(report: DailyReportTourReportEntry): string {
  const weather = report.weather ? WEATHER_KO[report.weather] || report.weather : null
  const mood = report.overallMood ? MOOD_KO[report.overallMood] || report.overallMood : null
  const meta: string[] = []
  if (weather) meta.push(weather)
  if (mood) meta.push(mood)
  if (report.customerCount != null) {
    const booked =
      report.bookedCustomerCount != null ? ` / 예약 ${report.bookedCustomerCount}` : ''
    meta.push(`탑승 ${report.customerCount}${booked}`)
  }
  const vehicleIssueTags = report.vehicleTags.filter((tag) => tag !== 'ok')
  const issueLines: string[] = [
    ...report.incidents.map((item) => `문제: ${item}`),
    ...report.lostItems.map((item) => `분실/손상: ${item}`),
    ...vehicleIssueTags.map((tag) => `차량: ${displayVehicleConditionLabel(tag, 'ko')}`),
  ]
  if (report.vehicleNote) issueLines.push(`차량 메모: ${report.vehicleNote}`)
  if (report.skippedStops.length > 0) {
    issueLines.push(
      `스킵: ${report.skippedStops
        .map((stop) =>
          [stop.reason ? displaySkipReasonLabel(stop.reason, 'ko') : null, stop.note]
            .filter(Boolean)
            .join(' — ')
        )
        .join(' · ')}`
    )
  }
  if (report.narrationSkipTitleKo) {
    issueLines.push(
      `${report.narrationSkipTitleKo}${report.narrationSkipDetail ? ` — ${report.narrationSkipDetail}` : ''}`
    )
  }
  if (report.photoCount > 0) issueLines.push(`이슈 사진 ${report.photoCount}장`)
  const notes = [report.guestComments, report.handoffNote, report.comments, report.suggestions].filter(
    Boolean
  ) as string[]

  const details =
    issueLines.length || notes.length
      ? `<ul style="margin:6px 0 0;padding-left:18px;color:${report.hasIssues ? '#991b1b' : '#6b7280'};font-size:12px;">
          ${[...issueLines, ...notes].map((line) => `<li style="margin:2px 0;white-space:pre-wrap;">${esc(line)}</li>`).join('')}
        </ul>`
      : ''

  return `<div style="margin-top:6px;font-size:12px;color:#4b5563;">
    <strong style="color:#111827;">${esc(`${staffRoleKo(report.role)} ${report.staffName}`)}</strong>
    ${meta.length ? ` · ${esc(meta.join(' · '))}` : ''}
    ${details}
  </div>`
}

export function renderDailyReportEmailHtml(data: DailyReportData, locale = 'ko'): string {
  const endDate = data.reportEndDate ?? data.reportDate
  const singleDay = isSingleDayReport(data.reportDate, endDate)
  const dateLabel = formatReportDateRangeLabel(data.reportDate, endDate, locale)
  const tomorrowLabel = formatReportDateLabel(data.tomorrowSchedule.date, locale)
  const submittedBy = data.submittedByName || data.submittedByEmail || '사무실'
  const rs = data.reservationSummary
  const ts = data.tourSummary

  const ytdAvg = rs.ytdWeekdayNetAvg
  const ytdAvgRounded = ytdAvg ? Math.round(ytdAvg.avgNetPeople) : 0
  const ytdDelta = ytdAvg ? rs.netReservations.guests - ytdAvgRounded : 0
  const ytdDeltaLabel = ytdDelta > 0 ? `+${ytdDelta}` : String(ytdDelta)
  const ytdWeekday =
    ytdAvg != null ? (['일', '월', '화', '수', '목', '금', '토'][ytdAvg.weekdayIndex] ?? '') : ''
  const ytdAvgBanner = ytdAvg
    ? `<div style="margin-top:12px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${esc(`${ytdAvg.compareDate.slice(0, 4)}.1/1~${ytdAvg.throughYmd.slice(5).replace('-', '/')} · ${ytdWeekday}요일 순예약 일평균`)}</div>
        <div style="font-size:14px;">
          평균 <strong style="font-size:18px;">${ytdAvgRounded}</strong>명
          · ${singleDay ? '오늘' : '기간'} <strong style="font-size:18px;color:#059669;">${rs.netReservations.guests}</strong>명
          ${singleDay ? ` · 평균 대비 <strong>${ytdDeltaLabel}</strong>명` : ''}
        </div>
      </div>`
    : ''

  const reservationBody = `
    <table style="width:100%;border-collapse:collapse;">
      ${statRowHtml('신규 접수', `<span style="font-size:20px;font-weight:700;">${rs.newRegistrations.guests}명</span> <span style="color:#6b7280;font-size:13px;">${rs.newRegistrations.count}건</span>`)}
      ${statRowHtml(singleDay ? '당일 취소' : '기간 취소', `<span style="font-size:20px;font-weight:700;color:#dc2626;">${rs.cancellationsToday.guests}명</span> <span style="color:#6b7280;font-size:13px;">${rs.cancellationsToday.count}건</span>`)}
      ${statRowHtml('순예약', `<span style="font-size:20px;font-weight:700;color:#059669;">${rs.netReservations.guests}명</span> <span style="color:#6b7280;font-size:13px;">${rs.netReservations.count}건</span>`)}
    </table>
    ${ytdAvgBanner}
    ${breakdownTable('투어 상품별', rs.byProduct)}
    ${breakdownTable('채널별', rs.byChannel)}
    ${sectionNotes(rs.notes)}
  `

  const tourFinRows = ts.tours
    .map(
      (t) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;">${esc(t.productName)}<br/><span style="color:#6b7280;">${esc(t.guideName ?? '—')}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#059669;">${formatUsd(t.totalIncome)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#dc2626;">${formatUsd(t.totalExpenses)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;font-weight:600;">${formatUsd(t.netProfit)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;">${formatUsd(t.balanceOutstanding)}</td>
      </tr>`
    )
    .join('')

  const tourTotalRow = ts.tours.length
    ? `<tr style="background:#f9fafb;font-weight:600;">
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;">합계</td>
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;text-align:right;color:#059669;">${formatUsd(ts.totals.totalIncome)}</td>
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;text-align:right;color:#dc2626;">${formatUsd(ts.totals.totalExpenses)}</td>
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;text-align:right;">${formatUsd(ts.totals.netProfit)}</td>
        <td style="padding:8px 10px;border-top:2px solid #e5e7eb;text-align:right;">${formatUsd(ts.totals.balanceOutstanding)}</td>
      </tr>`
    : ''

  const tourBody = `
    ${tourFinRows ? `<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;"><thead><tr style="background:#f9fafb;">
      <th style="padding:8px;text-align:left;">상품</th><th>총매출</th><th>지출</th><th>순이익</th><th>잔액</th>
    </tr></thead><tbody>${tourFinRows}${tourTotalRow}</tbody></table>` : `<p>${singleDay ? '오늘 투어 없음' : '해당 기간 투어 없음'}</p>`}
    ${sectionNotes(ts.notes)}
  `

  const trs = data.tourReportSummary
  const tourReportStatusColor = (allSubmitted: boolean, hasIssues: boolean) => {
    if (!allSubmitted) return { label: '미제출', color: '#b45309', bg: '#fffbeb', border: '#fde68a' }
    if (hasIssues) return { label: '이슈', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' }
    return { label: '제출', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' }
  }
  const tourReportRows = trs?.tours.length
    ? trs.tours
        .map((tour) => {
          const status = tourReportStatusColor(
            tour.allSubmitted,
            tour.reports.some((report) => report.hasIssues)
          )
          const staffLine = tour.staff.length
            ? tour.staff
                .map(
                  (person) =>
                    `${staffRoleKo(person.role)} ${person.name}${person.submitted ? '' : ' (미제출)'}`
                )
                .join(' · ')
            : '담당자 없음'
          const datePrefix = singleDay ? '' : `${formatReportDateLabel(tour.tourDate, 'ko')} · `
          return `<div style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
              <div>
                <div style="font-size:13px;font-weight:600;">${esc(tour.productName)}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">${esc(datePrefix + staffLine)}</div>
              </div>
              <span style="flex-shrink:0;padding:2px 8px;border-radius:999px;border:1px solid ${status.border};background:${status.bg};color:${status.color};font-size:11px;font-weight:600;">${status.label}</span>
            </div>
            ${
              tour.missingNames.length
                ? `<div style="margin-top:4px;font-size:12px;color:#b45309;font-weight:600;">미제출: ${esc(tour.missingNames.join(', '))}</div>`
                : ''
            }
            ${tour.reports.map((report) => tourReportEntryHtml(report)).join('')}
          </div>`
        })
        .join('')
    : `<p>${singleDay ? '오늘 가이드 배정 투어가 없습니다.' : '해당 기간 가이드 배정 투어가 없습니다.'}</p>`

  const tourReportBody = trs
    ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      ${statRow('배정 투어', trs.assignedTourCount)}
      ${statRow('제출 완료', trs.completeTourCount)}
      ${statRow('미제출', trs.missingTourCount)}
      ${statRow('현장 이슈', trs.issueReportCount)}
    </table>
    ${tourReportRows}
  `
    : ''

  const fr = data.financialReport
  const financialBlocks = fr
    ? fr.categories
        .map((cat) => {
          const isBooking = cat.key === 'booking'
          const isCashFlow = cat.key === 'cash'
          const rows = cat.items
            .map((item) => {
              if (isCashFlow) {
                const isBalance = item.id === 'cash_on_hand'
                const isNegative = item.amount < 0
                const spent = !isBalance && isNegative ? formatUsd(Math.abs(item.amount)) : '—'
                const deposited = !isBalance && !isNegative ? formatUsd(item.amount) : '—'
                const hold = isBalance ? formatUsd(item.amount) : '—'
                return `<tr>
                  <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;">${esc(item.label)}</td>
                  <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#dc2626;">${spent}</td>
                  <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#059669;">${deposited}</td>
                  <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;font-weight:600;color:#4338ca;">${hold}</td>
                </tr>`
              }

              const amount =
                item.amount < 0
                  ? `-${formatUsd(Math.abs(item.amount))}`
                  : formatUsd(item.amount)
              const detail = [item.detail, item.paymentMethod ? `(${item.paymentMethod})` : null]
                .filter(Boolean)
                .join(' ')
              const bookingCols = isBooking
                ? `<td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#6b7280;">${
                    item.ea != null ? item.ea : '—'
                  }</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#6b7280;">${
                    item.unitPrice != null ? formatUsd(item.unitPrice) : '—'
                  }</td>`
                : ''
              return `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;">${esc(item.label)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${esc(detail || '—')}</td>
                ${bookingCols}
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;">${amount}</td>
              </tr>`
            })
            .join('')
          const total =
            cat.key === 'cash'
              ? ''
              : `<div style="text-align:right;font-weight:600;color:#dc2626;font-size:13px;margin-top:6px;">합계 ${formatUsd(cat.total)}</div>`
          const headerCols = isCashFlow
            ? `<th style="padding:6px 10px;text-align:left;">항목</th><th style="padding:6px 10px;text-align:right;">지출</th><th style="padding:6px 10px;text-align:right;">입금</th><th style="padding:6px 10px;text-align:right;">보유</th>`
            : isBooking
              ? `<th style="padding:6px 10px;text-align:left;">항목</th><th style="padding:6px 10px;text-align:left;">상세</th><th style="padding:6px 10px;text-align:right;">EA</th><th style="padding:6px 10px;text-align:right;">개당 가격</th><th style="padding:6px 10px;text-align:right;">금액</th>`
              : `<th style="padding:6px 10px;text-align:left;">항목</th><th style="padding:6px 10px;text-align:left;">상세</th><th style="padding:6px 10px;text-align:right;">금액</th>`
          return `<div style="margin-bottom:16px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:6px;">${esc(cat.title)}</div>
            ${rows ? `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f9fafb;">${headerCols}</tr></thead><tbody>${rows}</tbody></table>${total}` : '<p style="font-size:12px;color:#6b7280;">해당 항목 없음</p>'}
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

  const staffCols = data.todoSummary.staffColumns ?? []
  const matrixRows = data.todoSummary.matrixRows ?? []
  const todoMatrixHeader =
    staffCols.length > 0
      ? `<tr style="background:#f9fafb;">
          <th style="padding:6px 8px;text-align:left;font-size:11px;">할 일</th>
          <th style="padding:6px 8px;text-align:center;font-size:11px;">상태</th>
          ${staffCols.map((s) => `<th style="padding:6px 4px;text-align:center;font-size:11px;">${esc(s.name)}</th>`).join('')}
        </tr>`
      : `<tr style="background:#f9fafb;">
          <th style="padding:6px 8px;text-align:left;font-size:11px;">할 일</th>
          <th style="padding:6px 8px;text-align:center;font-size:11px;">상태</th>
        </tr>`

  const formatStaffTime = (iso: string | null | undefined) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleTimeString('en-GB', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    } catch {
      return null
    }
  }

  const todoMatrixBody = matrixRows
    .map((row) => {
      const statusLabel =
        row.status === 'na'
          ? 'N/A'
          : row.status === 'completed'
            ? '완료'
            : row.status === 'on_hold'
              ? '보류'
              : '미처리'
      const statusColor =
        row.status === 'completed'
          ? '#059669'
          : row.status === 'pending'
            ? '#b45309'
            : '#6b7280'
      const doneAt = row.completedAtByEmail ?? {}
      const titleTime =
        formatStaffTime(row.completedAt) ||
        formatStaffTime(Object.values(doneAt).find((v): v is string => Boolean(v)) ?? null)
      const titleBadge = titleTime
        ? ` <span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:6px;border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46;font-size:10px;font-weight:600;font-variant-numeric:tabular-nums;vertical-align:middle;">${esc(titleTime)}</span>`
        : ''
      const checks = staffCols
        .map((s) => {
          const emailKey = s.email.toLowerCase()
          const at =
            doneAt[emailKey] ??
            (row.completedByEmails.some((e) => e.toLowerCase() === emailKey)
              ? row.completedAt
              : null)
          const timeLabel = formatStaffTime(at)
          return `<td style="padding:6px 4px;text-align:center;font-size:11px;color:${timeLabel ? '#047857' : '#d1d5db'};font-variant-numeric:tabular-nums;">${timeLabel ? esc(timeLabel) : '·'}</td>`
        })
        .join('')

      const activity = (row.activityItems ?? [])
        .slice(0, 12)
        .map((item) => {
          const changeText = item.changes
            .map((ch) => `${ch.fieldLabel}: ${ch.before} → ${ch.after}`)
            .join(' · ')
          const when = formatStaffTime(item.at) || ''
          return `<div style="font-size:11px;color:#4b5563;margin:2px 0;">${esc(item.subject)} · ${esc(item.actorName || item.actorEmail || '—')}${when ? ` · ${esc(when)}` : ''}${changeText ? ` — ${esc(changeText)}` : ''}</div>`
        })
        .join('')

      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:top;">
          ${esc(row.title)}${titleBadge}
          ${activity ? `<div style="margin-top:4px;">${activity}</div>` : ''}
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:center;font-size:11px;color:${statusColor};vertical-align:top;">${statusLabel}</td>
        ${checks}
      </tr>`
    })
    .join('')

  const todoBody = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      ${statRow('완료', `${data.todoSummary.completedCount}건`)}
      ${statRow('미처리', `${data.todoSummary.pendingCount}건`)}
      ${statRow('보류', `${data.todoSummary.onHoldCount}건`)}
    </table>
    <p style="font-size:11px;color:#6b7280;margin:0 0 8px;">큐 없는 항목은 N/A · 완료 시각은 제목 옆 뱃지(HH:mm) · 고객 정보 검수 등은 변경 상세 포함</p>
    ${
      matrixRows.length
        ? `<table style="width:100%;border-collapse:collapse;"><thead>${todoMatrixHeader}</thead><tbody>${todoMatrixBody}</tbody></table>`
        : '<p style="font-size:12px;color:#6b7280;">표시할 Todo가 없습니다.</p>'
    }
    ${sectionNotes(data.todoSummary.notes)}
  `

  const tomorrowRows = data.tomorrowSchedule.tours
    .map((t) => {
      const statusText = getStatusText(t.tourStatus, 'ko')
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${esc(t.productName)} <span style="display:inline-block;margin-left:4px;padding:1px 8px;border-radius:999px;background:#f1f5f9;font-size:11px;font-weight:600;">${esc(statusText)}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${esc(t.guideName ?? '—')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${esc(t.assistantName ?? '—')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;text-align:center;font-weight:600;">${t.guestCount}인</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:13px;">${esc(t.vehicleLabel ?? '—')}</td>
      </tr>`
    })
    .join('')

  const tomorrowBody = `
    <p style="margin:0 0 12px;color:#6b7280;font-size:14px;">${esc(tomorrowLabel)} — 투어 ${data.tomorrowSchedule.totalTours}건 · ${data.tomorrowSchedule.totalGuests}인 · 배정 필요 ${data.tomorrowSchedule.unassignedCount}건</p>
    ${tomorrowRows ? `<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f9fafb;"><th style="padding:8px;text-align:left;">상품</th><th>가이드</th><th>어시</th><th>인원</th><th>차량</th></tr></thead><tbody>${tomorrowRows}</tbody></table>` : '<p>내일 투어 없음</p>'}
    ${sectionNotes(data.tomorrowSchedule.notes)}
  `

  const formatActivityWhen = (iso: string) => {
    try {
      const d = new Date(iso)
      const md = d.toLocaleDateString('en-US', {
        timeZone: 'America/Los_Angeles',
        month: 'numeric',
        day: 'numeric',
      })
      const hm = d.toLocaleTimeString('en-GB', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      return `${md} ${hm}`
    } catch {
      return iso
    }
  }

  const activityHistory = data.activityHistory ?? { groups: [], items: [], totalCount: 0 }
  const activityGroupsHtml = (activityHistory.groups ?? [])
    .map((group) => {
      const rows = group.items
        .map((item) => {
          const actionKind = item.actionKind ?? 'edit'
          const emoji = actionKind === 'add' ? '➕' : actionKind === 'delete' ? '❌' : '🔁'
          const badgeStyle =
            actionKind === 'add'
              ? 'border:1px solid #bae6fd;background:#f0f9ff;color:#075985;'
              : actionKind === 'delete'
                ? 'border:1px solid #fecdd3;background:#fff1f2;color:#9f1239;'
                : 'border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46;'
          const contentBadges =
            (item.badges ?? []).length > 0 ? item.badges! : [item.actionLabel || '변경']
          const badges = contentBadges
            .map(
              (b) =>
                `<span title="${esc(item.actionLabel)}" style="display:inline-block;margin-left:4px;padding:1px 6px;border-radius:6px;${badgeStyle}font-size:10px;font-weight:600;vertical-align:middle;">${emoji} ${esc(b)}</span>`
            )
            .join('')
          return `<tr>
            <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;white-space:nowrap;vertical-align:top;">${esc(formatActivityWhen(item.at))}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:top;">${esc(item.summary)}${badges}</td>
          </tr>`
        })
        .join('')
      return `<div style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <div style="padding:8px 10px;background:#f9fafb;font-size:13px;font-weight:600;display:flex;justify-content:space-between;">
          <span>${esc(group.actorName)}</span>
          <span style="font-weight:500;color:#6b7280;font-size:11px;">${group.items.length}건</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>`
    })
    .join('')

  const activityBody = `
    <p style="font-size:11px;color:#6b7280;margin:0 0 8px;">사이트 활동 ${activityHistory.totalCount}건 · 라스베가스 현지 시간 기준 · 직원별 예약·투어·부킹 변경</p>
    ${
      activityGroupsHtml ||
      '<p style="font-size:12px;color:#6b7280;">표시할 활동이 없습니다.</p>'
    }
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
      ${tourReportBody ? sectionBlock('투어 리포트 현황', tourReportBody) : ''}
      ${financialBody ? sectionBlock('재무 보고', financialBody) : ''}
      ${singleDay ? sectionBlock('TODO 처리 현황 (사용자별)', todoBody) : ''}
      ${sectionBlock('활동 히스토리', activityBody)}
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
