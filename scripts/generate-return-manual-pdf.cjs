const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

async function main() {
  const htmlPath = path.resolve(__dirname, '../docs/kovegas-return-manual-2026-08-15.html')
  const pdfPath = path.resolve(__dirname, '../docs/Kovegas-복귀매뉴얼-2026-08-15이후.pdf')
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/')

  if (!fs.existsSync(htmlPath)) {
    throw new Error('HTML not found: ' + htmlPath)
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(fileUrl, { waitUntil: 'networkidle' })
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;font-size:8px;color:#6b7280;font-family:'Malgun Gothic',sans-serif;padding:0 18mm;display:flex;justify-content:space-between;">
        <span>Kovegas 복귀 매뉴얼 · 2026-08-15 이후</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `,
    margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
  })
  await browser.close()
  const stat = fs.statSync(pdfPath)
  console.log('PDF_OK', pdfPath, stat.size)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
