'use client'

import React, { useRef, useState, useCallback, useMemo } from 'react'
import { ChevronDown, Image as ImageIcon, Link2, List, Table2 } from 'lucide-react'
import { getLightRichEditorStrings, type LightRichEditorUiLocale } from '@/lib/lightRichEditorStrings'
import {
  markdownToHtml,
  markdownToHeadingHtml,
  normalizeMarkdownBlockStructure,
  stripSopFontSizeTokens,
  sopPlainDisplayText,
} from '@/lib/markdownToHtml'

export {
  markdownToHtml,
  markdownToHeadingHtml,
  normalizeMarkdownBlockStructure,
  stripSopFontSizeTokens,
  sopPlainDisplayText,
}

/** contentEditable 루트 안에서 커서가 ul/ol/li 안에 있는지 */
function selectionInsideList(root: HTMLElement | null): boolean {
  if (!root) return false
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  let node: Node | null = sel.anchorNode
  if (node?.nodeType === Node.TEXT_NODE) node = (node as Text).parentElement
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      const t = node.tagName.toLowerCase()
      if (t === 'ul' || t === 'ol' || t === 'li') return true
    }
    node = node.parentNode
  }
  return false
}

/** contentEditable 루트 안에서 커서가 table/td/th 안에 있는지 */
function selectionInsideTable(root: HTMLElement | null): boolean {
  if (!root) return false
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  let node: Node | null = sel.anchorNode
  if (node?.nodeType === Node.TEXT_NODE) node = (node as Text).parentElement
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      const t = node.tagName.toLowerCase()
      if (t === 'table' || t === 'thead' || t === 'tbody' || t === 'tr' || t === 'td' || t === 'th') {
        return true
      }
    }
    node = node.parentNode
  }
  return false
}

/** LightRichEditor 이미지 너비 — htmlToMarkdown 직렬화용 */
const SOPIMG_PREFIX = '[[sopimg:'

const DEFAULT_IMG_STYLE =
  'max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; display: block;'

function isSafeSopImageWidthToken(width: string): boolean {
  const w = width.trim()
  if (!w || w.length > 16) return false
  return /^[0-9.]+\s*(px|%)?$/i.test(w)
}

function extractImgWidthFromTagAttrs(attrs: string): string | null {
  const styleMatch = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs)
  const style = styleMatch?.[1] ?? styleMatch?.[2] ?? ''
  if (style) {
    const wm = /(?:^|;)\s*width\s*:\s*([^;]+)/i.exec(style)
    if (wm?.[1]?.trim()) return wm[1].trim()
  }
  const widthAttr = /width\s*=\s*"([^"]+)"/i.exec(attrs)
  if (widthAttr?.[1]?.trim()) return widthAttr[1].trim()
  return null
}

function buildSopImageHtml(src: string, alt: string, width?: string | null, editable = false): string {
  const safeAlt = alt.replace(/"/g, '&quot;')
  const cursor = editable ? ' cursor: pointer;' : ''
  if (width && isSafeSopImageWidthToken(width)) {
    const w = width.trim()
    return `<img src="${src}" alt="${safeAlt}" data-sop-img="1" class="sop-editable-image" style="width: ${w}; max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; display: block;${cursor}" />`
  }
  return `<img src="${src}" alt="${safeAlt}" data-sop-img="1" class="sop-editable-image" style="${DEFAULT_IMG_STYLE}${cursor}" />`
}

function tokenizeSopImages(html: string): string {
  return html.replace(/<img\b([^>]*?)\/?>/gi, (full, attrs: string) => {
    const src = /src\s*=\s*"([^"]+)"/i.exec(attrs)?.[1] ?? ''
    if (!src) return full
    const alt = /alt\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? ''
    const width = extractImgWidthFromTagAttrs(attrs)
    const md = `![${alt}](${src})`
    if (width && isSafeSopImageWidthToken(width)) {
      return `${SOPIMG_PREFIX}${width.trim()}]]${md}`
    }
    return md
  })
}

/** LightRichEditor 글자 크기(span style font-size) — htmlToMarkdown이 태그를 지우기 전에 직렬화 */
const SOPFS_OPEN = '[[sopfs:'
const SOPFS_CLOSE = '[[/sopfs]]'
/** underline — markdown에 표준 문법이 없어 토큰으로 보존 */
const SOPU_OPEN = '[[sopu]]'
const SOPU_CLOSE = '[[/sopu]]'

function isSafeSopFontSizeToken(size: string): boolean {
  const s = size.trim()
  if (!s || s.length > 24) return false
  // `20px`·`1.25rem` 등 (숫자와 단위 사이 공백 허용)
  return /^[0-9.]+\s*(px|pt|rem|em|%)?$/i.test(s)
}

function isBoldFontWeight(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v || v === 'normal' || v === 'lighter') return false
  if (v === 'bold' || v === 'bolder') return true
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 600
}

/** strong/b 안에서 Chrome이 붙이는 font-weight:normal(또는 400) → 명시적 비해제 */
function isExplicitNonBoldFontWeight(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return false
  if (v === 'normal' || v === 'lighter' || v === 'inherit' || v === 'initial' || v === 'unset') {
    return true
  }
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n < 600
}

function isItalicFontStyle(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v === 'italic' || v === 'oblique'
}

function hasUnderlineDecoration(value: string): boolean {
  return /\bunderline\b/i.test(value)
}

function readInlineStyle(el: Element, prop: string): string | null {
  const style = el.getAttribute('style') || ''
  const re = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i')
  return re.exec(style)?.[1]?.trim() ?? null
}

/**
 * Chrome partial bold/unbold 패턴 교정:
 *   <strong>abc<span style="font-weight:normal">,def</span></strong>
 * → <strong>abc</strong><span style="font-weight:normal">,def</span>
 * (naive ** 치환 시 전체가 볼드로 저장되는 문제 방지)
 */
function splitNonBoldOverridesOutOfBoldTags(html: string): string {
  if (typeof DOMParser === 'undefined' || !html) return html

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(`<div id="__sop_bold_root">${html}</div>`, 'text/html')
  } catch {
    return html
  }
  const root = doc.getElementById('__sop_bold_root')
  if (!root) return html

  const shouldForceUnbold = (el: Element): boolean => {
    const fw = readInlineStyle(el, 'font-weight')
    return Boolean(fw && isExplicitNonBoldFontWeight(fw))
  }

  const splitBoldContainer = (bold: HTMLElement): Node[] => {
    const out: Node[] = []
    let acc = doc.createElement('strong')

    const flushAcc = () => {
      if (acc.childNodes.length > 0) out.push(acc)
      acc = doc.createElement('strong')
    }

    for (const child of Array.from(bold.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && shouldForceUnbold(child as Element)) {
        flushAcc()
        out.push(child)
        continue
      }

      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement
        const nestedForced = Array.from(el.querySelectorAll('*')).filter(shouldForceUnbold)
        if (nestedForced.length > 0 || shouldForceUnbold(el)) {
          // 중첩 strong이면 재귀, 그 외는 자식만 펼쳐 비해제 우선
          if (/^(STRONG|B)$/i.test(el.tagName)) {
            flushAcc()
            out.push(...splitBoldContainer(el))
          } else {
            // <em>abc<span style="font-weight:normal">x</span></em> 등
            // 자식을 현재 bold 컨텍스트에서 다시 처리하기 위해 임시 strong으로 감싸 분할
            const tmp = doc.createElement('strong')
            while (el.firstChild) tmp.appendChild(el.firstChild)
            const pieces = splitBoldContainer(tmp)
            for (const piece of pieces) {
              if (
                piece.nodeType === Node.ELEMENT_NODE &&
                (piece as Element).tagName === 'STRONG'
              ) {
                const wrap = el.cloneNode(false) as HTMLElement
                while (piece.firstChild) wrap.appendChild(piece.firstChild)
                const strongWrap = doc.createElement('strong')
                strongWrap.appendChild(wrap)
                out.push(strongWrap)
              } else {
                const wrap = el.cloneNode(false) as HTMLElement
                wrap.appendChild(piece)
                out.push(wrap)
              }
            }
          }
          continue
        }
      }

      acc.appendChild(child)
    }
    flushAcc()
    return out
  }

  // deepest-first so nested strong이 먼저 정리됨
  const boldEls = Array.from(root.querySelectorAll('strong, b')).reverse()
  for (const bold of boldEls) {
    if (!(bold instanceof HTMLElement)) continue
    if (!Array.from(bold.querySelectorAll('*')).some(shouldForceUnbold) && !shouldForceUnbold(bold)) {
      continue
    }
    const parent = bold.parentNode
    if (!parent) continue
    const pieces = splitBoldContainer(bold)
    for (const piece of pieces) {
      parent.insertBefore(piece, bold)
    }
    parent.removeChild(bold)
  }

  return root.innerHTML
}

/**
 * Chrome contentEditable이 만든 style span을 시맨틱 태그/토큰으로 정규화.
 * (font-weight:700 / bold 등이 태그 제거 단계에서 사라지는 것 방지)
 */
function normalizeContentEditableSpans(html: string): string {
  const re =
    /<span\b[^>]*\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>((?:(?!<span\b)[\s\S])*?)<\/span>/gi
  let out = html
  for (let guard = 0; guard < 100; guard++) {
    const before = out
    out = out.replace(re, (full, dblQuoted: string | undefined, sglQuoted: string | undefined, inner: string) => {
      const style = dblQuoted ?? sglQuoted ?? ''
      let wrapped = inner
      let known = false

      if (hasUnderlineDecoration(style)) {
        wrapped = `<u>${wrapped}</u>`
        known = true
      }
      if (isItalicFontStyle(/font-style\s*:\s*([^;]+)/i.exec(style)?.[1] ?? '')) {
        wrapped = `<em>${wrapped}</em>`
        known = true
      }
      const fw = /font-weight\s*:\s*([^;]+)/i.exec(style)?.[1] ?? ''
      if (isBoldFontWeight(fw)) {
        wrapped = `<strong>${wrapped}</strong>`
        known = true
      } else if (fw && isExplicitNonBoldFontWeight(fw)) {
        // 비해제 span은 껍데기만 제거 (내용은 볼드 바깥으로 이미 split됨)
        return inner
      }

      const fsMatch = /font-size\s*:\s*([^;"'\s]+)/i.exec(style)
      if (fsMatch && isSafeSopFontSizeToken(fsMatch[1])) {
        wrapped = `${SOPFS_OPEN}${fsMatch[1].trim()}]]${wrapped}${SOPFS_CLOSE}`
        known = true
      }

      // 인식한 서식이 없으면 원본 span 유지 (색상 등 기타 스타일)
      return known ? wrapped : full
    })
    if (out === before) break
  }
  return out
}

const TABLE_WRAPPER_STYLE =
  'overflow-x: auto; margin: 1rem 0; border: 1px solid #e2e8f0; border-radius: 0.75rem;'
const TABLE_STYLE = 'width: 100%; border-collapse: collapse; font-size: 0.875rem; line-height: 1.5;'
const TABLE_TH_STYLE =
  'border: 1px solid #e2e8f0; padding: 0.55rem 0.75rem; text-align: left; font-weight: 600; background: #f8fafc; color: #0f172a;'
const TABLE_TD_STYLE =
  'border: 1px solid #e2e8f0; padding: 0.55rem 0.75rem; vertical-align: top; color: #334155;'
const TABLE_TR_STYLE = 'border-bottom: 1px solid #e2e8f0;'

function buildEditableTableHtml(rows: number, cols: number): string {
  const safeRows = Math.max(2, Math.min(rows, 20))
  const safeCols = Math.max(2, Math.min(cols, 8))

  const headerCells = Array.from({ length: safeCols }, (_, i) =>
    `<th style="${TABLE_TH_STYLE}">열 ${i + 1}</th>`
  ).join('')

  const bodyRows = Array.from({ length: safeRows - 1 }, () => {
    const cells = Array.from({ length: safeCols }, () => `<td style="${TABLE_TD_STYLE}">&nbsp;</td>`).join('')
    return `<tr style="${TABLE_TR_STYLE}">${cells}</tr>`
  }).join('')

  return `<div style="${TABLE_WRAPPER_STYLE}"><table style="${TABLE_STYLE}"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div><p><br></p>`
}

/** li 내부 HTML을 줄 단위 세그먼트로 (목록 항목 이후 본문 분리용) */
const liInnerToMarkdownSegments = (inner: string): string[] => {
  let t = inner
  t = t.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  t = t.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
  t = t.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  t = t.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
  t = t.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, `${SOPU_OPEN}$1${SOPU_CLOSE}`)
  t = t.replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
  t = t.replace(/<\/div>/gi, '\n')
  t = t.replace(/<div[^>]*>/gi, '')
  t = t.replace(/<\/p>/gi, '\n')
  t = t.replace(/<p[^>]*>/gi, '')
  t = t.replace(/<br\s*\/?>/gi, '\n')
  t = t.replace(/<[^>]+>/g, '')
  return t.split('\n').map((s) => s.trim()).filter(Boolean)
}

/** li 내부 HTML을 마크다운 한 줄로 (중첩 블록 없다고 가정) */
const liInnerToMarkdownLine = (inner: string): string => {
  return liInnerToMarkdownSegments(inner)[0] ?? ''
}

/** 표 셀·인라인 HTML을 마크다운 한 줄로 */
const inlineHtmlToMarkdown = (inner: string): string => {
  let t = inner
  t = t.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  t = t.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
  t = t.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  t = t.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
  t = t.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, `${SOPU_OPEN}$1${SOPU_CLOSE}`)
  t = t.replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
  t = t.replace(/<br\s*\/?>/gi, ' ')
  t = t.replace(/&nbsp;/gi, ' ')
  t = t.replace(/<[^>]+>/g, '')
  return t.replace(/\s+/g, ' ').trim()
}

function extractTableRowsFromHtml(tableInner: string): string[][] {
  const rows: string[][] = []
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch: RegExpExecArray | null
  while ((trMatch = trRe.exec(tableInner)) !== null) {
    const cells: string[] = []
    const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRe.exec(trMatch[1])) !== null) {
      cells.push(inlineHtmlToMarkdown(cellMatch[1]))
    }
    if (cells.length >= 2) rows.push(cells)
  }
  return rows
}

function serializeMarkdownTable(rows: string[][]): string {
  if (rows.length < 1) return ''
  const colCount = Math.max(...rows.map((row) => row.length))
  const padRow = (cells: string[]) => {
    const padded = [...cells]
    while (padded.length < colCount) padded.push('')
    return padded.map((cell) => cell.replace(/\|/g, '\\|'))
  }
  const [header, ...body] = rows
  const headerLine = `| ${padRow(header).join(' | ')} |`
  const sepLine = `| ${Array(colCount).fill('---').join(' | ')} |`
  const bodyLines = body.map((row) => `| ${padRow(row).join(' | ')} |`)
  return [headerLine, sepLine, ...bodyLines].join('\n')
}

function htmlTablesToMarkdown(html: string): string {
  const convertTableBlock = (tableBlock: string): string => {
    const tableMatch = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(tableBlock)
    if (!tableMatch) return tableBlock
    const rows = extractTableRowsFromHtml(tableMatch[1])
    const md = serializeMarkdownTable(rows)
    return md ? `\n\n${md}\n\n` : tableBlock
  }

  let out = html
  out = out.replace(/<div[^>]*>\s*<table[\s\S]*?<\/table>\s*<\/div>/gi, convertTableBlock)
  out = out.replace(/<table[\s\S]*?<\/table>/gi, convertTableBlock)
  return out
}

// HTML을 마크다운으로 변환하는 함수
const htmlToMarkdown = (html: string): string => {
  let markdown = html
  // 부분 볼드 해제 시 strong 안 font-weight:normal span 분리 (전체 볼드화 방지)
  markdown = splitNonBoldOverridesOutOfBoldTags(markdown)
  markdown = normalizeContentEditableSpans(markdown)
  markdown = tokenizeSopImages(markdown)
  markdown = htmlTablesToMarkdown(markdown)

  // 밑줄 보존 (태그 제거 전에 토큰화)
  markdown = markdown.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, `${SOPU_OPEN}$1${SOPU_CLOSE}`)

  // 굵게 변환: <strong>text</strong> -> **text**
  markdown = markdown.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
  markdown = markdown.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')

  // 기울임 변환: <em>text</em> -> *text*
  markdown = markdown.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
  markdown = markdown.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')

  // 링크 변환: <a href="url">text</a> -> [text](url)
  markdown = markdown.replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

  // 순서 목록: <ol>…</ol> -> "1. …\n2. …"
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner: string) => {
    const listLines: string[] = []
    const trailingBlocks: string[] = []
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let match: RegExpExecArray | null
    let i = 1
    while ((match = liRe.exec(inner)) !== null) {
      const segments = liInnerToMarkdownSegments(match[1])
      if (!segments.length) continue
      listLines.push(`${i}. ${segments[0]}`)
      if (segments.length > 1) trailingBlocks.push(...segments.slice(1))
      i += 1
    }
    if (!listLines.length) return ''
    const body = [listLines.join('\n')]
    if (trailingBlocks.length) body.push(trailingBlocks.join('\n\n'))
    return `${body.join('\n\n')}\n\n`
  })

  // 글머리 목록: <ul>…</ul> -> "- …\n- …"
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner: string) => {
    const listLines: string[] = []
    const trailingBlocks: string[] = []
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let match: RegExpExecArray | null
    while ((match = liRe.exec(inner)) !== null) {
      const segments = liInnerToMarkdownSegments(match[1])
      if (!segments.length) continue
      listLines.push(`- ${segments[0]}`)
      if (segments.length > 1) trailingBlocks.push(...segments.slice(1))
    }
    if (!listLines.length) return ''
    const body = [listLines.join('\n')]
    if (trailingBlocks.length) body.push(trailingBlocks.join('\n\n'))
    return `${body.join('\n\n')}\n\n`
  })

  // 남은 단독 li (ul 밖) 처리
  markdown = markdown.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => `- ${liInnerToMarkdownLine(inner)}\n`)

  // 제목 블록 (닫는 태그만 먼저 치환하면 매칭이 깨지므로 통째로 변환)
  markdown = markdown.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => {
    const text = inlineHtmlToMarkdown(inner)
    return text ? `${'#'.repeat(Number(level))} ${text}\n\n` : '\n\n'
  })

  // 블록 단락: </p>·</div>는 단락 구분(\n\n). contentEditable이 Enter로 만드는 줄 컨테이너 보존.
  markdown = markdown.replace(/<\/p>/gi, '\n\n')
  markdown = markdown.replace(/<p[^>]*>/gi, '')
  markdown = markdown.replace(/<\/div>/gi, '\n\n')
  markdown = markdown.replace(/<div[^>]*>/gi, '')

  // 소프트 줄바꿈: <br> -> \n
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n')

  // HTML 태그 제거
  markdown = markdown.replace(/<[^>]*>/g, '')

  // 흔한 HTML 엔티티 복원
  markdown = markdown.replace(/&nbsp;/gi, ' ')
  markdown = markdown.replace(/&#160;/gi, ' ')
  markdown = markdown.replace(/&amp;/gi, '&')
  markdown = markdown.replace(/&lt;/gi, '<')
  markdown = markdown.replace(/&gt;/gi, '>')
  markdown = markdown.replace(/&quot;/gi, '"')
  markdown = markdown.replace(/&#10;/gi, '\n')
  markdown = markdown.replace(/&#13;/gi, '')

  // 줄 끝 공백 정리 (줄바꿈 자체는 유지)
  markdown = markdown.replace(/[ \t]+\n/g, '\n')
  markdown = markdown.replace(/\n[ \t]+/g, '\n')

  // 연속된 줄바꿈을 최대 2개로 제한 (너무 많은 빈 줄 방지)
  markdown = markdown.replace(/\n{3,}/g, '\n\n')

  // 앞뒤 공백만 제거 — String.trim()은 trailing \n\n 단락까지 지워 Enter 줄바꿈이 사라짐
  markdown = markdown.replace(/^[ \t\u00a0]+|[ \t\u00a0]+$/g, '')
  markdown = markdown.replace(/^\n+/, '').replace(/\n+$/, '')

  return markdown
}

// 에디터 props 인터페이스
interface LightRichEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  /** true면 읽기 전용(참고 패널 등) */
  readOnly?: boolean
  height?: number
  placeholder?: string
  className?: string
  showToolbar?: boolean
  enableImageUpload?: boolean
  /** 삽입된 스크린샷·이미지 클릭 후 크기 조절 */
  enableImageResize?: boolean
  enableColorPicker?: boolean
  enableFontSize?: boolean
  enableFontFamily?: boolean
  /** 제공 시 붙여넣기·파일 업로드 이미지를 Supabase 등 외부 URL로 저장 */
  uploadImageFile?: (file: File) => Promise<string | null>
  enableLink?: boolean
  enableList?: boolean
  enableTable?: boolean
  enableBold?: boolean
  enableItalic?: boolean
  enableUnderline?: boolean
  enableResize?: boolean
  /** 읽기 전용이어도 높이 드래그 조절 허용 */
  resizeWhenReadOnly?: boolean
  minHeight?: number
  maxHeight?: number
  /** 읽기 전용 표시 시 내용 높이에 맞춤 (잘림 방지) */
  autoHeight?: boolean
  /** 툴바·프롬프트 UI 언어 (en: 아이콘 중심 영문) */
  uiLocale?: LightRichEditorUiLocale
}

// 가벼운 리치 텍스트 에디터 컴포넌트
const LightRichEditor: React.FC<LightRichEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  height = 200,
  placeholder = "텍스트를 입력하세요... (Ctrl+B: 굵게, Ctrl+I: 기울임, Ctrl+U: 밑줄)",
  className = "",
  showToolbar = true,
  enableImageUpload = true,
  enableImageResize = true,
  enableColorPicker = true,
  enableFontSize = true,
  enableFontFamily = false,
  uploadImageFile,
  enableLink = true,
  enableList = true,
  enableTable = true,
  enableBold = true,
  enableItalic = true,
  enableUnderline = true,
  enableResize = true,
  resizeWhenReadOnly = false,
  minHeight = 100,
  maxHeight = 800,
  autoHeight = false,
  uiLocale = 'ko',
}) => {
  const strings = useMemo(() => getLightRichEditorStrings(uiLocale), [uiLocale])
  const defaultKoPlaceholder = "텍스트를 입력하세요... (Ctrl+B: 굵게, Ctrl+I: 기울임, Ctrl+U: 밑줄)"
  const effectivePlaceholder =
    !placeholder || placeholder === defaultKoPlaceholder ? strings.placeholder : placeholder
  const effectiveShowToolbar = readOnly ? false : showToolbar
  const effectiveResize = readOnly ? resizeWhenReadOnly : enableResize
  const effectiveImageResize = !readOnly && enableImageUpload && enableImageResize
  const htmlOptions = { editableImages: effectiveImageResize }
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isInitializedRef = useRef(false)
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [imageToolbarPos, setImageToolbarPos] = useState<{ top: number; left: number } | null>(null)
  
  // 드롭다운 상태 관리
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontSizePicker, setShowFontSizePicker] = useState(false)
  const [showFontFamilyPicker, setShowFontFamilyPicker] = useState(false)
  const [showBackgroundColorPicker, setShowBackgroundColorPicker] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(2)
  
  // 사이즈 조정 상태 관리
  const [currentHeight, setCurrentHeight] = useState(height)
  
  // height prop이 변경되면 currentHeight도 업데이트
  React.useEffect(() => {
    setCurrentHeight(height)
  }, [height])
  
  // 미리 정의된 색상 팔레트 (고유한 색상들)
  const colorPalette = [
    // 기본 색상
    '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
    // 빨간색 계열
    '#FF0000', '#CC0000', '#990000', '#FF3333', '#FF6666', '#FF9999',
    // 주황색 계열
    '#FF6600', '#FF9900', '#FFCC00', '#FFD700', '#FFA500', '#FF8C00',
    // 초록색 계열
    '#00FF00', '#00CC00', '#009900', '#00FF33', '#00FF66', '#00FF99',
    // 파란색 계열
    '#0066FF', '#0099FF', '#00CCFF', '#00FFFF', '#0000FF', '#3333FF',
    // 보라색 계열
    '#6600FF', '#9900FF', '#CC00FF', '#FF00FF', '#9966FF', '#CC99FF',
    // 분홍색 계열
    '#FF0066', '#FF3366', '#FF6699', '#FF99CC', '#FFCCFF', '#FFB6C1'
  ]
  
  const fontFamilyOptions = useMemo(
    () => [
      { label: strings.fontDefault, value: 'inherit' },
      { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
      { label: 'Georgia', value: 'Georgia, serif' },
      { label: 'Times', value: '"Times New Roman", Times, serif' },
      { label: 'Courier', value: '"Courier New", Courier, monospace' },
      { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    ],
    [strings.fontDefault]
  )

  // 폰트 크기 옵션
  const fontSizeOptions = [
    { label: '8px', value: '8px' },
    { label: '9px', value: '9px' },
    { label: '10px', value: '10px' },
    { label: '11px', value: '11px' },
    { label: '12px', value: '12px' },
    { label: '14px', value: '14px' },
    { label: '16px', value: '16px' },
    { label: '18px', value: '18px' },
    { label: '20px', value: '20px' },
    { label: '24px', value: '24px' },
    { label: '28px', value: '28px' },
    { label: '32px', value: '32px' },
    { label: '36px', value: '36px' },
    { label: '48px', value: '48px' },
    { label: '72px', value: '72px' }
  ]

  // 에디터 초기화 및 값 동기화
  React.useEffect(() => {
    if (editorRef.current) {
      try {
        document.execCommand('defaultParagraphSeparator', false, 'p')
      } catch {
        /* ignore */
      }
      if (!isInitializedRef.current) {
        // 초기화: value가 있으면 설정, 없으면 빈 문자열로 초기화
        const htmlContent = value ? markdownToHtml(value, htmlOptions) : ''
        editorRef.current.innerHTML = htmlContent
        isInitializedRef.current = true
      } else {
        // 이미 초기화된 경우, value가 변경되면 에디터 내용도 업데이트
        // 단, 사용자가 현재 편집 중이 아닐 때만 (커서가 없을 때)
        const currentContent = editorRef.current.innerHTML
        const expectedContent = value ? markdownToHtml(value, htmlOptions) : ''
        const currentMarkdown = htmlToMarkdown(currentContent)
        // 현재 내용과 새로운 value가 다를 때만 업데이트 (외부에서 value가 변경된 경우)
        if (currentMarkdown !== value && !editorRef.current.matches(':focus-within')) {
          editorRef.current.innerHTML = expectedContent
        }
      }

      if (autoHeight && readOnly && editorRef.current) {
        const el = editorRef.current
        // 측정 전 고정 height 해제 효과: scrollHeight 기준
        const next = Math.max(minHeight, Math.min(maxHeight, el.scrollHeight + 4))
        setCurrentHeight(next)
      }
    }
  }, [value, readOnly, htmlOptions.editableImages, autoHeight, minHeight, maxHeight])

  // 에디터 내용 업데이트
  const updateEditorContent = useCallback(() => {
    if (readOnly) return
    if (editorRef.current) {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true
      }

      const htmlContent = editorRef.current.innerHTML
      const markdownContent = htmlToMarkdown(htmlContent)
      onChange(markdownContent)
    }
  }, [readOnly, onChange])

  const syncSelectedImageToolbar = useCallback((img: HTMLImageElement | null) => {
    if (!img || !editorRef.current) {
      setImageToolbarPos(null)
      return
    }
    const editorBox = editorRef.current.getBoundingClientRect()
    const imgBox = img.getBoundingClientRect()
    setImageToolbarPos({
      top: imgBox.top - editorBox.top + editorRef.current.scrollTop - 4,
      left: imgBox.left - editorBox.left + editorRef.current.scrollLeft,
    })
  }, [])

  const clearSelectedImage = useCallback(() => {
    if (selectedImage) {
      selectedImage.classList.remove('sop-editable-image--selected')
    }
    setSelectedImage(null)
    setImageToolbarPos(null)
  }, [selectedImage])

  const selectEditorImage = useCallback(
    (img: HTMLImageElement) => {
      editorRef.current?.querySelectorAll('img.sop-editable-image--selected').forEach((node) => {
        node.classList.remove('sop-editable-image--selected')
      })
      img.classList.add('sop-editable-image--selected')
      setSelectedImage(img)
      syncSelectedImageToolbar(img)
    },
    [syncSelectedImageToolbar]
  )

  const applyImageWidth = useCallback(
    (img: HTMLImageElement, width: string) => {
      if (!isSafeSopImageWidthToken(width)) return
      img.style.width = width.trim()
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      syncSelectedImageToolbar(img)
      updateEditorContent()
    },
    [syncSelectedImageToolbar, updateEditorContent]
  )

  const getImageWidthPercent = useCallback((img: HTMLImageElement): number => {
    const editorWidth = editorRef.current?.clientWidth ?? 1
    const imgWidth = img.getBoundingClientRect().width
    return Math.round((imgWidth / editorWidth) * 100)
  }, [])

  const handleEditorImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!effectiveImageResize) return
    const target = e.target
    if (target instanceof HTMLImageElement && editorRef.current?.contains(target)) {
      e.preventDefault()
      selectEditorImage(target)
      return
    }
    if (!(target instanceof HTMLElement && target.closest('.sop-image-resize-toolbar'))) {
      clearSelectedImage()
    }
  }

  const startImageWidthDrag = (e: React.MouseEvent, img: HTMLImageElement) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = img.getBoundingClientRect().width
    const maxWidth = editorRef.current?.clientWidth ?? startWidth

    const onMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      const delta = moveEvent.clientX - startX
      const next = Math.max(80, Math.min(maxWidth, startWidth + delta))
      img.style.width = `${Math.round(next)}px`
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      syncSelectedImageToolbar(img)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      updateEditorContent()
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  React.useEffect(() => {
    if (!selectedImage || !effectiveImageResize) return
    const editor = editorRef.current
    if (!editor) return

    const reposition = () => syncSelectedImageToolbar(selectedImage)
    editor.addEventListener('scroll', reposition)
    window.addEventListener('resize', reposition)
    return () => {
      editor.removeEventListener('scroll', reposition)
      window.removeEventListener('resize', reposition)
    }
  }, [selectedImage, effectiveImageResize, syncSelectedImageToolbar])

  const imageResizeHandleStyle = React.useMemo(() => {
    if (!selectedImage || !editorRef.current) return null
    const editorBox = editorRef.current.getBoundingClientRect()
    const imgBox = selectedImage.getBoundingClientRect()
    return {
      top: imgBox.top - editorBox.top + editorRef.current.scrollTop + imgBox.height / 2 - 12,
      left: imgBox.right - editorBox.left + editorRef.current.scrollLeft - 6,
    }
  }, [selectedImage, imageToolbarPos])

  const IMAGE_WIDTH_PRESETS = ['25%', '50%', '75%', '100%'] as const

  // 드롭다운 외부 클릭 시 닫기
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showColorPicker || showFontSizePicker || showFontFamilyPicker || showBackgroundColorPicker || showTablePicker) {
        const target = event.target as HTMLElement
        if (!target.closest('.relative')) {
          setShowColorPicker(false)
          setShowFontSizePicker(false)
          setShowFontFamilyPicker(false)
          setShowBackgroundColorPicker(false)
          setShowTablePicker(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColorPicker, showFontSizePicker, showFontFamilyPicker, showBackgroundColorPicker, showTablePicker])

  // 사이즈 조정 이벤트 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const startY = clientY
    const startHeight = currentHeight
    
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      moveEvent.preventDefault()
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY
      const deltaY = currentY - startY
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY))
      setCurrentHeight(newHeight)
    }
    
    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove as EventListener)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove as EventListener)
      document.removeEventListener('touchend', handleEnd)
    }
    
    document.addEventListener('mousemove', handleMove as EventListener)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove as EventListener, { passive: false })
    document.addEventListener('touchend', handleEnd)
  }, [currentHeight, minHeight, maxHeight])

  const insertLink = () => {
    const url = prompt(strings.linkUrlPrompt)
    if (url) {
      const text = prompt(strings.linkTextPrompt, strings.linkDefaultText)
      if (text) {
        const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${text}</a>`
        document.execCommand('insertHTML', false, linkHtml)
        setTimeout(updateEditorContent, 0)
      }
    }
  }

  const insertList = () => {
    editorRef.current?.focus()
    document.execCommand('insertUnorderedList', false)
    setTimeout(updateEditorContent, 0)
  }

  const insertTable = () => {
    editorRef.current?.focus()
    const html = buildEditableTableHtml(tableRows, tableCols)
    document.execCommand('insertHTML', false, html)
    setShowTablePicker(false)
    setTimeout(updateEditorContent, 0)
  }

  // 이미지 삽입
  const insertImage = () => {
    fileInputRef.current?.click()
  }

  const insertImageDataUrl = (imageUrl: string, alt: string) => {
    editorRef.current?.focus()
    const imageHtml = buildSopImageHtml(imageUrl, alt, null, effectiveImageResize)
    document.execCommand('insertHTML', false, imageHtml)
    setTimeout(updateEditorContent, 0)
  }

  const insertImageFromFile = useCallback(
    async (file: File) => {
      if (uploadImageFile) {
        try {
          const uploadedUrl = await uploadImageFile(file)
          if (uploadedUrl) {
            insertImageDataUrl(uploadedUrl, file.name || 'image')
            return
          }
        } catch (error) {
          console.error('[LightRichEditor] image upload failed', error)
          alert(error instanceof Error ? error.message : strings.imageUploadFailed)
          return
        }
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        if (imageUrl) insertImageDataUrl(imageUrl, file.name || 'image')
      }
      reader.readAsDataURL(file)
    },
    [uploadImageFile, effectiveImageResize, updateEditorContent, strings.imageUploadFailed]
  )

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      void insertImageFromFile(file)
    }
    e.target.value = ''
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (readOnly) return

    const items = e.clipboardData?.items
    if (enableImageUpload && items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item?.type.startsWith('image/')) continue
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        void insertImageFromFile(file)
        return
      }
    }

    const plain = e.clipboardData?.getData('text/plain') ?? ''
    const htmlClip = e.clipboardData?.getData('text/html') ?? ''
    const looksLikeMarkdown =
      plain.length > 0 &&
      /(^|\n)\s{0,3}#{1,6}\s+\S|(^|\n)\s*[-*•]\s+\S|(^|\n)\|.+\|/.test(plain)

    // ChatGPT/마크다운 원문 붙여넣기: 브라우저가 줄바꿈을 뭉개기 전에 HTML로 삽입
    if (looksLikeMarkdown) {
      const htmlIsMostlyPlain =
        !htmlClip ||
        !/<(h[1-6]|ul|ol|li|table|p)\b/i.test(htmlClip) ||
        htmlClip.length < plain.length * 0.5

      if (htmlIsMostlyPlain || /(?:^|\n)\s{0,3}#{1,6}\s+/.test(plain)) {
        e.preventDefault()
        const normalized = normalizeMarkdownBlockStructure(plain)
        const insertHtml = markdownToHtml(normalized, htmlOptions)
        document.execCommand('insertHTML', false, insertHtml || plain.replace(/\n/g, '<br>'))
        setTimeout(updateEditorContent, 0)
        return
      }
    }

    setTimeout(updateEditorContent, 0)
  }

  // 글자색 적용
  const applyColor = (color: string) => {
    document.execCommand('foreColor', false, color)
    setTimeout(updateEditorContent, 0)
    setShowColorPicker(false)
  }

  // 배경색 적용
  const applyBackgroundColor = (color: string) => {
    document.execCommand('backColor', false, color)
    setTimeout(updateEditorContent, 0)
    setShowBackgroundColorPicker(false)
  }

  // 글자 크기 적용
  const applyFontSize = (size: string) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.style.fontSize = size
      try {
        range.surroundContents(span)
        setTimeout(updateEditorContent, 0)
      } catch {
        console.log('Cannot surround contents')
      }
    }
    setShowFontSizePicker(false)
  }

  const applyFontFamily = (family: string) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.style.fontFamily = family
      try {
        range.surroundContents(span)
        setTimeout(updateEditorContent, 0)
      } catch {
        console.log('Cannot surround contents')
      }
    }
    setShowFontFamilyPicker(false)
  }

  return (
    <div className={`border border-gray-300 rounded overflow-hidden flex flex-col ${className}`}>
      {/* 툴바 */}
      {effectiveShowToolbar && (
        <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1">
          {enableBold && (
            <button
              type="button"
              onClick={() => {
                document.execCommand('bold')
                setTimeout(updateEditorContent, 0)
              }}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
              title={strings.boldTitle}
            >
              B
            </button>
          )}
          {enableItalic && (
            <button
              type="button"
              onClick={() => {
                document.execCommand('italic')
                setTimeout(updateEditorContent, 0)
              }}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 italic"
              title={strings.italicTitle}
            >
              I
            </button>
          )}
          {enableUnderline && (
            <button
              type="button"
              onClick={() => {
                document.execCommand('underline')
                setTimeout(updateEditorContent, 0)
              }}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 underline"
              title={strings.underlineTitle}
            >
              U
            </button>
          )}
          {(enableBold || enableItalic || enableUnderline) && (
            <div className="w-px bg-gray-300 mx-1"></div>
          )}
          {enableList && (
            <button
              type="button"
              onClick={insertList}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
              title={strings.listTitle}
              aria-label={strings.listTitle}
            >
              <List className="h-4 w-4" aria-hidden />
              {!strings.iconOnlyToolbar ? <span>{strings.listButton}</span> : null}
            </button>
          )}
          {enableTable && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTablePicker(!showTablePicker)}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
                title={strings.tableTitle}
                aria-label={strings.tableTitle}
              >
                <Table2 className="h-4 w-4" aria-hidden />
                {!strings.iconOnlyToolbar ? <span>{strings.tableButton}</span> : null}
              </button>
              {showTablePicker && (
                <div className="absolute top-full left-0 z-20 mt-1 w-52 rounded border border-gray-300 bg-white p-3 shadow-lg">
                  <p className="mb-2 text-xs font-medium text-gray-600">{strings.tableSize}</p>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <label className="text-xs text-gray-600">
                      {strings.rows}
                      <input
                        type="number"
                        min={2}
                        max={20}
                        value={tableRows}
                        onChange={(e) => setTableRows(Math.max(2, Math.min(20, Number(e.target.value) || 2)))}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-xs text-gray-600">
                      {strings.cols}
                      <input
                        type="number"
                        min={2}
                        max={8}
                        value={tableCols}
                        onChange={(e) => setTableCols(Math.max(2, Math.min(8, Number(e.target.value) || 2)))}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={insertTable}
                    className="w-full rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                  >
                    {strings.insertTable}
                  </button>
                </div>
              )}
            </div>
          )}
          {enableLink && (
            <button
              type="button"
              onClick={insertLink}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
              title={strings.linkTitle}
              aria-label={strings.linkTitle}
            >
              <Link2 className="h-4 w-4" aria-hidden />
              {!strings.iconOnlyToolbar ? <span>{strings.linkButton}</span> : null}
            </button>
          )}
          {enableImageUpload && (
            <button
              type="button"
              onClick={insertImage}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
              title={strings.imageTitle}
              aria-label={strings.imageTitle}
            >
              <ImageIcon className="h-4 w-4" aria-hidden />
              {!strings.iconOnlyToolbar ? <span>{strings.imageButton}</span> : null}
            </button>
          )}
          {(enableList || enableTable || enableLink || enableImageUpload) && (
            <div className="w-px bg-gray-300 mx-1"></div>
          )}
          
          {/* 글자색 선택기 */}
          {enableColorPicker && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                title={strings.textColorTitle}
              >
                <span style={{ color: '#000000' }}>A</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-10">
                  <div className="grid grid-cols-6 gap-1 w-48">
                    {colorPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => applyColor(color)}
                        className="w-6 h-6 border border-gray-300 rounded hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 배경색 선택기 */}
          {enableColorPicker && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBackgroundColorPicker(!showBackgroundColorPicker)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                title={strings.backgroundColorTitle}
              >
                <span className="relative">
                  <span style={{ color: '#000000' }}>A</span>
                  <span className="absolute top-0 left-0 w-full h-1/2 bg-yellow-300 opacity-50"></span>
                </span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showBackgroundColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-10">
                  <div className="grid grid-cols-6 gap-1 w-48">
                    {colorPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => applyBackgroundColor(color)}
                        className="w-6 h-6 border border-gray-300 rounded hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 폰트 크기 선택기 */}
          {enableFontSize && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFontSizePicker(!showFontSizePicker)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                title={strings.fontSizeTitle}
              >
                <span>12px</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showFontSizePicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10">
                  <div className="max-h-48 overflow-y-auto">
                    {fontSizeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyFontSize(option.value)}
                        className="w-full px-3 py-1 text-sm text-left hover:bg-gray-100 flex items-center justify-between"
                      >
                        <span>{option.label}</span>
                        <span style={{ fontSize: option.value }}>A</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {enableFontFamily && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFontFamilyPicker(!showFontFamilyPicker)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
                title={strings.fontFamilyTitle}
              >
                <span>{uiLocale === 'en' ? 'Font' : '글꼴'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showFontFamilyPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 min-w-[10rem]">
                  {fontFamilyOptions.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => applyFontFamily(option.value)}
                      className="w-full px-3 py-1.5 text-sm text-left hover:bg-gray-100"
                      style={{ fontFamily: option.value === 'inherit' ? undefined : option.value }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* 에디터 영역 */}
      <div className="relative flex-shrink-0">
        {effectiveImageResize && selectedImage && imageToolbarPos && (
          <div
            className="sop-image-resize-toolbar absolute z-20 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-md"
            style={{
              top: Math.max(4, imageToolbarPos.top - 44),
              left: Math.max(4, imageToolbarPos.left),
              maxWidth: 'calc(100% - 8px)',
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="mr-1 text-[11px] font-medium text-slate-500">{strings.imageSizeLabel}</span>
            {IMAGE_WIDTH_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyImageWidth(selectedImage, preset)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  getImageWidthPercent(selectedImage) === parseInt(preset, 10)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset}
              </button>
            ))}
            <input
              type="range"
              min={20}
              max={100}
              value={Math.min(100, Math.max(20, getImageWidthPercent(selectedImage)))}
              onChange={(e) => applyImageWidth(selectedImage, `${e.target.value}%`)}
              className="ml-1 h-1.5 w-20 cursor-pointer accent-blue-600"
              aria-label={strings.imageWidthAria}
            />
          </div>
        )}
        {effectiveImageResize && selectedImage && imageResizeHandleStyle && (
          <div
            role="presentation"
            className="absolute z-20 h-6 w-2 cursor-ew-resize rounded bg-blue-600 shadow-sm hover:bg-primary/90"
            style={imageResizeHandleStyle}
            title={strings.dragResizeTitle}
            onMouseDown={(e) => startImageWidthDrag(e, selectedImage)}
          />
        )}
        <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning={true}
        onClick={handleEditorImageClick}
        onInput={readOnly ? undefined : updateEditorContent}
        onBlur={readOnly ? undefined : updateEditorContent}
        onKeyUp={readOnly ? undefined : updateEditorContent}
        onPaste={readOnly ? undefined : handlePaste}
        onKeyDown={
          readOnly
            ? undefined
            : (e) => {
          // 목록(ul/ol/li) 또는 표(table) 안에서는 브라우저 기본 Enter 유지
          if (e.key === 'Enter' && !e.shiftKey) {
            if (selectionInsideList(editorRef.current) || selectionInsideTable(editorRef.current)) {
              return
            }
            e.preventDefault()
            // 단락 분리(저장 시 \n\n) — 단일 <br>만 넣으면 trailing trim/왕복에서 줄바꿈이 사라짐
            const inserted = document.execCommand('insertParagraph')
            if (!inserted) {
              document.execCommand('insertHTML', false, '<p><br></p>')
            }
            setTimeout(updateEditorContent, 0)
          }
          // Shift+Enter: 소프트 줄바꿈(<br> → 저장 시 \n)
          else if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault()
            document.execCommand('insertHTML', false, '<br>')
            setTimeout(updateEditorContent, 0)
          }
          // Ctrl+B: 굵게
          else if (e.ctrlKey && e.key === 'b' && enableBold) {
            e.preventDefault()
            document.execCommand('bold')
            setTimeout(updateEditorContent, 0)
          }
          // Ctrl+I: 기울임
          else if (e.ctrlKey && e.key === 'i' && enableItalic) {
            e.preventDefault()
            document.execCommand('italic')
            setTimeout(updateEditorContent, 0)
          }
          // Ctrl+U: 밑줄
          else if (e.ctrlKey && e.key === 'u' && enableUnderline) {
            e.preventDefault()
            document.execCommand('underline')
            setTimeout(updateEditorContent, 0)
          }
        }
        }
        className={`w-full p-4 text-sm overflow-y-auto flex-shrink-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-8 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-8 [&_li]:my-0.5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_td]:align-top [&_.sop-editable-image--selected]:outline [&_.sop-editable-image--selected]:outline-2 [&_.sop-editable-image--selected]:outline-blue-500 [&_.sop-editable-image--selected]:outline-offset-2 ${readOnly ? 'cursor-default select-text bg-slate-50/50' : 'focus:outline-none'}`}
        style={{ 
          height: autoHeight && readOnly ? 'auto' : `${currentHeight}px`,
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
          lineHeight: '1.6',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          whiteSpace: 'normal'
        }}
        data-placeholder={effectivePlaceholder}
      />
      </div>
      
      {/* 사이즈 조정 핸들 */}
      {effectiveResize && (
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          className="w-full h-4 bg-gray-200 hover:bg-gray-300 cursor-ns-resize flex items-center justify-center group transition-colors border-t border-gray-300 relative flex-shrink-0"
          style={{ 
            cursor: 'ns-resize',
            userSelect: 'none',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
        >
          <div className="w-16 h-1 bg-gray-500 group-hover:bg-gray-600 rounded transition-colors"></div>
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            드래그하여 크기 조정
          </div>
        </div>
      )}
      
      {/* 숨겨진 파일 입력 */}
      {enableImageUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      )}
    </div>
  )
}

export default LightRichEditor
