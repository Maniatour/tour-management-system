/** 미리보기 복사·표시용: 관리자 편집 마커 제거 */
export function stripAdminPreviewMarkupFromEmailHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('[data-email-preview-admin-only]').forEach((el) => el.remove())
    doc.querySelectorAll('button[data-pd-field]').forEach((el) => el.remove())
    doc.querySelectorAll('[data-pd-field]').forEach((el) => {
      el.removeAttribute('data-pd-field')
      const st = el.getAttribute('style')
      if (st) {
        const cleaned = st
          .replace(/cursor\s*:\s*pointer\s*;?/gi, '')
          .replace(/;\s*;/g, ';')
          .replace(/^\s*;\s*|\s*;\s*$/g, '')
          .trim()
        if (cleaned) el.setAttribute('style', cleaned)
        else el.removeAttribute('style')
      }
    })
    doc.querySelectorAll('.email-preview-product-details').forEach((el) => {
      el.classList.remove('email-preview-product-details')
    })
    const doctypeMatch = html.match(/<!DOCTYPE[\s\S]*?>/i)
    const doctype = doctypeMatch ? doctypeMatch[0] : '<!DOCTYPE html>'
    return `${doctype}\n${doc.documentElement.outerHTML}`
  } catch {
    return html
  }
}
