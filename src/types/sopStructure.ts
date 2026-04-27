/** SOP 본문: 한/영 병렬 + 섹션 → 카테고리 → 리치(마크다운 저장) */

/**
 * 카테고리 안의 한 줄 체크 항목(고정 id).
 * 추후 투어별 체크·서명에서 `item_id` + `category_id` + `section_id` 로 재사용 가능.
 */
export type SopChecklistItem = {
  id: string
  title_ko: string
  title_en: string
  sort_order: number
  /** 같은 카테고리 내 상위 항목 id; 없으면 최상위 */
  parent_id: string | null
}

export type SopCategory = {
  id: string
  title_ko: string
  title_en: string
  content_ko: string
  content_en: string
  sort_order: number
  /** 줄 단위 체크(비우면 기존처럼 본문만) */
  checklist_items?: SopChecklistItem[]
}

export type SopSection = {
  id: string
  title_ko: string
  title_en: string
  sort_order: number
  categories: SopCategory[]
}

export type SopDocument = {
  title_ko: string
  title_en: string
  sections: SopSection[]
}

export type SopEditLocale = 'ko' | 'en'

/** 현재 보기/편집 언어에 맞는 문자열 (비어 있으면 다른 쪽 fallback) */
export function sopText(ko: string, en: string, lang: SopEditLocale): string {
  const k = (ko || '').trim()
  const e = (en || '').trim()
  if (lang === 'en') return e || k
  return k || e
}

export function newSopId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** 같은 카테고리 안에서 부모 앞·자식 뒤 순서로 정렬 */
export function orderedChecklistItems(items: SopChecklistItem[] | undefined | null): SopChecklistItem[] {
  if (!items || items.length === 0) return []
  const byId = new Map(items.map((i) => [i.id, i]))
  const result: SopChecklistItem[] = []
  const visited = new Set<string>()
  const roots = items
    .filter((i) => i.parent_id == null || !byId.has(i.parent_id))
    .sort((a, b) => a.sort_order - b.sort_order)
  const walk = (id: string) => {
    if (visited.has(id)) return
    const node = byId.get(id)
    if (!node) return
    visited.add(id)
    result.push(node)
    const children = items
      .filter((i) => i.parent_id === id)
      .sort((a, b) => a.sort_order - b.sort_order)
    for (const ch of children) walk(ch.id)
  }
  for (const r of roots) walk(r.id)
  for (const it of items) {
    if (!visited.has(it.id)) result.push(it)
  }
  return result
}

export function checklistItemDepth(item: SopChecklistItem, byId: Map<string, SopChecklistItem>): number {
  let d = 0
  let p = item.parent_id
  while (p && byId.has(p)) {
    d += 1
    p = byId.get(p)!.parent_id
    if (d > 40) break
  }
  return d
}

function sanitizeChecklistItems(items: SopChecklistItem[] | undefined | null): SopChecklistItem[] | undefined {
  if (!items || items.length === 0) return undefined
  const ids = new Set(items.map((i) => i.id))
  return items.map((it) => ({
    ...it,
    title_ko: it.title_ko ?? '',
    title_en: it.title_en ?? '',
    sort_order: typeof it.sort_order === 'number' ? it.sort_order : 0,
    parent_id: it.parent_id && ids.has(it.parent_id) ? it.parent_id : null,
  }))
}

/**
 * 투어 단위 체크·서명 등에서 참조할 전체 체크 줄(문서 내 고유 id).
 */
export function allSopChecklistItemsForReuse(doc: SopDocument) {
  const rows: Array<{
    section_id: string
    category_id: string
    item_id: string
    parent_id: string | null
    title_ko: string
    title_en: string
    sort_order: number
  }> = []
  const sections = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)
  for (const s of sections) {
    const cats = [...s.categories].sort((a, b) => a.sort_order - b.sort_order)
    for (const c of cats) {
      const items = orderedChecklistItems(c.checklist_items)
      for (const it of items) {
        rows.push({
          section_id: s.id,
          category_id: c.id,
          item_id: it.id,
          parent_id: it.parent_id,
          title_ko: it.title_ko,
          title_en: it.title_en,
          sort_order: it.sort_order,
        })
      }
    }
  }
  return rows
}

export function emptySopDocument(): SopDocument {
  return {
    title_ko: '',
    title_en: '',
    sections: [
      {
        id: newSopId(),
        title_ko: '',
        title_en: '',
        sort_order: 0,
        categories: [
          {
            id: newSopId(),
            title_ko: '',
            title_en: '',
            content_ko: '',
            content_en: '',
            sort_order: 0,
          },
        ],
      },
    ],
  }
}

export function prefillSortOrders(doc: SopDocument): SopDocument {
  return {
    title_ko: doc.title_ko ?? '',
    title_en: doc.title_en ?? '',
    sections: doc.sections.map((s, i) => ({
      ...s,
      title_ko: s.title_ko ?? '',
      title_en: s.title_en ?? '',
      sort_order: i,
      categories: s.categories.map((c, j) => ({
        ...c,
        title_ko: c.title_ko ?? '',
        title_en: c.title_en ?? '',
        content_ko: c.content_ko ?? '',
        content_en: c.content_en ?? '',
        sort_order: j,
        checklist_items: sanitizeChecklistItems(c.checklist_items),
      })),
    })),
  }
}

/** PDF/인쇄용 평문 (선택 언어, 없으면 반대 언어로 채움) */
export function flattenSopDocumentToPlainText(doc: SopDocument, lang: SopEditLocale = 'ko'): string {
  const parts: string[] = []
  const docTitle = sopText(doc.title_ko, doc.title_en, lang)
  if (docTitle) {
    parts.push(docTitle)
    parts.push('')
  }
  const sorted = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order)
  for (const s of sorted) {
    const line = sopText(s.title_ko, s.title_en, lang).trim() || (lang === 'en' ? '(Section)' : '(섹션)')
    parts.push(line)
    parts.push('')
    const cats = [...s.categories].sort((a, b) => a.sort_order - b.sort_order)
    for (const c of cats) {
      const ct = sopText(c.title_ko, c.title_en, lang).trim() || (lang === 'en' ? '(Category)' : '(카테고리)')
      parts.push(`● ${ct}`)
      const items = orderedChecklistItems(c.checklist_items)
      if (items.length > 0) {
        const byId = new Map(items.map((i) => [i.id, i]))
        for (const it of items) {
          const t = sopText(it.title_ko, it.title_en, lang).trim()
          if (!t) continue
          const indent = '  '.repeat(checklistItemDepth(it, byId))
          parts.push(`${indent}- ${t}`)
        }
        parts.push('')
      }
      const body = sopText(c.content_ko, c.content_en, lang).trim()
      if (body) parts.push(body)
      parts.push('')
    }
    parts.push('─'.repeat(48))
    parts.push('')
  }
  return parts.join('\n').trim()
}

function normalizeChecklistRow(raw: unknown): SopChecklistItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const pid = o.parent_id
  return {
    id: typeof o.id === 'string' ? o.id : newSopId(),
    title_ko: typeof o.title_ko === 'string' ? o.title_ko : '',
    title_en: typeof o.title_en === 'string' ? o.title_en : '',
    sort_order: typeof o.sort_order === 'number' ? o.sort_order : 0,
    parent_id: typeof pid === 'string' && pid.length > 0 ? pid : null,
  }
}

function normalizeCategory(o: Record<string, unknown>): SopCategory {
  const legacyTitle = typeof o.title === 'string' ? o.title : ''
  const legacyContent = typeof o.content === 'string' ? o.content : ''
  let checklist_items: SopChecklistItem[] | undefined
  if (Array.isArray(o.checklist_items)) {
    const rows = o.checklist_items.map(normalizeChecklistRow).filter((x): x is SopChecklistItem => x !== null)
    checklist_items = rows.length > 0 ? sanitizeChecklistItems(rows) : undefined
  }
  return {
    id: typeof o.id === 'string' ? o.id : newSopId(),
    title_ko: typeof o.title_ko === 'string' ? o.title_ko : legacyTitle,
    title_en: typeof o.title_en === 'string' ? o.title_en : '',
    content_ko: typeof o.content_ko === 'string' ? o.content_ko : legacyContent,
    content_en: typeof o.content_en === 'string' ? o.content_en : '',
    sort_order: typeof o.sort_order === 'number' ? o.sort_order : 0,
    checklist_items,
  }
}

function normalizeSection(o: Record<string, unknown>): SopSection | null {
  if (!Array.isArray(o.categories)) return null
  const cats = (o.categories as unknown[]).map((c) =>
    c && typeof c === 'object' ? normalizeCategory(c as Record<string, unknown>) : null
  )
  let categories = cats.filter((c): c is SopCategory => c !== null)
  if (categories.length === 0) {
    categories = [
      {
        id: newSopId(),
        title_ko: '',
        title_en: '',
        content_ko: '',
        content_en: '',
        sort_order: 0,
      },
    ]
  }
  const legacyTitle = typeof o.title === 'string' ? o.title : ''
  return {
    id: typeof o.id === 'string' ? o.id : newSopId(),
    title_ko: typeof o.title_ko === 'string' ? o.title_ko : legacyTitle,
    title_en: typeof o.title_en === 'string' ? o.title_en : '',
    sort_order: typeof o.sort_order === 'number' ? o.sort_order : 0,
    categories,
  }
}

/** DB·API에서 온 JSON을 안전하게 문서 형태로 */
export function parseSopDocumentJson(raw: unknown): SopDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.sections) || o.sections.length === 0) return null
  const sections: SopSection[] = []
  for (const s of o.sections) {
    if (!s || typeof s !== 'object') continue
    const sec = normalizeSection(s as Record<string, unknown>)
    if (sec) sections.push(sec)
  }
  if (sections.length === 0) return null
  return prefillSortOrders({
    title_ko: typeof o.title_ko === 'string' ? o.title_ko : '',
    title_en: typeof o.title_en === 'string' ? o.title_en : '',
    sections,
  })
}

/**
 * 양식 PDF처럼 `섹션 N: …` / `● 카테고리` 로 구분된 텍스트를 구조로 변환.
 * 가져온 텍스트는 한국어 필드에만 채웁니다.
 */
export function parseSopPlainTextToDocument(raw: string): SopDocument {
  const cleaned = raw
    .replace(/\r\n/g, '\n')
    .replace(/^--\s*\d+\s+of\s+\d+\s*--\s*$/gim, '')
    .replace(/^\uFEFF/, '')
    .trim()

  if (!cleaned) return emptySopDocument()

  const hasSectionMarkers = /(?:^|\n)(?:섹션\s*\d+\s*:|Section\s+\d+\s*:)/im.test(cleaned)

  if (!hasSectionMarkers) {
    return prefillSortOrders({
      title_ko: '',
      title_en: '',
      sections: [
        {
          id: newSopId(),
          title_ko: '문서',
          title_en: '',
          sort_order: 0,
          categories: [
            {
              id: newSopId(),
              title_ko: '내용',
              title_en: '',
              content_ko: cleaned,
              content_en: '',
              sort_order: 0,
            },
          ],
        },
      ],
    })
  }

  const markerMatch = cleaned.match(/(?:섹션\s*\d+\s*:|Section\s+\d+\s*:)/im)
  const cut = markerMatch?.index ?? 0
  const preamble = cut > 0 ? cleaned.slice(0, cut).trim() : ''
  const fromFirstSection = cut > 0 ? cleaned.slice(cut).trim() : cleaned

  const sectionChunks = fromFirstSection
    .split(/\n(?=(?:섹션\s*\d+\s*:|Section\s+\d+\s*:))/im)
    .map((s) => s.trim())
    .filter(Boolean)

  const sections: SopSection[] = []
  let so = 0
  if (preamble) {
    sections.push({
      id: newSopId(),
      title_ko: '서두 / 표지',
      title_en: '',
      sort_order: so++,
      categories: [
        {
          id: newSopId(),
          title_ko: '문서 상단',
          title_en: '',
          content_ko: preamble,
          content_en: '',
          sort_order: 0,
        },
      ],
    })
  }
  for (const chunk of sectionChunks) {
    const lines = chunk.split('\n')
    const sectionTitle = (lines[0] || '').trim()
    const rest = lines.slice(1).join('\n').trim()

    const categories: SopCategory[] = []
    let co = 0
    if (rest) {
      const catBlocks = rest.split(/\n(?=●\s*)/).map((b) => b.trim())
      for (const block of catBlocks) {
        if (!block) continue
        let b = block
        if (b.startsWith('●')) b = b.slice(1).trim()
        const nl = b.indexOf('\n')
        const title = (nl === -1 ? b : b.slice(0, nl)).trim()
        const content = (nl === -1 ? '' : b.slice(nl + 1)).trim()
        if (!title && !content) continue
        categories.push({
          id: newSopId(),
          title_ko: title || '—',
          title_en: '',
          content_ko: content,
          content_en: '',
          sort_order: co++,
        })
      }
    }

    if (categories.length === 0) {
      categories.push({
        id: newSopId(),
        title_ko: '—',
        title_en: '',
        content_ko: '',
        content_en: '',
        sort_order: 0,
      })
    }

    sections.push({
      id: newSopId(),
      title_ko: sectionTitle || `섹션 ${so + 1}`,
      title_en: '',
      sort_order: so++,
      categories,
    })
  }

  return prefillSortOrders({
    title_ko: '',
    title_en: '',
    sections,
  })
}

export function sopDocumentToJson(doc: SopDocument): Record<string, unknown> {
  return JSON.parse(JSON.stringify(doc)) as Record<string, unknown>
}

/** 게시 가능한 최소 내용 */
export function isPublishableSopDocument(doc: SopDocument): boolean {
  if (doc.title_ko?.trim() || doc.title_en?.trim()) return true
  for (const s of doc.sections) {
    if (s.title_ko?.trim() || s.title_en?.trim()) return true
    for (const c of s.categories) {
      if (c.title_ko?.trim() || c.title_en?.trim() || c.content_ko?.trim() || c.content_en?.trim()) return true
      for (const it of c.checklist_items || []) {
        if (it.title_ko?.trim() || it.title_en?.trim()) return true
      }
    }
  }
  return false
}

/** DB 제목 컬럼용 (한글 우선) */
export function primaryDocumentTitle(doc: SopDocument): string {
  return doc.title_ko?.trim() || doc.title_en?.trim() || 'SOP'
}
