import { CATALOG_GROUP_ORDER } from '@/lib/vehicleMaintenanceCatalog'
import enMessages from '@/i18n/locales/en.json'

const enVm = enMessages.vehicleMaintenance
const enForm = enVm.form
const enSchedule = enVm.schedule
const enCatalogGroups = enVm.catalogGroups as Record<string, string>
const enSubcategories = enVm.subcategories as Record<string, string>
const enMaintenanceTypes = enVm.maintenanceTypes as Record<string, string>

export type VehicleMaintenancePrintWorkItem = {
  groupKey: string
  label: string
  interval: string | null
  lastService: string | null
  checked: boolean
}

export type VehicleMaintenancePrintInput = {
  vehicleLabel: string
  /** Blank template: large name at top of the page */
  vehicleHeroName?: string
  vehicleNumber?: string | null
  vehicleType?: string | null
  vin?: string | null
  /** Pre-printed blank form for handwriting on site */
  blankTemplate?: boolean
  categoryLabel: string
  maintenanceDate: string
  mileage: string
  maintenanceTypeKey: string
  workItems: VehicleMaintenancePrintWorkItem[]
  description: string
  totalCost: string
  laborCost: string
  partsCost: string
  otherCost: string
  paymentMethodLabel: string
  serviceProvider: string
  serviceProviderAddress: string
  warrantyPeriod: string
  nextMaintenanceDate: string
  qualityRating: string
  satisfactionRating: string
  notes: string
  technicianNotes: string
  isScheduledMaintenance: boolean
  isEdit?: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatEnDate(iso: string): string {
  const trimmed = iso.trim()
  if (!trimmed) return '—'
  const d = new Date(`${trimmed}T12:00:00`)
  if (Number.isNaN(d.getTime())) return trimmed
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatEnDateShort(iso: string): string {
  const trimmed = iso.trim()
  if (!trimmed) return '—'
  const d = new Date(`${trimmed}T12:00:00`)
  if (Number.isNaN(d.getTime())) return trimmed
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
}

function formatMileageWriteValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '.'
  const n = Number(trimmed)
  return Number.isFinite(n) ? n.toLocaleString('en-US') : trimmed
}

function formatCurrencyWriteValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '.'
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return trimmed
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function writeFieldCell(
  label: string,
  value: string,
  mode: 'text' | 'currency' | 'suffix' = 'text',
  suffix?: string
): string {
  const hasValue = value.trim().length > 0
  const emptyClass = hasValue ? '' : ' write-line-empty'
  const display =
    mode === 'currency' ? formatCurrencyWriteValue(value) : hasValue ? value.trim() : '.'

  if (mode === 'currency') {
    return `<div class="write-field">
      <div class="section-title">${escapeHtml(label)}</div>
      <div class="currency-box">
        <span class="currency-unit">$</span>
        <div class="write-line write-line-currency${emptyClass}">${escapeHtml(display)}</div>
      </div>
    </div>`
  }

  if (mode === 'suffix' && suffix) {
    return `<div class="write-field">
      <div class="section-title">${escapeHtml(label)}</div>
      <div class="suffix-box">
        <div class="write-line${emptyClass}">${escapeHtml(display)}</div>
        <span class="suffix-unit">${escapeHtml(suffix)}</span>
      </div>
    </div>`
  }

  return `<div class="write-field">
    <div class="section-title">${escapeHtml(label)}</div>
    <div class="write-line${emptyClass}">${escapeHtml(display)}</div>
  </div>`
}

function kv(label: string, value: string): string {
  const display = value.trim() ? escapeHtml(value) : '—'
  return `<span class="kv"><b>${escapeHtml(label)}</b> ${display}</span>`
}

function checkboxCell(checked: boolean): string {
  return `<td class="check"><div class="checkbox${checked ? ' checked' : ''}"></div></td>`
}

function groupOrderIndex(groupKey: string): number {
  const idx = CATALOG_GROUP_ORDER.indexOf(groupKey as (typeof CATALOG_GROUP_ORDER)[number])
  return idx >= 0 ? idx : 999
}

function orderedGroupKeys(items: VehicleMaintenancePrintWorkItem[]): string[] {
  const keys = [...new Set(items.map((item) => item.groupKey))]
  return keys.sort((a, b) => {
    const orderDiff = groupOrderIndex(a) - groupOrderIndex(b)
    if (orderDiff !== 0) return orderDiff
    return a.localeCompare(b)
  })
}

function buildWorkTableRows(
  items: VehicleMaintenancePrintWorkItem[],
  groupKeys: string[]
): string {
  const byGroup = new Map<string, VehicleMaintenancePrintWorkItem[]>()
  for (const item of items) {
    const list = byGroup.get(item.groupKey) ?? []
    list.push(item)
    byGroup.set(item.groupKey, list)
  }

  const rows: string[] = []
  for (const groupKey of groupKeys) {
    const groupItems = byGroup.get(groupKey)
    if (!groupItems?.length) continue
    const groupLabel = enCatalogGroups[groupKey] ?? groupKey
    rows.push(`<tr class="group-row"><td colspan="3">${escapeHtml(groupLabel)}</td></tr>`)
    for (const item of groupItems) {
      rows.push(
        `<tr class="work-row">
          ${checkboxCell(item.checked)}
          <td class="label">${escapeHtml(item.label)}</td>
          <td class="num">${escapeHtml(item.interval ?? '—')}</td>
        </tr>`
      )
    }
  }
  return rows.join('')
}

function workTableHead(): string {
  return `<thead><tr>
    <th></th>
    <th>${escapeHtml(enForm.subcategory)}</th>
    <th class="num">Int.</th>
  </tr></thead>`
}

const WORK_CHECKLIST_COLUMNS = 3

function splitGroupsIntoColumns(
  groupKeys: string[],
  items: VehicleMaintenancePrintWorkItem[],
  columnCount: number
): string[][] {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item.groupKey, (counts.get(item.groupKey) ?? 0) + 1)
  }

  const columns: string[][] = Array.from({ length: columnCount }, () => [])
  const columnWeights = Array(columnCount).fill(0)

  for (const groupKey of groupKeys) {
    const weight = counts.get(groupKey) ?? 0
    let targetCol = 0
    for (let i = 1; i < columnCount; i++) {
      if (columnWeights[i] < columnWeights[targetCol]) targetCol = i
    }
    columns[targetCol].push(groupKey)
    columnWeights[targetCol] += weight
  }

  return columns
}

function buildWorkChecklistSection(items: VehicleMaintenancePrintWorkItem[]): string {
  if (items.length === 0) {
    return `<p class="muted">—</p>`
  }

  const groupKeys = orderedGroupKeys(items)
  const columnGroups = splitGroupsIntoColumns(groupKeys, items, WORK_CHECKLIST_COLUMNS)

  const renderCol = (keys: string[]) => {
    const body = buildWorkTableRows(items, keys)
    if (!body) return ''
    return `<div class="work-col"><table class="work-table">${workTableHead()}<tbody>${body}</tbody></table></div>`
  }

  const cols = columnGroups.map(renderCol).filter(Boolean)
  if (cols.length === 0) return `<p class="muted">—</p>`

  return `<div class="work-cols work-cols-3">${cols.join('')}</div>`
}

function getPrintStyles(): string {
  return `
    @page { size: letter; margin: 0.32in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc { width: 100%; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 8px;
      border-bottom: 1.5px solid #111;
      padding-bottom: 4px;
      margin-bottom: 5px;
    }
    .title { font-size: 11pt; font-weight: 700; margin: 0; line-height: 1.1; }
    .vehicle-hero {
      text-align: center;
      margin-bottom: 5px;
      padding-bottom: 4px;
      border-bottom: 2px solid #111;
    }
    .vehicle-hero-name {
      font-size: 21pt;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.02em;
      word-break: break-word;
    }
    .vehicle-hero-meta {
      font-size: 8pt;
      color: #444;
      margin-top: 3px;
    }
    .write-line-date-lg {
      min-height: 2.1em;
      font-size: 10pt;
    }
    .page-break { page-break-before: always; break-before: page; }
    .meta { text-align: right; font-size: 6.5pt; color: #444; white-space: nowrap; }
    .kv-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 2px 10px;
      font-size: 7pt;
      margin-bottom: 4px;
    }
    .kv b { font-weight: 700; color: #333; }
    .section { margin-bottom: 4px; }
    .section-title {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #444;
      margin-bottom: 2px;
    }
    .text-block {
      border: 1px solid #ccc;
      padding: 2px 4px;
      min-height: 1.4em;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 7pt;
    }
    .text-block-description {
      min-height: 5.5em;
      padding: 5px 6px;
      font-size: 7.5pt;
      line-height: 1.35;
    }
    .text-block-notes {
      min-height: 3.8em;
      padding: 4px 6px;
      font-size: 7pt;
      line-height: 1.35;
    }
    .write-fields-row {
      display: grid;
      grid-template-columns: 1fr minmax(88px, 32%);
      gap: 8px;
      margin-bottom: 4px;
    }
    .service-top-row {
      display: grid;
      grid-template-columns: 1.05fr 0.8fr 1.35fr 0.7fr;
      gap: 6px;
      margin-bottom: 4px;
    }
    .write-line {
      border: 1px solid #bbb;
      border-radius: 1px;
      min-height: 1.75em;
      font-size: 8pt;
      font-weight: 600;
      padding: 4px 6px;
      background: #fafafa;
    }
    .mileage-box,
    .suffix-box {
      display: flex;
      align-items: stretch;
      border: 1px solid #bbb;
      border-radius: 1px;
      background: #fafafa;
      min-height: 1.75em;
    }
    .mileage-box .write-line,
    .suffix-box .write-line {
      flex: 1;
      border: none;
      border-radius: 0;
      background: transparent;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .suffix-box .write-line { text-align: left; }
    .mileage-unit,
    .suffix-unit {
      display: flex;
      align-items: center;
      padding: 0 6px;
      font-size: 7pt;
      color: #666;
      border-left: 1px solid #bbb;
      white-space: nowrap;
    }
    .write-line-empty { color: transparent; }
    .cost-fields-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      margin-bottom: 4px;
    }
    .write-field { min-width: 0; }
    .currency-box {
      display: flex;
      align-items: stretch;
      border: 1px solid #bbb;
      border-radius: 1px;
      background: #fafafa;
      min-height: 1.75em;
    }
    .currency-box .write-line {
      flex: 1;
      border: none;
      border-radius: 0;
      background: transparent;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .currency-unit {
      display: flex;
      align-items: center;
      padding: 0 5px;
      font-size: 7pt;
      color: #666;
      border-right: 1px solid #bbb;
      white-space: nowrap;
    }
    .notes-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }
    .muted { color: #666; font-size: 7pt; margin: 0; }
    .work-cols { display: flex; gap: 4px; align-items: flex-start; }
    .work-cols-3 .work-col { flex: 1; min-width: 0; max-width: 33.34%; }
    .work-col { flex: 1; min-width: 0; }
    .work-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6.5pt;
      table-layout: fixed;
    }
    .work-table th, .work-table td {
      border: 1px solid #bbb;
      padding: 1px 2px;
      vertical-align: middle;
    }
    .work-table th {
      background: #eee;
      font-weight: 700;
      font-size: 6pt;
      text-transform: uppercase;
    }
    .work-table .group-row td {
      background: #f0f0f0;
      font-weight: 700;
      font-size: 6pt;
      padding-top: 2px;
    }
    .work-table th:first-child,
    .work-table .check {
      width: 14px;
      max-width: 14px;
      min-width: 14px;
      padding-left: 2px;
      padding-right: 2px;
      text-align: center;
    }
    .work-table .label { word-break: break-word; font-size: 7pt; line-height: 1.3; }
    .work-table .num { text-align: right; white-space: nowrap; font-size: 6.5pt; width: 52px; min-width: 52px; max-width: 52px; }
    .work-cols-3 .work-table { font-size: 7pt; }
    .work-cols-3 .work-table th { font-size: 6.5pt; }
    .work-cols-3 .work-table .group-row td { font-size: 7pt; }
    .work-table .work-row { page-break-inside: avoid; break-inside: avoid; }
    .checkbox {
      width: 10px;
      height: 10px;
      border: 1px solid #222;
      margin: 0 auto;
      position: relative;
      background: #fff;
    }
    .checkbox.checked::after {
      content: '';
      position: absolute;
      left: 3px;
      top: 0px;
      width: 3px;
      height: 7px;
      border: solid #111;
      border-width: 0 1.5px 1.5px 0;
      transform: rotate(45deg);
    }
    .footer {
      margin-top: 4px;
      padding-top: 3px;
      border-top: 1px solid #ccc;
      font-size: 6pt;
      color: #666;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .sig-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 5px;
    }
    .write-line-sig {
      min-height: 2em;
    }
  `
}

export function buildVehicleMaintenancePrintHtml(input: VehicleMaintenancePrintInput): string {
  const isBlank = Boolean(input.blankTemplate)
  const title = isBlank
    ? 'Vehicle Maintenance Form'
    : input.isEdit
      ? 'Vehicle Maintenance Record (Edit)'
      : 'Vehicle Maintenance Record'
  const vehicleMeta = [
    input.vehicleNumber?.trim() ? `#${input.vehicleNumber.trim()}` : null,
    input.vehicleType?.trim() || null,
    input.vin?.trim() ? `VIN ${input.vin.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const maintenanceTypeLabel =
    (enMaintenanceTypes[input.maintenanceTypeKey] ?? input.maintenanceTypeKey) || '—'

  const scheduledSuffix = input.isScheduledMaintenance ? ' · Scheduled' : ''
  const nextDate = input.nextMaintenanceDate.trim()
    ? ` · Next ${formatEnDateShort(input.nextMaintenanceDate)}`
    : ''

  const checkedCount = input.workItems.filter((item) => item.checked).length
  const heroName = (input.vehicleHeroName || input.vehicleLabel).trim() || 'Vehicle'
  const showDate = isBlank ? '' : input.maintenanceDate.trim()
  const showMileage = isBlank ? '' : input.mileage.trim()

  const qualityLine =
    !isBlank && input.qualityRating.trim()
    ? kv('Quality', input.qualityRating)
    : ''
  const satisfactionLine =
    !isBlank && input.satisfactionRating.trim()
      ? kv('Satisfaction', input.satisfactionRating)
      : ''

  const heroBlock = isBlank
    ? `<div class="vehicle-hero">
        <div class="vehicle-hero-name">${escapeHtml(heroName)}</div>
        ${vehicleMeta ? `<div class="vehicle-hero-meta">${escapeHtml(vehicleMeta)}</div>` : ''}
      </div>`
    : ''

  const serviceTopRow = `<div class="service-top-row">
      <div class="write-field">
        <div class="section-title">${escapeHtml(enForm.maintenanceDate)}</div>
        <div class="write-line${isBlank ? ' write-line-date-lg' : ''}${showDate ? '' : ' write-line-empty'}">${escapeHtml(showDate ? formatEnDate(showDate) : '.')}</div>
      </div>
      <div class="write-field">
        <div class="section-title">${escapeHtml(enForm.mileage)}</div>
        <div class="mileage-box">
          <div class="write-line${showMileage ? '' : ' write-line-empty'}">${escapeHtml(formatMileageWriteValue(showMileage))}</div>
          <span class="mileage-unit">mi</span>
        </div>
      </div>
      ${writeFieldCell(enForm.serviceProvider, input.serviceProvider, 'text')}
      ${writeFieldCell(enForm.warrantyPeriod, input.warrantyPeriod, 'suffix', 'days')}
    </div>`

  const signatureRow = `<div class="sig-row">
      <div class="write-field">
        <div class="section-title">Technician / date</div>
        <div class="write-line write-line-sig write-line-empty">.</div>
      </div>
      <div class="write-field">
        <div class="section-title">Authorized / date</div>
        <div class="write-line write-line-sig write-line-empty">.</div>
      </div>
    </div>`

  return `<div class="doc">
    <div class="header">
      <h1 class="title">${escapeHtml(title)}</h1>
      ${
        isBlank
          ? ''
          : `<div class="meta"><div>${checkedCount}/${input.workItems.length} work items marked</div></div>`
      }
    </div>

    ${heroBlock}

    ${
      isBlank
        ? ''
        : `<div class="kv-strip">
      ${kv('Vehicle', input.vehicleLabel)}
      ${vehicleMeta ? `<span class="kv">${escapeHtml(vehicleMeta)}</span>` : ''}
      ${kv('Type', `${maintenanceTypeLabel}${scheduledSuffix}${nextDate}`)}
      ${kv('Category', input.categoryLabel)}
    </div>`
    }

    ${serviceTopRow}

    <div class="cost-fields-row">
      ${writeFieldCell(enForm.totalCost, input.totalCost, 'currency')}
      ${writeFieldCell(enForm.laborCost, input.laborCost, 'currency')}
      ${writeFieldCell(enForm.partsCost, input.partsCost, 'currency')}
      ${writeFieldCell(enForm.otherCost, input.otherCost, 'currency')}
      ${writeFieldCell('Payment', input.paymentMethodLabel, 'text')}
    </div>

    ${
      input.serviceProviderAddress.trim() || qualityLine || satisfactionLine
        ? `<div class="kv-strip">
      ${input.serviceProviderAddress.trim() ? kv('Address', input.serviceProviderAddress) : ''}
      ${qualityLine}
      ${satisfactionLine}
    </div>`
        : ''
    }

    <div class="section">
      <div class="section-title">${escapeHtml(enForm.description)}</div>
      <div class="text-block text-block-description">${escapeHtml(input.description.trim() || '')}</div>
    </div>

    <div class="section">
      <div class="section-title">${escapeHtml(enForm.subcategory)} — check work performed</div>
      ${buildWorkChecklistSection(input.workItems)}
    </div>

    <div class="section notes-row">
      <div>
        <div class="section-title">${escapeHtml(enForm.notes)}</div>
        <div class="text-block text-block-notes">${escapeHtml(input.notes.trim() || '')}</div>
      </div>
      <div>
        <div class="section-title">${escapeHtml(enForm.technicianNotes)}</div>
        <div class="text-block text-block-notes">${escapeHtml(input.technicianNotes.trim() || '')}</div>
      </div>
    </div>

    ${signatureRow}

    <div class="footer">
      <span>${isBlank ? 'Internal fleet form — mark boxes on site' : 'Internal fleet record — mark boxes on site'}</span>
      <span>${escapeHtml(heroName)}${showDate ? ` · ${escapeHtml(formatEnDate(showDate))}` : ''}</span>
    </div>
  </div>`
}

export function formatEnCatalogInterval(
  miles: number | null,
  months: number | null,
  isInspectionOnly: boolean
): string | null {
  if (isInspectionOnly) return 'Insp.'
  const parts: string[] = []
  if (miles != null) {
    parts.push(
      miles >= 1000
        ? `${Math.round(miles / 1000)}k mi`
        : enSchedule.intervalMiles.replace('{miles}', miles.toLocaleString('en-US'))
    )
  }
  if (months != null) {
    parts.push(`${months}mo`)
  }
  return parts.length > 0 ? parts.join('/') : null
}

export function formatEnLastServiceDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—'
  return formatEnDateShort(iso)
}

export function enLegacySubcategoryLabel(code: string): string {
  return enSubcategories[code] ?? code
}

function openPrintDocument(html: string, title: string): void {
  const safeTitle = title.replace(/</g, '')

  const DPI = 96
  const MARGIN_IN = 0.32
  const availW = Math.round((8.5 - 2 * MARGIN_IN) * DPI)
  const availH = Math.round((11 - 2 * MARGIN_IN) * DPI)

  const iframe = document.createElement('iframe')
  iframe.title = safeTitle
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:none;overflow:hidden;'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    return
  }

  iframeDoc.open()
  iframeDoc.write(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${safeTitle}</title>` +
      `<style>${getPrintStyles()}</style></head><body>` +
      `<div id="vm-print-fit" style="width:${availW}px;">${html}</div>` +
      `</body></html>`
  )
  iframeDoc.close()

  const printWin = iframe.contentWindow
  if (!printWin) {
    document.body.removeChild(iframe)
    return
  }

  const runPrint = () => {
    const fit = iframeDoc.getElementById('vm-print-fit')
    if (fit) {
      const pages = fit.querySelectorAll<HTMLElement>('.doc')
      const scaleTargets = pages.length > 0 ? [...pages] : [fit]
      for (const page of scaleTargets) {
        const contentH = page.scrollHeight
        if (contentH > availH - 4) {
          const scale = Math.max(0.38, (availH - 4) / contentH)
          ;(page.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(scale)
        }
      }
    }
    printWin.focus()
    setTimeout(() => {
      try {
        printWin.print()
      } catch {
        /* ignore */
      }
      const cleanup = () => {
        try {
          if (iframe.parentNode) document.body.removeChild(iframe)
        } catch {
          /* ignore */
        }
      }
      printWin.addEventListener('afterprint', cleanup, { once: true })
      setTimeout(cleanup, 3000)
    }, 200)
  }

  if (iframeDoc.readyState === 'complete') {
    requestAnimationFrame(() => requestAnimationFrame(runPrint))
  } else {
    printWin.addEventListener('load', runPrint, { once: true })
  }
}

/** US Letter, English-only record + work checklist on one page (auto-scales to fit). */
export function openVehicleMaintenancePrintDocument(input: VehicleMaintenancePrintInput): void {
  openVehicleMaintenancePrintBatch([input])
}

/** One vehicle per letter page (blank forms or filled records). */
export function openVehicleMaintenancePrintBatch(inputs: VehicleMaintenancePrintInput[]): void {
  if (inputs.length === 0) return
  const html = inputs
    .map(
      (input, index) =>
        `<div class="${index > 0 ? 'page-break' : ''}">${buildVehicleMaintenancePrintHtml(input)}</div>`
    )
    .join('')
  const title = inputs[0].blankTemplate
    ? 'Vehicle Maintenance Forms'
    : inputs[0].isEdit
      ? 'Vehicle Maintenance Record (Edit)'
      : 'Vehicle Maintenance Record'
  openPrintDocument(html, title)
}
