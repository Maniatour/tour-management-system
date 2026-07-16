/** Server-safe markdown → HTML utilities (shared with LightRichEditor). */

const SOPIMG_IMAGE_MD_RE = /\[\[sopimg:([^\]]+)\]\]!\[([^\]]*)\]\(([^)]+)\)/g

const DEFAULT_IMG_STYLE =
  'max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; display: block;'

function isSafeSopImageWidthToken(width: string): boolean {
  const w = width.trim()
  if (!w || w.length > 16) return false
  return /^[0-9.]+\s*(px|%)?$/i.test(w)
}

function buildSopImageHtml(
  src: string,
  alt: string,
  width?: string | null,
  editable = false
): string {
  const safeAlt = alt.replace(/"/g, '&quot;')
  const cursor = editable ? ' cursor: pointer;' : ''
  if (width && isSafeSopImageWidthToken(width)) {
    const w = width.trim()
    return `<img src="${src}" alt="${safeAlt}" data-sop-img="1" class="sop-editable-image" style="width: ${w}; max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; display: block;${cursor}" />`
  }
  return `<img src="${src}" alt="${safeAlt}" data-sop-img="1" class="sop-editable-image" style="${DEFAULT_IMG_STYLE}${cursor}" />`
}

function decodeSopImageWidthTokens(markdown: string, editable = false): string {
  return markdown.replace(SOPIMG_IMAGE_MD_RE, (_full, width: string, alt: string, src: string) => {
    if (!isSafeSopImageWidthToken(width)) {
      return buildSopImageHtml(src, alt, null, editable)
    }
    return buildSopImageHtml(src, alt, width, editable)
  })
}

function stripSopImageWidthTokens(markdown: string): string {
  return markdown.replace(
    SOPIMG_IMAGE_MD_RE,
    (_full, _w: string, alt: string, src: string) => `![${alt}](${src})`
  )
}

function isSafeSopFontSizeToken(size: string): boolean {
  const s = size.trim()
  if (!s || s.length > 24) return false
  return /^[0-9.]+\s*(px|pt|rem|em|%)?$/i.test(s)
}

const SOPFS_INNER_RE = /\[\[sopfs:([^\]]+)\]\]((?:(?!\[\[sopfs:)[\s\S])*?)\[\[\/sopfs\]\]/

function decodeSopFontSizeTokens(markdown: string): string {
  let out = markdown
  for (let g = 0; g < 100; g++) {
    const m = out.match(SOPFS_INNER_RE)
    if (!m) break
    const size = m[1]
    const inner = m[2]
    if (!isSafeSopFontSizeToken(size)) {
      out = out.replace(m[0], inner)
      continue
    }
    const safe = size.trim()
    out = out.replace(
      m[0],
      `<span style="font-size: ${safe}">${String(inner).replace(/\n/g, '<br>')}</span>`
    )
  }
  return out
}

function decodeSopUnderlineTokens(markdown: string): string {
  return markdown.replace(/\[\[sopu\]\]([\s\S]*?)\[\[\/sopu\]\]/g, (_m, inner: string) => {
    return `<u>${String(inner).replace(/\n/g, '<br>')}</u>`
  })
}

function stripSopUnderlineTokens(markdown: string): string {
  return markdown.replace(/\[\[sopu\]\]([\s\S]*?)\[\[\/sopu\]\]/g, '$1')
}

export function stripSopFontSizeTokens(markdown: string): string {
  let out = markdown ?? ''
  for (let g = 0; g < 100; g++) {
    const m = out.match(SOPFS_INNER_RE)
    if (!m) break
    out = out.replace(m[0], m[2])
  }
  return out
}

export function sopPlainDisplayText(raw: string): string {
  let t = stripSopFontSizeTokens(raw ?? '')
  t = stripSopUnderlineTokens(t)
  t = stripSopImageWidthTokens(t)
  // 짝이 깨진 토큰·잔여 마커 제거
  t = t.replace(/\[\[sopfs:[^\]]*\]\]/gi, '')
  t = t.replace(/\[\[\/sopfs\]\]/gi, '')
  t = t.replace(/\[\[sopu\]\]/gi, '')
  t = t.replace(/\[\[\/sopu\]\]/gi, '')
  t = t.replace(/\[\[sopimg:[^\]]*\]\]/gi, '')
  t = t.replace(/<[^>]+>/g, ' ')
  t = t.replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1')
  t = t.replace(/\*([^*]+)\*/g, '$1')
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  t = t.replace(/^#+\s*/gm, '')
  t = t.replace(/&nbsp;/g, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

function parseMarkdownTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isMarkdownTableSeparatorLine(line: string): boolean {
  const cells = parseMarkdownTableCells(line)
  if (cells.length < 2) return false
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
}

function isMarkdownTableRowLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return false
  const cells = parseMarkdownTableCells(trimmed)
  return cells.length >= 2 && cells.some((cell) => cell.length > 0)
}

const TABLE_WRAPPER_STYLE =
  'overflow-x: auto; margin: 1rem 0; border: 1px solid #e2e8f0; border-radius: 0.75rem;'
const TABLE_STYLE = 'width: 100%; border-collapse: collapse; font-size: 0.875rem; line-height: 1.5;'
const TABLE_TH_STYLE =
  'border: 1px solid #e2e8f0; padding: 0.55rem 0.75rem; text-align: left; font-weight: 600; background: #f8fafc; color: #0f172a;'
const TABLE_TD_STYLE =
  'border: 1px solid #e2e8f0; padding: 0.55rem 0.75rem; vertical-align: top; color: #334155;'
const TABLE_TR_STYLE = 'border-bottom: 1px solid #e2e8f0;'

function renderMarkdownTableHtml(lines: string[]): string {
  const dataRows = lines
    .filter((line) => isMarkdownTableRowLine(line) && !isMarkdownTableSeparatorLine(line))
    .map(parseMarkdownTableCells)
    .filter((cells) => cells.length >= 2)

  if (dataRows.length < 1) return ''

  const [headerCells, ...bodyRows] = dataRows
  const headerHtml = headerCells
    .map((cell) => `<th style="${TABLE_TH_STYLE}">${cell}</th>`)
    .join('')

  const bodyHtml = bodyRows
    .map((cells) => {
      const tds = cells.map((cell) => `<td style="${TABLE_TD_STYLE}">${cell}</td>`).join('')
      return `<tr style="${TABLE_TR_STYLE}">${tds}</tr>`
    })
    .join('')

  return `<div class="sop-editable-table-wrap" data-sop-table-wrap="1" style="${TABLE_WRAPPER_STYLE}"><table class="sop-editable-table" data-sop-table="1" style="${TABLE_STYLE}"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
}

function renderMarkdownHeadingHtml(line: string): string | null {
  const match = line.trim().match(/^(#{1,6})\s+(.+)$/)
  if (!match) return null
  const level = match[1]!.length
  // 헤딩 자체에 font-weight:700 — 전체를 감싼 bold는 중복이라 풀어줌
  let text = match[2]!.trim()
  text = text.replace(/^\*\*([^*\n]+)\*\*$/, '$1')
  text = text.replace(/^<strong>([\s\S]+)<\/strong>$/i, '$1')
  const styles: Record<number, string> = {
    1: 'margin: 1.25em 0 0.5em; font-size: 1.35rem; font-weight: 700; color: #0f172a;',
    2: 'margin: 1.1em 0 0.45em; font-size: 1.2rem; font-weight: 700; color: #0f172a;',
    3: 'margin: 1em 0 0.4em; font-size: 1.05rem; font-weight: 700; color: #1e293b;',
    4: 'margin: 0.85em 0 0.35em; font-size: 1rem; font-weight: 600; color: #1e293b;',
    5: 'margin: 0.75em 0 0.3em; font-size: 0.95rem; font-weight: 600; color: #334155;',
    6: 'margin: 0.65em 0 0.25em; font-size: 0.9rem; font-weight: 600; color: #334155;',
  }
  return `<h${level} style="${styles[level] ?? styles[3]}">${text}</h${level}>`
}

/**
 * 깨진/고아 ** 마커를 줄 단위로 정리.
 * (이전 구현은 직전 80자에 다른 줄 **까지 합산해 닫는 **을 지워 버리고,
 * 이어지는 본문 전체가 볼드가 되는 버그가 있었음)
 */
export function sanitizeMarkdownBoldMarkers(markdown: string): string {
  let s = (markdown ?? '').replace(/\r\n/g, '\n')
  if (!s) return s

  // 빈 볼드 런 (****, ******) 제거
  s = s.replace(/\*{4,}/g, '')
  s = s.replace(/\*\*[ \t]*\*\*/g, '')

  s = s
    .split('\n')
    .map((line) => {
      let t = line
      if (/^\s*\*\*\s*$/.test(t)) return ''

      // 이 줄에서 ** 개수가 홀수면 마지막 고아 마커만 제거
      const markers = t.match(/\*\*/g)
      if (markers && markers.length % 2 === 1) {
        const idx = t.lastIndexOf('**')
        if (idx >= 0) t = `${t.slice(0, idx)}${t.slice(idx + 2)}`
      }

      // 헤딩은 CSS로 이미 bold → 전체를 감싼 **는 중복이므로 제거
      t = t.replace(/^(#{1,6}\s+)\*\*([^*\n]+)\*\*\s*$/, '$1$2')
      // 헤딩 끝이 공백만인 bold 껍데기 (`### ** **`) 제거
      t = t.replace(/^(#{1,6}\s+)\*\*\s*\*\*\s*$/, '$1')
      return t
    })
    .join('\n')

  return s
}

/**
 * ChatGPT 등에서 붙여넣은 마크다운이 한 줄로 뭉개졌을 때
 * 제목·목록 경계를 복구해 렌더/에디터 왕복이 맞게 함.
 */
export function normalizeMarkdownBlockStructure(markdown: string): string {
  let s = (markdown ?? '').replace(/\r\n/g, '\n')
  if (!s.trim()) return s

  // 중복 헤딩 마커 (`## ## Quick Summary` → `## Quick Summary`)
  s = s.replace(/(#{1,6})\s+(#{1,6})\s+/g, (_m, a: string, b: string) =>
    `${b.length >= a.length ? b : a} `
  )

  // 문장 중간에 붙은 헤딩 마커를 새 블록으로
  s = s.replace(/([^\n#])[ \t]*(#{1,6})[ \t]+(?=\S)/g, '$1\n\n$2 ')

  // 줄바꿈만으로 이어진 헤딩 앞에 빈 줄 보장
  s = s.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2')

  s = sanitizeMarkdownBoldMarkers(s)

  // `### Title - a - b - c` 형태를 제목 + 목록으로 복구
  s = s
    .split('\n')
    .map((line) => {
      const hm = line.match(/^(#{1,6}\s+)(.+)$/)
      if (!hm) return line
      const rest = hm[2]!.trim()
      const parts = rest.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean)
      if (parts.length < 3) return line
      const [title, ...items] = parts
      return `${hm[1]}${title}\n\n${items.map((item) => `- ${item}`).join('\n')}`
    })
    .join('\n')

  s = s.replace(/\n{3,}/g, '\n\n')
  return s.replace(/^\n+/, '').replace(/\n+$/, '')
}

export const markdownToHtml = (
  markdown: string,
  options?: { editableImages?: boolean }
): string => {
  if (!markdown) return ''

  let html = normalizeMarkdownBlockStructure(markdown)
  html = decodeSopFontSizeTokens(html)
  html = decodeSopUnderlineTokens(html)
  html = decodeSopImageWidthTokens(html, options?.editableImages ?? false)

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) =>
    buildSopImageHtml(src, alt, null, options?.editableImages ?? false)
  )

  html = html.replace(
    /`([^`]+)`/g,
    '<code style="padding: 0.1em 0.35em; border-radius: 0.25rem; background: #f1f5f9; font-size: 0.875em; color: #0f172a;">$1</code>'
  )

  // bold/italic — 같은 줄 안에서만 매칭
  // (여러 줄 [\s\S] 매칭은 닫히지 않은 ** 때문에 본문 전체가 볼드가 되는 사고 원인)
  html = html.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  // 변환 후 남은 고아 ** 제거
  html = html.replace(/\*\*/g, '')
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">$1</a>'
  )

  html = html.replace(/\n\n+/g, '\n\n')
  const paragraphs = html.split(/\n\n/)

  const listLineRe = /^(\s*)([-*•]|\d+\.)\s+(.+)$/

  const renderBulletList = (nonEmpty: string[]): string => {
    const lis = nonEmpty
      .map((line) => {
        const m = line.trim().match(/^(\s*)([-*•])\s+(.+)$/)
        return m ? `<li style="margin: 0.15em 0;">${m[3]}</li>` : ''
      })
      .filter(Boolean)
    if (!lis.length) return ''
    return `<ul style="margin: 0.5em 0; padding-left: 1.5em; list-style-type: disc;">${lis.join('')}</ul>`
  }

  // 카테고리형(항목 1개) 숫자 목록이 문단마다 끊겨도 문서 전체에서 번호가 이어지게 함
  let nextOrderedNumber = 1

  const renderOrderedList = (nonEmpty: string[]): string => {
    const items: { num: number; body: string }[] = []
    for (const line of nonEmpty) {
      const m = line.trim().match(/^(\d+)\.\s+(.+)$/)
      if (m) items.push({ num: parseInt(m[1], 10), body: m[2]! })
    }
    if (!items.length) return ''

    let start = items[0]!.num >= 1 ? items[0]!.num : 1
    // 저장본이 모두 "1."로 남은 단일 카테고리 → 이전 번호 이어서 표시
    if (items.length === 1 && start === 1 && nextOrderedNumber > 1) {
      start = nextOrderedNumber
    } else if (items.length > 1) {
      // 여러 항목 목록은 마크다운 시작 번호(보통 1)로 재시작 허용
      start = items[0]!.num >= 1 ? items[0]!.num : 1
    } else if (start === 1) {
      start = nextOrderedNumber
    }

    const lis = items.map((it) => `<li style="margin: 0.15em 0;">${it.body}</li>`)
    const startAttr = start > 1 ? ` start="${start}"` : ''
    nextOrderedNumber = start + items.length
    return `<ol${startAttr} style="margin: 0.5em 0; padding-left: 1.5em; list-style-type: decimal;">${lis.join('')}</ol>`
  }

  const pStyle = 'margin-bottom: 1em; line-height: 1.6;'

  const renderMixedMarkdownBlock = (paragraph: string): string => {
    const lines = paragraph.split('\n')
    const chunks: string[] = []
    let i = 0

    const isListLine = (line: string) => listLineRe.test(line.trim())
    const isNumberedLine = (line: string) => /^\d+\.\s+/.test(line.trim())
    const isBulletLine = (line: string) => /^(\s*)([-*•])\s+/.test(line.trim())
    const isHeadingLine = (line: string) => /^(#{1,6})\s+\S/.test(line.trim())

    while (i < lines.length) {
      const trimmed = lines[i]?.trim() ?? ''
      if (!trimmed) {
        i += 1
        continue
      }

      const headingHtml = renderMarkdownHeadingHtml(trimmed)
      if (headingHtml) {
        chunks.push(headingHtml)
        i += 1
        continue
      }

      if (isMarkdownTableRowLine(trimmed)) {
        const collected: string[] = []
        while (i < lines.length) {
          const t = lines[i]?.trim() ?? ''
          if (!t) break
          if (!isMarkdownTableRowLine(t) && !isMarkdownTableSeparatorLine(t)) break
          collected.push(t)
          i += 1
        }
        const tableHtml = renderMarkdownTableHtml(collected)
        if (tableHtml) {
          chunks.push(tableHtml)
        } else {
          chunks.push(`<p style="${pStyle}">${collected.join('<br>')}</p>`)
        }
        continue
      }

      if (isListLine(trimmed)) {
        const collected: string[] = []
        while (i < lines.length) {
          const t = lines[i]?.trim() ?? ''
          if (!t || !isListLine(t)) break
          collected.push(t)
          i += 1
        }
        // 1줄 목록도 목록으로 렌더 (저장 후 하이픈이 문장부호처럼 남는 왕복 불일치 방지)
        if (collected.every(isNumberedLine)) {
          chunks.push(renderOrderedList(collected))
        } else if (collected.every(isBulletLine)) {
          chunks.push(renderBulletList(collected))
        } else {
          const lis = collected
            .map((line) => {
              const num = line.match(/^(\d+)\.\s+(.+)$/)
              if (num) return `<li style="margin: 0.15em 0;">${num[2]}</li>`
              const bu = line.match(/^(\s*)([-*•])\s+(.+)$/)
              return bu ? `<li style="margin: 0.15em 0;">${bu[3]}</li>` : ''
            })
            .filter(Boolean)
          if (lis.length) {
            chunks.push(
              `<ul style="margin: 0.5em 0; padding-left: 1.5em; list-style-type: disc;">${lis.join('')}</ul>`
            )
          }
        }
      } else {
        const textLines: string[] = []
        while (i < lines.length) {
          const raw = lines[i] ?? ''
          const t = raw.trim()
          if (!t) break
          if (isListLine(t) || isHeadingLine(t) || isMarkdownTableRowLine(t)) break
          textLines.push(raw)
          i += 1
        }
        if (textLines.length) {
          const p = textLines.join('\n').replace(/\n/g, '<br>')
          if (
            p.trim().startsWith('<p') ||
            p.trim().startsWith('<div') ||
            p.trim().startsWith('<ul') ||
            p.trim().startsWith('<ol')
          ) {
            chunks.push(p)
          } else {
            chunks.push(`<p style="${pStyle}">${p}</p>`)
          }
        }
      }
    }

    return chunks.join('')
  }

  html = paragraphs
    .map((paragraph) => {
      if (!paragraph.trim()) return ''
      return renderMixedMarkdownBlock(paragraph)
    })
    .filter(Boolean)
    .join('')

  return html
}

export function markdownToHeadingHtml(markdown: string): string {
  const html = markdownToHtml(markdown)
  const trimmed = html.trim()
  const wrapped = /^<p[^>]*>([\s\S]*)<\/p>$/i.exec(trimmed)
  return wrapped ? wrapped[1]! : trimmed
}
