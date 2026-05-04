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

/** 리치/마크다운 조각 제거 후 문장 분리용으로만 사용 */
function stripMarkupForChecklistSplit(raw: string): string {
  let t = raw || ''
  t = t.replace(/<[^>]+>/g, '\n')
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1')
  t = t.replace(/\*([^*]+)\*/g, '$1')
  t = t.replace(/^#+\s*/gm, '')
  return t
}

/** 한 줄 안에서 `。` 또는 뒤에 공백·끝이 오는 `.` 기준으로 문장 분리 (예: `합니다.(SPRINTER` 는 `.` 뒤가 `(` 이라 분리 안 함) */
function splitSingleLineBySentencePeriods(line: string): string[] {
  const s = line.trim()
  if (!s) return []
  const out: string[] = []
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    buf += ch
    if (ch === '。') {
      const piece = buf.trim()
      if (piece) out.push(piece)
      buf = ''
    } else if (ch === '.') {
      const next = s[i + 1]
      if (next === undefined || /\s/.test(next)) {
        const piece = buf.trim()
        if (piece) out.push(piece)
        buf = ''
        while (i + 1 < s.length && /\s/.test(s[i + 1])) i++
      }
    }
  }
  const tail = buf.trim()
  if (tail) out.push(tail)
  return out.filter((x) => x.length > 0)
}

/**
 * 카테고리 「추가 설명」에 붙여 넣은 여러 문장을 체크 줄 제목으로 쓸 문자열 배열로 변환합니다.
 * - 줄바꿈이 있으면 각 줄을 먼저 나눈 뒤, 줄마다 `。` / 뒤에 공백인 `.` 기준으로 한 번 더 나눕니다.
 * - 한 덩어리만 있으면 위 규칙만 적용합니다.
 */
export function splitRichContentToChecklistLines(raw: string): string[] {
  const normalized = stripMarkupForChecklistSplit(raw).trim()
  if (!normalized) return []
  const rawLines = normalized
    .split(/\n+/)
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
  if (rawLines.length > 1) {
    return rawLines.flatMap((line) => splitSingleLineBySentencePeriods(line))
  }
  return splitSingleLineBySentencePeriods(rawLines[0] || normalized.replace(/\n/g, ' ').trim())
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

export function parseSopSectionJson(raw: unknown): SopSection | null {
  if (!raw || typeof raw !== 'object') return null
  return normalizeSection(raw as Record<string, unknown>)
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

export type SopPlainTextFill = 'ko' | 'en'

/** 줄 앞 공백·탭(들여쓰기) + 선택적 글머리표 제거 후 본문 텍스트 */
function lineLeadingIndentAndText(rawLine: string): { units: number; text: string } | null {
  const m = /^([\t ]*)(.*)$/.exec(rawLine.replace(/\r$/, ''))
  if (!m) return null
  let units = 0
  for (const ch of m[1]) {
    if (ch === '\t') units += 4
    else if (ch === ' ') units += 1
  }
  const stripped = m[2].trim().replace(/^[-*・●•]\s+/, '').trim()
  if (!stripped) return null
  return { units, text: stripped }
}

function indentStepFromRows(rows: { units: number; text: string }[]): number {
  const set = [...new Set(rows.map((r) => r.units))].sort((a, b) => a - b)
  if (set.length < 2) return 4
  const gaps: number[] = []
  for (let i = 1; i < set.length; i++) {
    const g = set[i] - set[i - 1]
    if (g > 0) gaps.push(g)
  }
  if (gaps.length === 0) return 4
  return Math.max(1, Math.min(...gaps))
}

/** 붙여넣기·plain 파싱용: 본문을 「추가 설명 → 체크」와 동일 규칙으로 줄 단위 체크 항목으로 바꿉니다. */
function plainTextBodyToChecklistItems(body: string, fill: SopPlainTextFill): SopChecklistItem[] | undefined {
  const lines = splitRichContentToChecklistLines(body.trim())
  if (lines.length === 0) return undefined
  return lines.map((line, idx) => ({
    id: newSopId(),
    title_ko: fill === 'ko' ? line : '',
    title_en: fill === 'en' ? line : '',
    sort_order: idx,
    parent_id: null,
  }))
}

/** 한 카테고리 본문 블록: 들여쓰기가 있으면 parent_id 트리, 없으면 줄·문장 분리 체크리스트 */
function plainTextRowsToHierarchicalChecklist(
  rows: { units: number; text: string }[],
  fill: SopPlainTextFill
): SopChecklistItem[] | undefined {
  if (rows.length === 0) return undefined
  const minU = Math.min(...rows.map((r) => r.units))
  const maxU = Math.max(...rows.map((r) => r.units))
  const step = indentStepFromRows(rows)
  if (maxU === minU) {
    if (rows.length === 1) return plainTextBodyToChecklistItems(rows[0].text, fill)
    return rows.map((r, idx) => ({
      id: newSopId(),
      title_ko: fill === 'ko' ? r.text : '',
      title_en: fill === 'en' ? r.text : '',
      sort_order: idx,
      parent_id: null,
    }))
  }
  const lastIdAtDepth = new Map<number, string>()
  const items: SopChecklistItem[] = []
  let sortOrder = 0
  for (const row of rows) {
    const d = Math.floor((row.units - minU) / step)
    const parent_id = d === 0 ? null : lastIdAtDepth.get(d - 1) ?? null
    const id = newSopId()
    items.push({
      id,
      title_ko: fill === 'ko' ? row.text : '',
      title_en: fill === 'en' ? row.text : '',
      sort_order: sortOrder++,
      parent_id,
    })
    lastIdAtDepth.set(d, id)
    for (const k of [...lastIdAtDepth.keys()]) {
      if (k > d) lastIdAtDepth.delete(k)
    }
  }
  return items.length > 0 ? items : undefined
}

function plainTextBlockToChecklistItems(body: string, fill: SopPlainTextFill): SopChecklistItem[] | undefined {
  const rows: { units: number; text: string }[] = []
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const p = lineLeadingIndentAndText(line)
    if (p) rows.push(p)
  }
  if (rows.length === 0) return undefined
  return plainTextRowsToHierarchicalChecklist(rows, fill)
}

function pushCategoryForFill(
  categories: SopCategory[],
  fill: SopPlainTextFill,
  title: string,
  content: string,
  sortOrder: number
): void {
  const t = (title || '').trim() || '—'
  const trimmed = (content || '').trim()
  const checklistItems = plainTextBlockToChecklistItems(trimmed, fill)
  categories.push({
    id: newSopId(),
    title_ko: fill === 'ko' ? t : '',
    title_en: fill === 'en' ? t : '',
    content_ko: fill === 'ko' ? (checklistItems ? '' : trimmed) : '',
    content_en: fill === 'en' ? (checklistItems ? '' : trimmed) : '',
    sort_order: sortOrder,
    ...(checklistItems ? { checklist_items: checklistItems } : {}),
  })
}

/**
 * `섹션 N:` 마커가 없을 때
 * - **같은 열(들여쓰기 없음)**: 1줄=섹션 제목만 / 2줄+=첫 줄=섹션·고정 카테고리「내용」·나머지 각 줄=체크 줄 (줄마다 섹션 금지).
 * - **들여쓰기 있음**: 첫 `lv=0`만 새 섹션, 이후 같은 열(`lv<=0`)은 같은 섹션 안 체크 줄로만 처리.
 * - `lv=1` = 카테고리 제목, `lv>=2` = 해당 카테고리 체크(들여 계층).
 */
function parseIndentedOutlinePlainText(cleaned: string, fill: SopPlainTextFill): SopDocument {
  const rows: { units: number; text: string }[] = []
  for (const line of cleaned.replace(/\r\n/g, '\n').split('\n')) {
    const p = lineLeadingIndentAndText(line)
    if (p) rows.push(p)
  }
  if (rows.length === 0) return emptySopDocument()

  const minU = Math.min(...rows.map((r) => r.units))
  const maxU = Math.max(...rows.map((r) => r.units))
  const step = indentStepFromRows(rows)

  /** 같은 units → 체크 줄로만 쓰기 위한 합성 들여쓰기(카테고리 본문 블록) */
  const flatChecklistUnits = minU + Math.max(step, 4) * 4

  if (maxU === minU) {
    const docTitle = fill === 'ko' ? '문서' : 'Document'
    const catDefault = fill === 'ko' ? '내용' : 'Body'
    if (rows.length === 1) {
      const checklist_items = [
        {
          id: newSopId(),
          title_ko: fill === 'ko' ? rows[0].text : '',
          title_en: fill === 'en' ? rows[0].text : '',
          sort_order: 0,
          parent_id: null as string | null,
        },
      ]
      return {
        title_ko: '',
        title_en: '',
        sections: [
          {
            id: newSopId(),
            title_ko: fill === 'ko' ? docTitle : '',
            title_en: fill === 'en' ? docTitle : '',
            sort_order: 0,
            categories: [
              {
                id: newSopId(),
                title_ko: fill === 'ko' ? catDefault : '',
                title_en: fill === 'en' ? catDefault : '',
                content_ko: '',
                content_en: '',
                sort_order: 0,
                checklist_items,
              },
            ],
          },
        ],
      }
    }
    const secTitle = rows[0].text
    const checklist_items = rows.slice(1).map((r, idx) => ({
      id: newSopId(),
      title_ko: fill === 'ko' ? r.text : '',
      title_en: fill === 'en' ? r.text : '',
      sort_order: idx,
      parent_id: null as string | null,
    }))
    return {
      title_ko: '',
      title_en: '',
      sections: [
        {
          id: newSopId(),
          title_ko: fill === 'ko' ? secTitle : '',
          title_en: fill === 'en' ? secTitle : '',
          sort_order: 0,
          categories: [
            {
              id: newSopId(),
              title_ko: fill === 'ko' ? catDefault : '',
              title_en: fill === 'en' ? catDefault : '',
              content_ko: '',
              content_en: '',
              sort_order: 0,
              checklist_items,
            },
          ],
        },
      ],
    }
  }

  const sectionsOut: SopSection[] = []
  let secOrder = 0
  let curSec: SopSection | null = null
  let curCatTitle: string | null = null
  let pending: { units: number; text: string }[] = []
  let catOrder = 0

  const flushCategory = () => {
    if (!curSec || !curCatTitle) {
      pending = []
      curCatTitle = null
      return
    }
    const items = pending.length > 0 ? plainTextRowsToHierarchicalChecklist(pending, fill) : undefined
    curSec.categories.push({
      id: newSopId(),
      title_ko: fill === 'ko' ? curCatTitle : '',
      title_en: fill === 'en' ? curCatTitle : '',
      content_ko: '',
      content_en: '',
      sort_order: catOrder++,
      ...(items && items.length > 0 ? { checklist_items: items } : {}),
    })
    pending = []
    curCatTitle = null
  }

  const flushSectionPush = () => {
    flushCategory()
    if (curSec && (curSec.title_ko?.trim() || curSec.title_en?.trim() || curSec.categories.length > 0)) {
      if (curSec.categories.length === 0) {
        pushCategoryForFill(curSec.categories, fill, '—', '', 0)
      }
      curSec.sort_order = secOrder++
      sectionsOut.push(curSec)
    }
    curSec = null
    catOrder = 0
  }

  for (const row of rows) {
    const lv = Math.floor((row.units - minU) / step)
    if (lv <= 0) {
      if (!curSec) {
        curSec = {
          id: newSopId(),
          title_ko: fill === 'ko' ? row.text : '',
          title_en: fill === 'en' ? row.text : '',
          sort_order: 0,
          categories: [],
        }
      } else {
        if (!curCatTitle) {
          curCatTitle = fill === 'ko' ? '내용' : 'Body'
        }
        pending.push({ units: flatChecklistUnits, text: row.text })
      }
      continue
    }
    if (lv === 1) {
      if (!curSec) {
        curSec = {
          id: newSopId(),
          title_ko: fill === 'ko' ? '문서' : '',
          title_en: fill === 'en' ? 'Document' : '',
          sort_order: 0,
          categories: [],
        }
      }
      flushCategory()
      curCatTitle = row.text
      continue
    }
    if (!curSec) {
      curSec = {
        id: newSopId(),
        title_ko: fill === 'ko' ? '문서' : '',
        title_en: fill === 'en' ? 'Document' : '',
        sort_order: 0,
        categories: [],
      }
    }
    if (!curCatTitle) {
      curCatTitle = fill === 'ko' ? '내용' : 'Body'
    }
    pending.push(row)
  }
  flushSectionPush()

  if (sectionsOut.length === 0) return emptySopDocument()
  return { title_ko: '', title_en: '', sections: sectionsOut }
}

/**
 * `섹션 N:` / `Section N:` 및 `● 카테고리` 규칙으로 구조 변환.
 * `fill`: 한글 열만 채우거나(`ko`) 영문 열만 채웁니다(`en`). 두 열을 합치려면 `mergeParallelKoEnPasteDocs` 사용.
 */
export function parseSopPlainTextToDocument(raw: string, fill: SopPlainTextFill = 'ko'): SopDocument {
  const cleaned = raw
    .replace(/\r\n/g, '\n')
    .replace(/^--\s*\d+\s+of\s+\d+\s*--\s*$/gim, '')
    .replace(/^\uFEFF/, '')
    .trim()

  if (!cleaned) return emptySopDocument()

  const hasSectionMarkers = /(?:^|\n)(?:섹션\s*\d+\s*:|Section\s+\d+\s*:)/im.test(cleaned)

  if (!hasSectionMarkers) {
    return prefillSortOrders(parseIndentedOutlinePlainText(cleaned, fill))
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
    const preCats: SopCategory[] = []
    pushCategoryForFill(
      preCats,
      fill,
      fill === 'ko' ? '문서 상단' : 'Top of document',
      preamble,
      0
    )
    sections.push({
      id: newSopId(),
      title_ko: fill === 'ko' ? '서두 / 표지' : '',
      title_en: fill === 'en' ? 'Preamble / cover' : '',
      sort_order: so++,
      categories: preCats,
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
        pushCategoryForFill(categories, fill, title, content, co++)
      }
    }

    if (categories.length === 0) {
      categories.push({
        id: newSopId(),
        title_ko: fill === 'ko' ? '—' : '',
        title_en: fill === 'en' ? '—' : '',
        content_ko: '',
        content_en: '',
        sort_order: 0,
      })
    }

    const secTitleKo = fill === 'ko' ? sectionTitle || `섹션 ${so + 1}` : ''
    const secTitleEn = fill === 'en' ? sectionTitle || `Section ${so + 1}` : ''

    sections.push({
      id: newSopId(),
      title_ko: secTitleKo,
      title_en: secTitleEn,
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

function docHasStructuralBody(doc: SopDocument): boolean {
  if (doc.title_ko?.trim() || doc.title_en?.trim()) return true
  for (const s of doc.sections) {
    if (s.title_ko?.trim() || s.title_en?.trim()) return true
    for (const c of s.categories) {
      if (c.title_ko?.trim() || c.title_en?.trim() || c.content_ko?.trim() || c.content_en?.trim()) return true
      const items = orderedChecklistItems(c.checklist_items)
      for (const it of items) {
        if (it.title_ko?.trim() || it.title_en?.trim()) return true
      }
    }
  }
  return false
}

function mergeChecklistsParallel(
  kItems: SopChecklistItem[] | undefined,
  eItems: SopChecklistItem[] | undefined
): SopChecklistItem[] | undefined {
  const ka = orderedChecklistItems(kItems || [])
  const ea = orderedChecklistItems(eItems || [])
  if (ka.length === 0 && ea.length === 0) return undefined
  if (ea.length === 0) return ka.length > 0 ? sanitizeChecklistItems(ka) : undefined
  if (ka.length === 0) return ea.length > 0 ? sanitizeChecklistItems(ea) : undefined
  const m = Math.max(ka.length, ea.length)
  const out: SopChecklistItem[] = []
  for (let i = 0; i < m; i++) {
    const k = ka[i]
    const e = ea[i]
    if (!k && e) {
      out.push({ ...e })
      continue
    }
    if (!e) {
      out.push({ ...k! })
      continue
    }
    out.push({
      ...k,
      title_en: e.title_en?.trim() || e.title_ko?.trim() || k.title_en,
    })
  }
  return sanitizeChecklistItems(out)
}

function mergeCategoriesParallel(kc: SopCategory[], ec: SopCategory[]): SopCategory[] {
  const a = [...kc].sort((x, y) => x.sort_order - y.sort_order)
  const b = [...ec].sort((x, y) => x.sort_order - y.sort_order)
  const out: SopCategory[] = []
  const m = Math.max(a.length, b.length)
  for (let i = 0; i < m; i++) {
    const k = a[i]
    const e = b[i]
    if (!k && e) {
      out.push(e)
      continue
    }
    if (!e) {
      out.push(k!)
      continue
    }
    const mergedChk = mergeChecklistsParallel(k.checklist_items, e.checklist_items)
    out.push({
      ...k,
      title_en: e.title_en?.trim() || e.title_ko?.trim() || k.title_en,
      content_en: e.content_en?.trim() || e.content_ko?.trim() || k.content_en,
      ...(mergedChk ? { checklist_items: mergedChk } : {}),
    })
  }
  return out
}

/** 한글·영문 각각 붙여넣기 변환 결과를 동일 섹션/카테고리 순서로 합칩니다. */
export function mergeParallelKoEnPasteDocs(koDoc: SopDocument, enDoc: SopDocument): SopDocument {
  const koHas = docHasStructuralBody(koDoc)
  const enHas = docHasStructuralBody(enDoc)
  if (!enHas) return prefillSortOrders(koDoc)
  if (!koHas) return prefillSortOrders(enDoc)

  const koSecs = [...koDoc.sections].sort((a, b) => a.sort_order - b.sort_order)
  const enSecs = [...enDoc.sections].sort((a, b) => a.sort_order - b.sort_order)
  const outSecs: SopSection[] = []
  const n = Math.max(koSecs.length, enSecs.length)
  for (let i = 0; i < n; i++) {
    const k = koSecs[i]
    const e = enSecs[i]
    if (!k && e) {
      outSecs.push(e)
      continue
    }
    if (!e) {
      outSecs.push(k!)
      continue
    }
    outSecs.push({
      ...k,
      title_en: e.title_en?.trim() || e.title_ko?.trim() || k.title_en,
      categories: mergeCategoriesParallel(k.categories, e.categories),
    })
  }

  return prefillSortOrders({
    title_ko: koDoc.title_ko || '',
    title_en: enDoc.title_en?.trim() || enDoc.title_ko?.trim() || koDoc.title_en || '',
    sections: outSecs,
  })
}

export function sopDocumentToJson(doc: SopDocument): Record<string, unknown> {
  return JSON.parse(JSON.stringify(doc)) as Record<string, unknown>
}

function mergeChecklistItemsForLocale(
  editorItems: SopChecklistItem[] | undefined,
  baselineItems: SopChecklistItem[] | undefined,
  keepFromEditor: SopEditLocale
): SopChecklistItem[] | undefined {
  if (editorItems == null || editorItems.length === 0) return editorItems
  const ei = orderedChecklistItems(editorItems)
  const biMap = new Map(orderedChecklistItems(baselineItems).map((x) => [x.id, x]))
  return ei.map((item) => {
    const b = biMap.get(item.id)
    return {
      ...item,
      title_ko: keepFromEditor === 'ko' ? item.title_ko : (b?.title_ko ?? item.title_ko),
      title_en: keepFromEditor === 'en' ? item.title_en : (b?.title_en ?? item.title_en),
    }
  })
}

function mergeCategoryForLocale(ec: SopCategory, bc: SopCategory | undefined, loc: SopEditLocale): SopCategory {
  return {
    ...ec,
    title_ko: loc === 'ko' ? ec.title_ko : (bc?.title_ko ?? ec.title_ko),
    title_en: loc === 'en' ? ec.title_en : (bc?.title_en ?? ec.title_en),
    content_ko: loc === 'ko' ? ec.content_ko : (bc?.content_ko ?? ec.content_ko),
    content_en: loc === 'en' ? ec.content_en : (bc?.content_en ?? ec.content_en),
    checklist_items: mergeChecklistItemsForLocale(ec.checklist_items, bc?.checklist_items, loc),
  }
}

function mergeSectionForLocale(es: SopSection, bs: SopSection | undefined, loc: SopEditLocale): SopSection {
  const baselineCats = bs ? new Map(bs.categories.map((c) => [c.id, c])) : new Map<string, SopCategory>()
  const mergedCats = [...es.categories]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ec) => mergeCategoryForLocale(ec, baselineCats.get(ec.id), loc))
  return {
    ...es,
    title_ko: loc === 'ko' ? es.title_ko : (bs?.title_ko ?? es.title_ko),
    title_en: loc === 'en' ? es.title_en : (bs?.title_en ?? es.title_en),
    categories: mergedCats,
  }
}

/**
 * 편집기 내용(editor) 중 `keepFromEditor` 언어 필드만 반영하고,
 * 반대 언어 필드는 baseline(서버에 마지막으로 맞춰 둔 스냅샷)에서 가져옵니다.
 * 한국어만 저장 / 영어만 저장 시 같은 게시 버전 행을 UPDATE 할 때 사용합니다.
 */
export function mergeStructuredDocKeepOtherLocaleFromBaseline(
  editor: SopDocument,
  baseline: SopDocument,
  keepFromEditor: SopEditLocale
): SopDocument {
  const title_ko = keepFromEditor === 'ko' ? editor.title_ko : baseline.title_ko
  const title_en = keepFromEditor === 'en' ? editor.title_en : baseline.title_en

  const baselineMap = new Map(baseline.sections.map((s) => [s.id, s]))
  const editorIds = new Set(editor.sections.map((s) => s.id))
  const mergedFromEditor = [...editor.sections]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((es) => mergeSectionForLocale(es, baselineMap.get(es.id), keepFromEditor))

  const extras = baseline.sections.filter((s) => !editorIds.has(s.id))

  return prefillSortOrders({
    title_ko,
    title_en,
    sections: [...mergedFromEditor, ...extras].sort((a, b) => a.sort_order - b.sort_order),
  })
}

/** 서버에 저장된 섹션 최신본을 현재 문서의 동일 section id에 덮어씁니다. */
export function mergeLatestSectionSnapshotsIntoDoc(
  doc: SopDocument,
  snapshotsBySectionId: Map<string, SopSection>
): SopDocument {
  if (snapshotsBySectionId.size === 0) return prefillSortOrders(doc)
  return prefillSortOrders({
    ...doc,
    sections: doc.sections.map((s) => {
      const snap = snapshotsBySectionId.get(s.id)
      if (!snap) return s
      const merged = parseSopSectionJson(sopDocumentToJson(snap) as unknown)
      if (!merged) return s
      return { ...merged, id: s.id }
    }),
  })
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
