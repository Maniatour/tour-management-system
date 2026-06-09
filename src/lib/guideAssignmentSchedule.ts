/** 스케줄뷰 가이드·어시스턴트 배정 변경 추적 및 이메일 본문 */

export type GuideAssignmentChangeType = 'added' | 'removed' | 'changed'
export type GuideAssignmentRole = 'guide' | 'assistant'
export type GuideAssignmentEmailKind = 'assigned' | 'unassigned'

export interface TourAssignmentSnapshot {
  tour_guide_id: string | null
  assistant_id: string | null
}

export interface GuideAssignmentChangeItem {
  id: string
  tourId: string
  tourDate: string
  productId: string
  productName: string
  /** 영문 수신자 이메일용 상품명 (없으면 productName 사용) */
  productNameEn?: string
  role: GuideAssignmentRole
  changeType: GuideAssignmentChangeType
  previousEmail: string | null
  newEmail: string | null
  previousName: string
  newName: string
  /** @deprecated 수신 그룹은 buildGuideAssignmentEmailRecipientGroups 사용 */
  notifyEmail: string | null
}

export interface GuideAssignmentEmailRecipientGroup {
  email: string
  kind: GuideAssignmentEmailKind
  items: GuideAssignmentChangeItem[]
}

export function normalizeStaffEmail(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  return v.length > 0 ? v : null
}

export function buildToursAssignmentBaseline(
  tours: Array<{ id: string; tour_guide_id?: string | null; assistant_id?: string | null }>,
): Record<string, TourAssignmentSnapshot> {
  const out: Record<string, TourAssignmentSnapshot> = {}
  for (const t of tours) {
    out[t.id] = {
      tour_guide_id: normalizeStaffEmail(t.tour_guide_id),
      assistant_id: normalizeStaffEmail(t.assistant_id),
    }
  }
  return out
}

function classifyStaffChange(
  before: string | null,
  after: string | null,
): GuideAssignmentChangeType | null {
  if (before === after) return null
  if (!before && after) return 'added'
  if (before && !after) return 'removed'
  return 'changed'
}

export function computeGuideAssignmentChanges(params: {
  baseline: Record<string, TourAssignmentSnapshot>
  tours: Array<{
    id: string
    tour_date?: string | null
    product_id?: string | null
    tour_guide_id?: string | null
    assistant_id?: string | null
  }>
  pendingChanges: Record<string, { tour_guide_id?: string | null; assistant_id?: string | null }>
  getProductName: (productId: string | null | undefined) => string
  getProductNameEn?: (productId: string | null | undefined) => string
  getMemberName: (email: string | null) => string
}): GuideAssignmentChangeItem[] {
  const { baseline, tours, pendingChanges, getProductName, getProductNameEn, getMemberName } = params
  const items: GuideAssignmentChangeItem[] = []

  for (const tour of tours) {
    const pending = pendingChanges[tour.id]
    if (!pending || (!('tour_guide_id' in pending) && !('assistant_id' in pending))) continue

    const base = baseline[tour.id] ?? {
      tour_guide_id: normalizeStaffEmail(tour.tour_guide_id),
      assistant_id: normalizeStaffEmail(tour.assistant_id),
    }

    const afterGuide = normalizeStaffEmail(tour.tour_guide_id)
    const afterAsst = normalizeStaffEmail(tour.assistant_id)

    const roles: Array<{ role: GuideAssignmentRole; before: string | null; after: string | null }> = [
      { role: 'guide', before: base.tour_guide_id, after: afterGuide },
      { role: 'assistant', before: base.assistant_id, after: afterAsst },
    ]

    for (const { role, before, after } of roles) {
      const changeType = classifyStaffChange(before, after)
      if (!changeType) continue

      items.push({
        id: `${tour.id}-${role}`,
        tourId: tour.id,
        tourDate: String(tour.tour_date ?? '').slice(0, 10),
        productId: String(tour.product_id ?? ''),
        productName: getProductName(tour.product_id),
        productNameEn: getProductNameEn?.(tour.product_id) ?? getProductName(tour.product_id),
        role,
        changeType,
        previousEmail: before,
        newEmail: after,
        previousName: before ? getMemberName(before) : '-',
        newName: after ? getMemberName(after) : '-',
        notifyEmail: changeType === 'removed' ? null : after,
      })
    }
  }

  return items.sort((a, b) => {
    const d = a.tourDate.localeCompare(b.tourDate)
    if (d !== 0) return d
    return a.productName.localeCompare(b.productName)
  })
}

/** 수신자별·안내 유형별(신규 배정 / 배정 해제·이전) 이메일 그룹 */
export function buildGuideAssignmentEmailRecipientGroups(
  changes: GuideAssignmentChangeItem[],
): GuideAssignmentEmailRecipientGroup[] {
  const bucket = new Map<string, GuideAssignmentEmailRecipientGroup>()

  const ensure = (email: string, kind: GuideAssignmentEmailKind) => {
    const key = `${email}\0${kind}`
    let g = bucket.get(key)
    if (!g) {
      g = { email, kind, items: [] }
      bucket.set(key, g)
    }
    return g
  }

  for (const c of changes) {
    if (c.changeType === 'added' || c.changeType === 'changed') {
      if (c.newEmail) ensure(c.newEmail, 'assigned').items.push(c)
    }
    if (c.changeType === 'removed' || c.changeType === 'changed') {
      if (c.previousEmail) ensure(c.previousEmail, 'unassigned').items.push(c)
    }
  }

  return Array.from(bucket.values()).sort((a, b) => {
    const e = a.email.localeCompare(b.email)
    if (e !== 0) return e
    return a.kind === 'assigned' ? -1 : 1
  })
}

export function guideAssignmentEmailKindLabel(kind: GuideAssignmentEmailKind): string {
  return kind === 'assigned' ? '배정 안내' : '배정 해제 안내'
}

export function guideAssignmentChangeTypeLabel(type: GuideAssignmentChangeType): string {
  switch (type) {
    case 'added':
      return '신규 배정'
    case 'removed':
      return '배정 해제'
    case 'changed':
      return '배정 변경'
    default:
      return type
  }
}

export function guideAssignmentRoleLabel(role: GuideAssignmentRole): string {
  return role === 'guide' ? '가이드' : '어시스턴트'
}

function formatScheduleSlot(
  name: string,
  role: GuideAssignmentRole,
  useEn: boolean,
  empty: boolean,
): string {
  if (empty || !name || name === '-') {
    return useEn ? '—' : '—'
  }
  const roleText = useEn ? (role === 'guide' ? 'Guide' : 'Assistant') : guideAssignmentRoleLabel(role)
  return `${name} (${roleText})`
}

export function buildGuideAssignmentEmailContent(params: {
  recipientName: string
  recipientEmail: string
  kind: GuideAssignmentEmailKind
  items: GuideAssignmentChangeItem[]
  locale?: 'ko' | 'en'
}): { subject: string; html: string } {
  const { recipientName, recipientEmail, kind, items } = params
  const useEn =
    params.locale === 'en' ||
    (params.locale !== 'ko' && !/[가-힣]/.test(recipientName))

  const roleLabel = (role: GuideAssignmentRole) =>
    useEn ? (role === 'guide' ? 'Guide' : 'Assistant') : guideAssignmentRoleLabel(role)

  const productLabel = (item: GuideAssignmentChangeItem) =>
    useEn ? item.productNameEn || item.productName : item.productName

  const rows = items
    .map((item) => {
      const [, m, d] = item.tourDate.split('-')
      const dateStr = m && d ? (useEn ? `${m}/${d}` : `${m}월 ${d}일`) : item.tourDate
      const beforeSlot = formatScheduleSlot(
        item.previousName,
        item.role,
        useEn,
        item.changeType === 'added',
      )
      const afterSlot = formatScheduleSlot(item.newName, item.role, useEn, item.changeType === 'removed')

      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${dateStr}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(productLabel(item))}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${roleLabel(item.role)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#fef2f2;">${escapeHtml(beforeSlot)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#f0fdf4;">${escapeHtml(afterSlot)}</td>
      </tr>`
    })
    .join('')

  const isUnassigned = kind === 'unassigned'
  const subject = useEn
    ? isUnassigned
      ? `[Maniatour] Tour removed from your schedule (${items.length})`
      : `[Maniatour] Tour assignment update (${items.length})`
    : isUnassigned
      ? `[마니아투어] 투어 배정 해제 안내 (${items.length}건)`
      : `[마니아투어] 투어 배정 안내 (${items.length}건)`

  const intro = useEn
    ? isUnassigned
      ? 'The following tour(s) are no longer on your schedule (unassigned or reassigned to another guide). Before and after assignments are shown side by side.'
      : 'The following tour(s) have been added or updated on your schedule. Before and after assignments are shown side by side.'
    : isUnassigned
      ? '아래 투어는 귀하의 스케줄에서 제외되었습니다(배정 해제 또는 다른 가이드로 변경). 이전·변경 후 배정을 함께 확인해 주세요.'
      : '아래 투어가 귀하에게 배정되었습니다. 이전·변경 후 스케줄을 함께 확인해 주세요.'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#111827;max-width:720px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;font-size:20px;">${useEn ? (isUnassigned ? 'Schedule removal notice' : 'Tour assignment notice') : isUnassigned ? '투어 배정 해제 안내' : '투어 배정 안내'}</h2>
  <p style="margin:0 0 16px;">${useEn ? `Hello ${escapeHtml(recipientName)},` : `${escapeHtml(recipientName)}님, 안녕하세요.`}</p>
  <p style="margin:0 0 20px;color:#374151;">${intro}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:8px 12px;text-align:left;">${useEn ? 'Date' : '날짜'}</th>
        <th style="padding:8px 12px;text-align:left;">${useEn ? 'Product' : '상품'}</th>
        <th style="padding:8px 12px;text-align:left;">${useEn ? 'Role' : '역할'}</th>
        <th style="padding:8px 12px;text-align:left;background:#fee2e2;">${useEn ? 'Before' : '이전 스케줄'}</th>
        <th style="padding:8px 12px;text-align:left;background:#dcfce7;">${useEn ? 'After' : '변경 후 스케줄'}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(recipientEmail)}</p>
</body>
</html>`

  return { subject, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
