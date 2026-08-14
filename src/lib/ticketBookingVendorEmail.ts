/**
 * Vendor email drafts — English, compact plain text + card-style HTML.
 */

export type TicketBookingVendorEmailDraft = {
  subject: string
  bodyPlain: string
  /** 카드형 HTML (풀 디자인) */
  bodyHtml: string
  /** 텍스트 탭: 줄 단위 HTML — 붙여넣기 시 빨간 볼드 유지 */
  bodyTextHtml: string
}

export type TicketBookingRequestEmailInput = {
  company: string
  checkInDate: string
  time: string
  quantity: number
  category?: string
  rnNumber?: string | null
  note?: string | null
  reservationName?: string | null
  submitterDisplayName?: string | null
}

export type TicketBookingVendorEmailSameDayTicket = {
  id?: string | undefined
  rnNumber?: string | null | undefined
  checkInDate: string
  time: string
  quantity: number
  /** 변경 전 수량 — 있으면 Pax를 `4 → 7` 형태로 표시 */
  previousQuantity?: number | undefined
  /** 변경 전 시간 — 있으면 Time을 `10:15 → 09:30` 형태로 표시 */
  previousTime?: string | undefined
  /** 이번 변경 요청 대상 행 */
  isCurrent?: boolean | undefined
}

export type TicketBookingChangeRequestEmailInput = {
  company: string
  checkInDate: string
  rnNumber?: string | null
  category?: string | null
  currentQuantity: number
  currentTime: string
  requestedQuantity: number
  requestedTime: string
  note?: string | null
  submitterDisplayName?: string | null
  /** 같은 체크인일·같은 업체 티켓 (현재 건 포함) */
  sameDayTickets?: TicketBookingVendorEmailSameDayTicket[]
}

const RED_BOLD_OPEN = '<span style="color:#dc2626;font-weight:700">'
const RED_BOLD_CLOSE = '</span>'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function redBoldHtml(value: string): string {
  return `${RED_BOLD_OPEN}${escapeHtml(value)}${RED_BOLD_CLOSE}`
}

function formatCheckInDateCompact(ymd: string): string {
  const s = String(ymd || '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s || '—'
}

export function formatTicketBookingCategoryLabel(category: string): string {
  const s = String(category || '').trim()
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatTicketBookingVendorEmailTime(raw: string | null | undefined): string {
  if (!raw) return '—'
  const s = String(raw).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5) || '—'
}

type CardRow = { label: string; plain: string; html: string }

type TextLine = { plain: string; html: string }

function fullLineHtml(label: string, valueHtml: string): string {
  return `${escapeHtml(label)}: ${valueHtml}`
}

function buildSimpleTextEmailBody(lines: TextLine[], footerHtml: string): string {
  const blocks = lines.map(
    (l) =>
      `<p style="margin:0 0 6px;font-size:14px;line-height:1.55;color:#111827;font-family:Arial,Helvetica,sans-serif">${l.html}</p>`
  )
  blocks.push(
    `<div style="margin-top:12px;font-family:Arial,Helvetica,sans-serif">${footerHtml}</div>`
  )
  return blocks.join('')
}

function plainArrow(label: string, from: string, to: string, changed: boolean): string {
  if (!changed || from === to) return `${label}: ${from}`
  return `${label}: ${from} → ${to}`
}

function htmlArrow(from: string, to: string, changed: boolean): string {
  if (!changed || from === to) return escapeHtml(from)
  return `${escapeHtml(from)} &rarr; ${redBoldHtml(to)}`
}

function signOffPlain(displayName: string | null | undefined): string {
  const name = String(displayName || '').trim()
  return name ? `Thanks\n${name}` : 'Thanks'
}

function signOffHtml(displayName: string | null | undefined): string {
  const name = String(displayName || '').trim()
  if (!name) {
    return '<div style="font-size:14px;font-weight:600;color:#0f172a">Thanks</div>'
  }
  return [
    '<div style="font-size:14px;color:#64748b">Thanks</div>',
    `<div style="font-size:15px;font-weight:700;color:#0f172a;margin-top:4px">${escapeHtml(name)}</div>`,
  ].join('')
}

function compareSameDayTickets(
  a: TicketBookingVendorEmailSameDayTicket,
  b: TicketBookingVendorEmailSameDayTicket
): number {
  const ta = formatTicketBookingVendorEmailTime(a.time)
  const tb = formatTicketBookingVendorEmailTime(b.time)
  if (ta !== tb) return ta.localeCompare(tb)
  const ra = String(a.rnNumber || '').trim()
  const rb = String(b.rnNumber || '').trim()
  if (ra !== rb) return ra.localeCompare(rb)
  return String(a.id || '').localeCompare(String(b.id || ''))
}

function sameDayPaxChanged(ticket: TicketBookingVendorEmailSameDayTicket): boolean {
  const to = Number.isFinite(ticket.quantity) ? ticket.quantity : 0
  const from = ticket.previousQuantity
  return from != null && Number.isFinite(from) && from !== to
}

function sameDayPaxPlain(ticket: TicketBookingVendorEmailSameDayTicket): string {
  const to = Number.isFinite(ticket.quantity) ? String(ticket.quantity) : '0'
  if (!sameDayPaxChanged(ticket)) return to
  return `${ticket.previousQuantity} → ${to}`
}

function sameDayPaxHtml(ticket: TicketBookingVendorEmailSameDayTicket): string {
  const to = Number.isFinite(ticket.quantity) ? String(ticket.quantity) : '0'
  if (!sameDayPaxChanged(ticket)) return escapeHtml(to)
  return htmlArrow(String(ticket.previousQuantity), to, true)
}

function sameDayTimeChanged(ticket: TicketBookingVendorEmailSameDayTicket): boolean {
  const to = formatTicketBookingVendorEmailTime(ticket.time)
  const from = ticket.previousTime
    ? formatTicketBookingVendorEmailTime(ticket.previousTime)
    : ''
  return Boolean(from && from !== '—' && from !== to)
}

function sameDayTimePlain(ticket: TicketBookingVendorEmailSameDayTicket): string {
  const to = formatTicketBookingVendorEmailTime(ticket.time)
  if (!sameDayTimeChanged(ticket)) return to
  return `${formatTicketBookingVendorEmailTime(ticket.previousTime)} → ${to}`
}

function sameDayTimeHtml(ticket: TicketBookingVendorEmailSameDayTicket): string {
  const to = formatTicketBookingVendorEmailTime(ticket.time)
  if (!sameDayTimeChanged(ticket)) return escapeHtml(to)
  return htmlArrow(formatTicketBookingVendorEmailTime(ticket.previousTime), to, true)
}

function formatSameDayTicketPlain(ticket: TicketBookingVendorEmailSameDayTicket): string {
  const rn = String(ticket.rnNumber || '').trim() || '—'
  const date = formatCheckInDateCompact(ticket.checkInDate)
  const time = sameDayTimePlain(ticket)
  const qty = sameDayPaxPlain(ticket)
  const mark = ticket.isCurrent ? '  ← this request' : ''
  return `RN # ${rn} · Check-in ${date} · Time ${time} · Pax ${qty}${mark}`
}

function buildSameDayReferenceHtml(tickets: TicketBookingVendorEmailSameDayTicket[]): string {
  if (tickets.length === 0) return ''
  const headerCell =
    'padding:8px 8px;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;background:#e2e8f0;border-bottom:1px solid #cbd5e1;text-align:left;white-space:nowrap'
  const rowsHtml = tickets
    .map((ticket, i) => {
      const rn = String(ticket.rnNumber || '').trim() || '—'
      const date = formatCheckInDateCompact(ticket.checkInDate)
      const timeHtml = sameDayTimeHtml(ticket)
      const qtyHtml = sameDayPaxHtml(ticket)
      const border = i < tickets.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''
      const bg = ticket.isCurrent ? 'background:#eff6ff;' : 'background:#ffffff;'
      const weight =
        ticket.isCurrent || sameDayPaxChanged(ticket) || sameDayTimeChanged(ticket)
          ? 'font-weight:700;'
          : ''
      const rnHtml = ticket.isCurrent
        ? `${escapeHtml(rn)}<div style="font-size:10px;font-weight:600;color:#2563eb;margin-top:2px">this request</div>`
        : escapeHtml(rn)
      const cell = `padding:8px;${border}${bg}${weight}font-size:12px;color:#0f172a;vertical-align:top`
      return [
        '<tr>',
        `<td style="${cell}">${rnHtml}</td>`,
        `<td style="${cell}">${escapeHtml(date)}</td>`,
        `<td style="${cell}">${timeHtml}</td>`,
        `<td style="${cell}">${qtyHtml}</td>`,
        '</tr>',
      ].join('')
    })
    .join('')

  return [
    '<div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;margin:0 0 8px">',
    'Same-day tickets (reference)',
    '</div>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"',
    ' style="border-collapse:separate;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden">',
    '<tr>',
    `<th style="${headerCell}">RN #</th>`,
    `<th style="${headerCell}">Check-in</th>`,
    `<th style="${headerCell}">Time</th>`,
    `<th style="${headerCell}">Pax</th>`,
    '</tr>',
    rowsHtml,
    '</table>',
  ].join('')
}

function buildEmailCardHtml(options: {
  badge: string
  company: string
  rows: CardRow[]
  footerHtml: string
  extraHtml?: string
}): string {
  const rowsHtml = options.rows
    .map((r, i) => {
      const border =
        i < options.rows.length - 1 ? 'border-bottom:1px solid #e2e8f0;' : ''
      return [
        '<tr>',
        `<td style="padding:10px 14px;${border}font-size:12px;font-weight:600;color:#64748b;width:100px;vertical-align:middle;white-space:nowrap">`,
        escapeHtml(r.label),
        '</td>',
        `<td style="padding:10px 14px;${border}font-size:14px;color:#0f172a;vertical-align:middle">`,
        r.html,
        '</td>',
        '</tr>',
      ].join('')
    })
    .join('')

  const companyBlock =
    options.company && options.company !== '—' ?
      [
        '<div style="font-size:17px;font-weight:700;color:#ffffff;margin-top:6px;letter-spacing:-0.02em">',
        escapeHtml(options.company),
        '</div>',
      ].join('')
    : ''

  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"',
    ' style="max-width:540px;border-collapse:separate;border:1px solid #94a3b8;border-radius:12px;',
    'overflow:hidden;background:#ffffff;box-shadow:0 4px 14px rgba(15,23,42,0.08)">',
    '<tr>',
    '<td style="background:linear-gradient(135deg,#1d4ed8 0%,#1e3a8a 100%);padding:16px 18px">',
    '<div style="display:block;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;',
    'color:#bfdbfe;font-weight:700">',
    escapeHtml(options.badge),
    '</div>',
    companyBlock,
    '</td>',
    '</tr>',
    '<tr>',
    '<td style="padding:18px 18px 14px;font-size:14px;color:#334155;line-height:1.5">Hi,</td>',
    '</tr>',
    '<tr>',
    '<td style="padding:0 16px 16px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"',
    ' style="border-collapse:separate;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#f8fafc">',
    rowsHtml,
    '</table>',
    '</td>',
    '</tr>',
    ...(options.extraHtml
      ? [
          '<tr>',
          '<td style="padding:0 16px 16px">',
          options.extraHtml,
          '</td>',
          '</tr>',
        ]
      : []),
    '<tr>',
    '<td style="padding:14px 18px;background:#f1f5f9;border-top:1px solid #e2e8f0">',
    options.footerHtml,
    '</td>',
    '</tr>',
    '</table>',
  ].join('')
}

function joinPlain(lines: string[]): string {
  return lines.filter(Boolean).join('\n')
}

export function wrapTicketBookingVendorEmailBodyHtml(innerHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111827;padding:4px 0">${innerHtml}</div>`
}

export function buildTicketBookingVendorEmailHtmlDocument(bodyHtml: string): string {
  const wrapped = wrapTicketBookingVendorEmailBodyHtml(bodyHtml)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#e2e8f0">${wrapped}</body></html>`
}

export function buildTicketBookingVendorTextHtmlDocument(bodyTextHtml: string): string {
  return buildTicketBookingVendorEmailHtmlDocument(bodyTextHtml)
}

export function buildTicketBookingRequestEmail(
  input: TicketBookingRequestEmailInput
): TicketBookingVendorEmailDraft {
  const company = String(input.company || '').trim() || '—'
  const dateLabel = formatCheckInDateCompact(input.checkInDate)
  const timeLabel = formatTicketBookingVendorEmailTime(input.time)
  const qty = Number.isFinite(input.quantity) ? String(input.quantity) : '0'
  const rn = String(input.rnNumber || '').trim()
  const note = String(input.note || '').trim()
  const guest = String(input.reservationName || '').trim()
  const category = input.category ? formatTicketBookingCategoryLabel(input.category) : ''

  const subject = `Booking Request — ${company} — ${dateLabel} ${timeLabel}`

  const plainLines = ['Hi,', 'Booking request:']
  const rows: CardRow[] = []

  const rnLabel = rn || '—'
  plainLines.push(`RN #: ${rnLabel}`)
  rows.push({ label: 'RN #', plain: rnLabel, html: escapeHtml(rnLabel) })
  plainLines.push(`Check-in: ${dateLabel}`)
  rows.push({ label: 'Check-in', plain: dateLabel, html: escapeHtml(dateLabel) })
  plainLines.push(`Time: ${timeLabel}`)
  rows.push({ label: 'Time', plain: timeLabel, html: redBoldHtml(timeLabel) })
  plainLines.push(`Pax: ${qty}`)
  rows.push({ label: 'Pax', plain: qty, html: redBoldHtml(qty) })

  if (category) {
    plainLines.push(`Category: ${category}`)
    rows.push({ label: 'Category', plain: category, html: escapeHtml(category) })
  }
  if (guest) {
    plainLines.push(`Guest: ${guest}`)
    rows.push({ label: 'Guest', plain: guest, html: escapeHtml(guest) })
  }
  if (note) {
    plainLines.push(`Note: ${note}`)
    rows.push({ label: 'Note', plain: note, html: escapeHtml(note) })
  }

  const footerHtml = signOffHtml(input.submitterDisplayName)
  const textLines: TextLine[] = [
    { plain: 'Hi,', html: 'Hi,' },
    {
      plain: 'Booking request:',
      html: '<strong style="color:#0f172a">Booking request:</strong>',
    },
    { plain: `RN #: ${rnLabel}`, html: fullLineHtml('RN #', escapeHtml(rnLabel)) },
    {
      plain: `Check-in: ${dateLabel}`,
      html: fullLineHtml('Check-in', escapeHtml(dateLabel)),
    },
    { plain: `Time: ${timeLabel}`, html: fullLineHtml('Time', redBoldHtml(timeLabel)) },
    { plain: `Pax: ${qty}`, html: fullLineHtml('Pax', redBoldHtml(qty)) },
    ...(category ?
      [{ plain: `Category: ${category}`, html: fullLineHtml('Category', escapeHtml(category)) }]
    : []),
    ...(guest ? [{ plain: `Guest: ${guest}`, html: fullLineHtml('Guest', escapeHtml(guest)) }] : []),
    ...(note ? [{ plain: `Note: ${note}`, html: fullLineHtml('Note', escapeHtml(note)) }] : []),
  ]

  const bodyPlain = `${joinPlain(plainLines)}\n\n${signOffPlain(input.submitterDisplayName)}`
  const bodyHtml = buildEmailCardHtml({
    badge: 'Booking Request',
    company,
    rows,
    footerHtml,
  })
  const bodyTextHtml = buildSimpleTextEmailBody(textLines, footerHtml)

  return { subject, bodyPlain, bodyHtml, bodyTextHtml }
}

export function buildTicketBookingChangeRequestEmail(
  input: TicketBookingChangeRequestEmailInput
): TicketBookingVendorEmailDraft {
  const company = String(input.company || '').trim() || '—'
  const dateLabel = formatCheckInDateCompact(input.checkInDate)
  const curTime = formatTicketBookingVendorEmailTime(input.currentTime)
  const reqTime = formatTicketBookingVendorEmailTime(input.requestedTime)
  const curQty = Number.isFinite(input.currentQuantity) ? input.currentQuantity : 0
  const reqQty = Number.isFinite(input.requestedQuantity) ? input.requestedQuantity : 0
  const qtyChanged = curQty !== reqQty
  const timeChanged = curTime !== reqTime
  const rn = String(input.rnNumber || '').trim()
  const note = String(input.note || '').trim()

  const subject = rn ?
    `Change Request — ${company} — RN ${rn}`
  : `Change Request — ${company} — ${dateLabel}`

  const plainLines = ['Hi,', 'Change request:']
  const rows: CardRow[] = []

  if (rn) {
    plainLines.push(`RN #: ${rn}`)
    rows.push({ label: 'RN #', plain: rn, html: escapeHtml(rn) })
  } else {
    plainLines.push('RN #: —')
    rows.push({ label: 'RN #', plain: '—', html: escapeHtml('—') })
  }
  plainLines.push(`Check-in: ${dateLabel}`)
  rows.push({ label: 'Check-in', plain: dateLabel, html: escapeHtml(dateLabel) })
  plainLines.push(plainArrow('Time', curTime, reqTime, timeChanged))
  rows.push({
    label: 'Time',
    plain: curTime,
    html: htmlArrow(curTime, reqTime, timeChanged),
  })
  plainLines.push(plainArrow('Pax', String(curQty), String(reqQty), qtyChanged))
  rows.push({
    label: 'Pax',
    plain: String(curQty),
    html: htmlArrow(String(curQty), String(reqQty), qtyChanged),
  })

  if (note) {
    plainLines.push(`Note: ${note}`)
    rows.push({ label: 'Note', plain: note, html: escapeHtml(note) })
  }

  const currentSameDay: TicketBookingVendorEmailSameDayTicket = {
    rnNumber: rn || null,
    checkInDate: dateLabel,
    time: reqTime,
    previousTime: curTime,
    quantity: reqQty,
    previousQuantity: curQty,
    isCurrent: true,
  }
  const sameDayTickets = [...(input.sameDayTickets ?? [])].map((ticket) =>
    ticket.isCurrent
      ? {
          ...ticket,
          previousQuantity: curQty,
          quantity: reqQty,
          previousTime: curTime,
          time: reqTime,
          isCurrent: true,
        }
      : ticket
  )
  if (sameDayTickets.length === 0) {
    sameDayTickets.push(currentSameDay)
  }
  sameDayTickets.sort(compareSameDayTickets)

  plainLines.push('')
  plainLines.push('Same-day tickets (reference):')
  for (const ticket of sameDayTickets) {
    plainLines.push(formatSameDayTicketPlain(ticket))
  }

  const footerHtml = signOffHtml(input.submitterDisplayName)
  const textLines: TextLine[] = [
    { plain: 'Hi,', html: 'Hi,' },
    {
      plain: 'Change request:',
      html: '<strong style="color:#0f172a">Change request:</strong>',
    },
    { plain: `RN #: ${rn || '—'}`, html: fullLineHtml('RN #', escapeHtml(rn || '—')) },
    {
      plain: `Check-in: ${dateLabel}`,
      html: fullLineHtml('Check-in', escapeHtml(dateLabel)),
    },
    {
      plain: plainArrow('Time', curTime, reqTime, timeChanged),
      html: fullLineHtml('Time', htmlArrow(curTime, reqTime, timeChanged)),
    },
    {
      plain: plainArrow('Pax', String(curQty), String(reqQty), qtyChanged),
      html: fullLineHtml('Pax', htmlArrow(String(curQty), String(reqQty), qtyChanged)),
    },
    ...(note ? [{ plain: `Note: ${note}`, html: fullLineHtml('Note', escapeHtml(note)) }] : []),
    { plain: '', html: '&nbsp;' },
    {
      plain: 'Same-day tickets (reference):',
      html: '<strong style="color:#0f172a">Same-day tickets (reference):</strong>',
    },
    ...sameDayTickets.map((ticket) => ({
      plain: formatSameDayTicketPlain(ticket),
      html: escapeHtml(formatSameDayTicketPlain(ticket)),
    })),
  ]

  const bodyPlain = `${plainLines.join('\n')}\n\n${signOffPlain(input.submitterDisplayName)}`
  const bodyHtml = buildEmailCardHtml({
    badge: 'Change Request',
    company,
    rows,
    footerHtml,
    extraHtml: buildSameDayReferenceHtml(sameDayTickets),
  })
  const bodyTextHtml = buildSimpleTextEmailBody(textLines, footerHtml)

  return { subject, bodyPlain, bodyHtml, bodyTextHtml }
}

export function formatTicketBookingVendorEmailPlainClipboard(
  subject: string,
  bodyPlain: string
): string {
  return `Subject: ${subject}\n\n${bodyPlain}`
}
