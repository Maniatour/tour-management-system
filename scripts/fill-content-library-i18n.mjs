/**
 * Fill reusable content library translations (FAQ + detail_content) for all SITE_LOCALES.
 * Uses Google translate_a/single?client=gtx with disk cache + resume.
 *
 * node scripts/fill-content-library-i18n.mjs
 * node scripts/fill-content-library-i18n.mjs --details-only
 * node scripts/fill-content-library-i18n.mjs --faqs-only
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })

const TARGETS = ['ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de']
const ALL = ['en', 'ko', ...TARGETS]
const CACHE_PATH = path.join(root, 'tmp-library-gtx-cache.json')
const LOG_PATH = path.join(root, 'tmp-library-fill.log')

const args = new Set(process.argv.slice(2))
const DETAILS_ONLY = args.has('--details-only')
const FAQS_ONLY = args.has('--faqs-only')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const GTX_TL = {
  ja: 'ja',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  es: 'es',
  fr: 'fr',
  de: 'de',
  en: 'en',
  ko: 'ko',
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  fs.appendFileSync(LOG_PATH, line + '\n')
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8')
}

function parseGtx(jsonText) {
  const data = JSON.parse(jsonText)
  if (!Array.isArray(data?.[0])) return ''
  return data[0]
    .map((part) => (Array.isArray(part) ? part[0] : ''))
    .filter(Boolean)
    .join('')
}

function chunkText(text, maxLen = 1500) {
  const s = String(text)
  if (s.length <= maxLen) return [s]
  const parts = []
  let buf = ''
  for (const para of s.split(/(\n+)/)) {
    if ((buf + para).length > maxLen && buf) {
      parts.push(buf)
      buf = para
    } else buf += para
    while (buf.length > maxLen) {
      parts.push(buf.slice(0, maxLen))
      buf = buf.slice(maxLen)
    }
  }
  if (buf) parts.push(buf)
  return parts
}

async function gtxTranslate(text, from, to) {
  if (!text?.trim()) return ''
  if (from === to) return text
  const cache = loadCache()
  const key = `gtx::${from}::${to}::${text}`
  if (cache[key]) return cache[key]

  const chunks = chunkText(text)
  const out = []
  for (const chunk of chunks) {
    let translated = null
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const url =
          'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' +
          encodeURIComponent(GTX_TL[from] || from) +
          '&tl=' +
          encodeURIComponent(GTX_TL[to] || to) +
          '&dt=t&q=' +
          encodeURIComponent(chunk)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        translated = parseGtx(await res.text())
        if (!translated) throw new Error('empty translation')
        break
      } catch (err) {
        const wait = Math.min(45000, 1500 * attempt)
        log(`retry ${attempt} ${from}->${to} wait ${wait}ms ${err.message || err}`)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
    if (!translated) throw new Error(`gtx failed ${from}->${to}`)
    out.push(translated)
    await new Promise((r) => setTimeout(r, 350))
  }

  const result = out.join('')
  cache[key] = result
  saveCache(cache)
  return result
}

async function translateToTargets(sourceText, sourceLang = 'en') {
  const map = { [sourceLang]: sourceText }
  // ensure EN exists
  if (sourceLang !== 'en') {
    map.en = await gtxTranslate(sourceText, sourceLang, 'en')
  }
  for (const locale of TARGETS) {
    if (locale === sourceLang) continue
    map[locale] = await gtxTranslate(map.en || sourceText, 'en', locale)
  }
  if (sourceLang !== 'ko' && !map.ko) {
    // keep existing ko if any; don't invent unless missing later
  }
  return map
}

async function fillDetails() {
  const { data, error } = await sb
    .from('detail_content_library')
    .select('*')
    .eq('is_active', true)
  if (error) throw error

  for (const row of data || []) {
    const body = { ...(row.content_i18n?.body || {}) }
    if (row.body?.trim()) body.ko = body.ko || row.body
    if (row.body_en?.trim()) body.en = body.en || row.body_en

    const missing = TARGETS.filter((l) => !body[l]?.trim())
    if (!missing.length) {
      log(`detail skip ${row.kind} ${row.name}`)
      continue
    }
    const source = body.en?.trim() || body.ko?.trim()
    if (!source) {
      log(`detail empty ${row.id}`)
      continue
    }
    const from = body.en?.trim() ? 'en' : 'ko'
    log(`detail translate ${row.kind} ${row.name} missing=${missing.join(',')}`)
    for (const locale of missing) {
      body[locale] = await gtxTranslate(source, from, locale)
    }
    // if only ko existed, also ensure en
    if (!body.en?.trim() && body.ko?.trim()) {
      body.en = await gtxTranslate(body.ko, 'ko', 'en')
    }

    const content_i18n = { ...(row.content_i18n || {}), body }
    const { error: upErr } = await sb
      .from('detail_content_library')
      .update({
        content_i18n,
        body: body.ko || row.body || '',
        body_en: body.en || row.body_en || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (upErr) throw upErr
    log(`detail saved ${row.id}`)
  }
}

async function fillFaqs() {
  const { data, error } = await sb
    .from('faq_library')
    .select('id,name,question,answer,question_en,answer_en,content_i18n,is_active')
    .eq('is_active', true)
  if (error) throw error

  let done = 0
  let skipped = 0
  for (const row of data || []) {
    const question = { ...(row.content_i18n?.question || {}) }
    const answer = { ...(row.content_i18n?.answer || {}) }
    if (row.question?.trim()) question.ko = question.ko || row.question
    if (row.question_en?.trim()) question.en = question.en || row.question_en
    if (row.answer?.trim()) answer.ko = answer.ko || row.answer
    if (row.answer_en?.trim()) answer.en = answer.en || row.answer_en

    const needQ = ALL.filter((l) => !question[l]?.trim())
    const needA = ALL.filter((l) => !answer[l]?.trim())
    if (!needQ.length && !needA.length) {
      skipped++
      continue
    }

    log(`faq ${row.id.slice(0, 8)} ${row.name?.slice(0, 40) || ''} needQ=${needQ.join(',')} needA=${needA.join(',')}`)

    // Questions
    if (needQ.length) {
      const qSrcLang = question.en?.trim() ? 'en' : question.ko?.trim() ? 'ko' : null
      const qSrc = question.en?.trim() || question.ko?.trim()
      if (qSrc && qSrcLang) {
        if (!question.en?.trim() && qSrcLang === 'ko') {
          question.en = await gtxTranslate(qSrc, 'ko', 'en')
        }
        for (const locale of needQ) {
          if (locale === 'en' && question.en) continue
          if (locale === 'ko' && question.ko) continue
          const from = question.en ? 'en' : qSrcLang
          const text = question.en || qSrc
          question[locale] = await gtxTranslate(text, from, locale)
        }
      }
    }

    // Answers
    if (needA.length) {
      const aSrcLang = answer.en?.trim() ? 'en' : answer.ko?.trim() ? 'ko' : null
      const aSrc = answer.en?.trim() || answer.ko?.trim()
      if (aSrc && aSrcLang) {
        if (!answer.en?.trim() && aSrcLang === 'ko') {
          answer.en = await gtxTranslate(aSrc, 'ko', 'en')
        }
        for (const locale of needA) {
          if (locale === 'en' && answer.en) continue
          if (locale === 'ko' && answer.ko) continue
          const from = answer.en ? 'en' : aSrcLang
          const text = answer.en || aSrc
          answer[locale] = await gtxTranslate(text, from, locale)
        }
      }
    }

    const content_i18n = {
      ...(row.content_i18n || {}),
      question,
      answer,
    }
    const { error: upErr } = await sb
      .from('faq_library')
      .update({
        content_i18n,
        question: question.ko || row.question || '',
        answer: answer.ko || row.answer || '',
        question_en: question.en || row.question_en || null,
        answer_en: answer.en || row.answer_en || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (upErr) throw upErr
    done++
    if (done % 10 === 0) log(`faq progress saved=${done} skipped=${skipped}`)
  }
  log(`faqs done=${done} skipped=${skipped}`)
}

async function main() {
  fs.writeFileSync(LOG_PATH, '')
  log('start')
  if (!FAQS_ONLY) {
    log('filling details…')
    await fillDetails()
  }
  if (!DETAILS_ONLY) {
    log('filling faqs…')
    await fillFaqs()
  }
  log('complete')
}

main().catch((e) => {
  log(String(e?.stack || e))
  process.exit(1)
})
