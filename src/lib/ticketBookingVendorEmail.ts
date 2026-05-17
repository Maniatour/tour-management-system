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

function buildEmailCardHtml(options: {
  badge: string
  company: string
  rows: CardRow[]
  footerHtml: string
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
    ' style="max-width:480px;border-collapse:separate;border:1px solid #94a3b8;border-radius:12px;',
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

  if (rn) {
    plainLines.push(`RN #: ${rn}`)
    rows.push({ label: 'RN #', plain: rn, html: escapeHtml(rn) })
  }
  plainLines.push(`Check-in: ${dateLabel}`)
  rows.push({ label: 'Check-in', plain: dateLabel, html: escapeHtml(dateLabel) })
  plainLines.push(`Pax: ${qty}`)
  rows.push({ label: 'Pax', plain: qty, html: redBoldHtml(qty) })
  plainLines.push(`Time: ${timeLabel}`)
  rows.push({ label: 'Time', plain: timeLabel, html: redBoldHtml(timeLabel) })

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
    ...(rn ? [{ plain: `RN #: ${rn}`, html: fullLineHtml('RN #', escapeHtml(rn)) }] : []),
    {
      plain: `Check-in: ${dateLabel}`,
      html: fullLineHtml('Check-in', escapeHtml(dateLabel)),
    },
    { plain: `Pax: ${qty}`, html: fullLineHtml('Pax', redBoldHtml(qty)) },
    { plain: `Time: ${timeLabel}`, html: fullLineHtml('Time', redBoldHtml(timeLabel)) },
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
  }
  plainLines.push(`Check-in: ${dateLabel}`)
  rows.push({ label: 'Check-in', plain: dateLabel, html: escapeHtml(dateLabel) })
  plainLines.push(plainArrow('Pax', String(curQty), String(reqQty), qtyChanged))
  rows.push({
    label: 'Pax',
    plain: String(curQty),
    html: htmlArrow(String(curQty), String(reqQty), qtyChanged),
  })
  plainLines.push(plainArrow('Time', curTime, reqTime, timeChanged))
  rows.push({
    label: 'Time',
    plain: curTime,
    html: htmlArrow(curTime, reqTime, timeChanged),
  })

  if (note) {
    plainLines.push(`Note: ${note}`)
    rows.push({ label: 'Note', plain: note, html: escapeHtml(note) })
  }

  const footerHtml = signOffHtml(input.submitterDisplayName)
  const textLines: TextLine[] = [
    { plain: 'Hi,', html: 'Hi,' },
    {
      plain: 'Change request:',
      html: '<strong style="color:#0f172a">Change request:</strong>',
    },
    ...(rn ? [{ plain: `RN #: ${rn}`, html: fullLineHtml('RN #', escapeHtml(rn)) }] : []),
    {
      plain: `Check-in: ${dateLabel}`,
      html: fullLineHtml('Check-in', escapeHtml(dateLabel)),
    },
    {
      plain: plainArrow('Pax', String(curQty), String(reqQty), qtyChanged),
      html: fullLineHtml('Pax', htmlArrow(String(curQty), String(reqQty), qtyChanged)),
    },
    {
      plain: plainArrow('Time', curTime, reqTime, timeChanged),
      html: fullLineHtml('Time', htmlArrow(curTime, reqTime, timeChanged)),
    },
    ...(note ? [{ plain: `Note: ${note}`, html: fullLineHtml('Note', escapeHtml(note)) }] : []),
  ]

  const bodyPlain = `${joinPlain(plainLines)}\n\n${signOffPlain(input.submitterDisplayName)}`
  const bodyHtml = buildEmailCardHtml({
    badge: 'Change Request',
    company,
    rows,
    footerHtml,
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
