/**
 * Generate customer UI locale overlays from en customer namespaces.
 * Uses Google Translate public endpoint (no API key).
 *
 * Usage: node scripts/generate-customer-locale-overlays.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sourcePath = path.join(root, 'src/i18n/locales/overlays/_en-customer.json')
const outDir = path.join(root, 'src/i18n/locales')

const TARGETS = [
  { locale: 'ja', tl: 'ja' },
  { locale: 'zh-CN', tl: 'zh-CN' },
  { locale: 'zh-TW', tl: 'zh-TW' },
  { locale: 'es', tl: 'es' },
  { locale: 'fr', tl: 'fr' },
  { locale: 'de', tl: 'de' },
]

function flatten(obj, prefix = '', out = []) {
  if (typeof obj === 'string') {
    out.push({ path: prefix, value: obj })
    return out
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k
    flatten(v, next, out)
  }
  return out
}

function unflatten(entries) {
  const rootObj = {}
  for (const { path: p, value } of entries) {
    const keys = p.split('.')
    let cur = rootObj
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {}
      cur = cur[keys[i]]
    }
    cur[keys[keys.length - 1]] = value
  }
  return rootObj
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function translateText(text, tl) {
  if (!text.trim()) return text
  // Keep ICU / next-intl placeholders intact by shielding {var} patterns
  const shields = []
  const shielded = text.replace(/\{[^}]+\}/g, (m) => {
    const token = `__PH_${shields.length}__`
    shields.push(m)
    return token
  })

  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'en')
  url.searchParams.set('tl', tl)
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', shielded)

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Translate HTTP ${res.status} for tl=${tl}`)
  }
  const data = await res.json()
  const translated = Array.isArray(data?.[0])
    ? data[0].map((chunk) => chunk?.[0] ?? '').join('')
    : shielded

  return translated.replace(/__PH_(\d+)__/g, (_, i) => shields[Number(i)] ?? _)
}

async function translateBatch(entries, tl, concurrency = 4) {
  const result = new Array(entries.length)
  let index = 0
  let done = 0

  async function worker() {
    while (index < entries.length) {
      const i = index++
      const entry = entries[i]
      let attempts = 0
      while (true) {
        try {
          result[i] = {
            path: entry.path,
            value: await translateText(entry.value, tl),
          }
          break
        } catch (err) {
          attempts++
          if (attempts >= 4) throw err
          await sleep(400 * attempts)
        }
      }
      done++
      if (done % 80 === 0 || done === entries.length) {
        process.stdout.write(`  ${tl}: ${done}/${entries.length}\n`)
      }
      await sleep(40)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return result
}

async function main() {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
  const entries = flatten(source)
  console.log(`Source strings: ${entries.length}`)

  for (const { locale, tl } of TARGETS) {
    console.log(`\nTranslating → ${locale} (${tl})`)
    const translated = await translateBatch(entries, tl)
    const tree = unflatten(translated)
    const outPath = path.join(outDir, `${locale}.json`)
    fs.writeFileSync(outPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${outPath}`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
