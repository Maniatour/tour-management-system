'use client'

/**
 * Isolated HTML print for admin modals.
 *
 * Chrome's print dialog (especially destination "Save as PDF") shows
 * "Saving..." while it rasterizes the source document. Destroying that
 * document too early — `window.close()`, removing a 0×0 iframe, or a 100ms
 * cleanup timer — leaves the dialog stuck. Keep the iframe alive until
 * `afterprint`.
 */

const PRINT_IFRAME_CSS =
  'position:fixed;left:-10000px;top:0;width:816px;height:1056px;border:0;opacity:0;pointer-events:none;'

/** Keep the print document alive while the user is still in the dialog. */
const CLEANUP_FALLBACK_MS = 5 * 60 * 1000

export function createOffscreenPrintIframe(title = 'Print'): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', title)
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = PRINT_IFRAME_CSS
  document.body.appendChild(iframe)
  return iframe
}

export function removePrintIframe(iframe: HTMLIFrameElement): void {
  try {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  } catch {
    /* ignore */
  }
}

function parentStylesheetMarkup(): string {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .filter((link) => {
      const href = link.href || ''
      if (!href) return false
      return !/fonts\.googleapis|fonts\.gstatic/.test(href)
    })
    .map((link) => link.outerHTML)
    .join('')
  const styles = Array.from(document.querySelectorAll('head style'))
    .map((el) => el.outerHTML)
    .join('')
  return `${links}${styles}`
}

/**
 * Call `print()` and only tear down the source after the dialog closes.
 * Chromium may return a Promise from `print()`; rejection is ignorable.
 */
export function runPrintAndKeepAlive(win: Window, cleanup: () => void): void {
  let cleaned = false
  let printed = false
  const once = () => {
    if (cleaned) return
    cleaned = true
    cleanup()
  }

  win.addEventListener('afterprint', once, { once: true })
  window.setTimeout(once, CLEANUP_FALLBACK_MS)

  window.setTimeout(() => {
    if (printed) return
    printed = true
    try {
      win.focus()
    } catch {
      /* ignore */
    }
    try {
      const ret = win.print() as void | Promise<void>
      if (ret != null && typeof (ret as Promise<void>).then === 'function') {
        void (ret as Promise<void>).catch(() => {
          /* Chromium: print preview invalidated */
        })
      }
    } catch {
      once()
    }
  }, 50)
}

function startPrintWhenReady(iframe: HTMLIFrameElement, win: Window, doc: Document): void {
  let started = false
  const start = () => {
    if (started) return
    started = true
    runPrintAndKeepAlive(win, () => removePrintIframe(iframe))
  }
  if (doc.readyState === 'complete') {
    requestAnimationFrame(() => requestAnimationFrame(start))
  } else {
    iframe.addEventListener('load', start, { once: true })
  }
}

/** Print a full HTML document in an off-screen iframe (no popup, no early close). */
export function printHtmlDocument(html: string, title = 'Print'): void {
  const iframe = createOffscreenPrintIframe(title)
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    removePrintIframe(iframe)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const win = iframe.contentWindow
  if (!win) {
    removePrintIframe(iframe)
    return
  }

  startPrintWhenReady(iframe, win, doc)
}

export type PrintDomCloneOptions = {
  title?: string
  extraCss?: string
  extraHead?: string
  copyParentStylesheets?: boolean
  prepareClone?: (clone: HTMLElement) => void
}

/** Clone a live element into an isolated print iframe. */
export function printDomClone(root: HTMLElement, options?: PrintDomCloneOptions): void {
  const title = options?.title || document.title || 'Print'
  const clone = root.cloneNode(true) as HTMLElement
  options?.prepareClone?.(clone)

  const headBits = [
    options?.copyParentStylesheets ? parentStylesheetMarkup() : '',
    options?.extraHead || '',
    options?.extraCss
      ? `<style>${options.extraCss}</style>`
      : '',
  ].join('')

  printHtmlDocument(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtmlTitle(title)}</title>${headBits}</head><body>${clone.outerHTML}</body></html>`,
    title
  )
}

function escapeHtmlTitle(title: string): string {
  return title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}
