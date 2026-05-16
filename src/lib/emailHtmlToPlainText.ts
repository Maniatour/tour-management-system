/**
 * 이메일 HTML 미리보기 → 읽기 쉬운 평문 변환 (클라이언트 전용, document 사용)
 */
export function emailHtmlToPlainText(html: string): string {
  if (typeof document === 'undefined') {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|h[1-6]|li|tr|td|th)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  const NL = '{{NL}}'
  let processed = html
  const blockTags = [
    'div',
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'tr',
    'td',
    'th',
    'section',
    'article',
    'header',
    'footer',
  ]
  for (const tag of blockTags) {
    processed = processed.replace(new RegExp(`</${tag}>`, 'gi'), `</${tag}>${NL}`)
  }
  processed = processed.replace(/<br\s*\/?>/gi, NL)

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = processed
  tempDiv.querySelectorAll('script, style').forEach((el) => el.remove())
  tempDiv.querySelectorAll('a').forEach((link) => {
    const linkText = link.textContent?.trim() || ''
    const linkUrl = link.getAttribute('href') || ''
    const replacement = linkUrl
      ? linkText
        ? `${linkText} (${linkUrl})`
        : linkUrl
      : linkText
    link.parentNode?.replaceChild(document.createTextNode(replacement), link)
  })
  tempDiv.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || ''
    const alt = img.getAttribute('alt')?.trim()
    const line = src && !src.startsWith('data:') ? (alt ? `${alt} (${src})` : src) : alt
    if (line) {
      img.replaceWith(document.createTextNode(`\n${line}\n`))
    } else {
      img.remove()
    }
  })

  let text = tempDiv.textContent || ''
  text = text.replace(/\{\{NL\}\}/g, '\n')
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{4,}/g, '\n\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}
