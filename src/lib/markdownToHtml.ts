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
    out = out.replace(m[0], `<span style="font-size: ${safe}">${inner}</span>`)
  }
  return out
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
  t = stripSopImageWidthTokens(t)
  t = t.replace(/<[^>]+>/g, ' ')
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

  return `<div style="${TABLE_WRAPPER_STYLE}"><table style="${TABLE_STYLE}"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
}

function renderMarkdownHeadingHtml(line: string): string | null {
  const match = line.trim().match(/^(#{1,6})\s+(.+)$/)
  if (!match) return null
  const level = match[1]!.length
  const text = match[2]!.trim()
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

export const markdownToHtml = (
  markdown: string,
  options?: { editableImages?: boolean }
): string => {
  if (!markdown) return ''

  let html = markdown.replace(/\r\n/g, '\n')
  html = decodeSopFontSizeTokens(html)
  html = decodeSopImageWidthTokens(html, options?.editableImages ?? false)

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) =>
    buildSopImageHtml(src, alt, null, options?.editableImages ?? false)
  )

  html = html.replace(
    /`([^`]+)`/g,
    '<code style="padding: 0.1em 0.35em; border-radius: 0.25rem; background: #f1f5f9; font-size: 0.875em; color: #0f172a;">$1</code>'
  )

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
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

  const renderOrderedList = (nonEmpty: string[]): string => {
    const lis = nonEmpty
      .map((line) => {
        const m = line.trim().match(/^(\d+)\.\s+(.+)$/)
        return m ? `<li style="margin: 0.15em 0;">${m[2]}</li>` : ''
      })
      .filter(Boolean)
    if (!lis.length) return ''
    return `<ol style="margin: 0.5em 0; padding-left: 1.5em; list-style-type: decimal;">${lis.join('')}</ol>`
  }

  const pStyle = 'margin-bottom: 1em; line-height: 1.6;'

  const renderMixedMarkdownBlock = (paragraph: string): string => {
    const lines = paragraph.split('\n')
    const chunks: string[] = []
    let i = 0

    const isListLine = (line: string) => listLineRe.test(line.trim())
    const isNumberedLine = (line: string) => /^\d+\.\s+/.test(line.trim())
    const isBulletLine = (line: string) => /^(\s*)([-*•])\s+/.test(line.trim())

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
        if (collected.length > 1) {
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
          chunks.push(`<p style="${pStyle}">${collected[0] ?? ''}</p>`)
        }
      } else {
        const textLines: string[] = []
        while (i < lines.length) {
          const raw = lines[i] ?? ''
          const t = raw.trim()
          if (!t) break
          if (isListLine(t)) break
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
