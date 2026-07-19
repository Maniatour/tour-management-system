import { createClient } from '@supabase/supabase-js'
import { resolveMessageNamespaces } from './messageNamespaces'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

type DbTranslationRow = {
  locale: string
  value: unknown
  translations:
    | { namespace: string; key_path: string }
    | { namespace: string; key_path: string }[]
    | null
}

type MessagesRecord = Record<string, unknown>

type MessagesCacheEntry = {
  messages: MessagesRecord
  expiresAt: number
}

const messagesCache = new Map<string, MessagesCacheEntry>()

function shouldSkipDbTranslations(): boolean {
  return (
    process.env.I18N_SKIP_DB_TRANSLATIONS === '1' ||
    process.env.I18N_SKIP_DB_TRANSLATIONS === 'true'
  )
}

function getCacheTtlMs(): number {
  const configured = Number(process.env.I18N_DB_TRANSLATIONS_CACHE_TTL_MS)
  if (configured > 0) return configured
  return process.env.NODE_ENV === 'development' ? 60_000 : 300_000
}

function getFailureCacheTtlMs(): number {
  const configured = Number(process.env.I18N_DB_TRANSLATIONS_FAILURE_CACHE_TTL_MS)
  if (configured > 0) return configured
  return 30_000
}

function getDbTimeoutMs(): number {
  const configured = Number(process.env.I18N_DB_TRANSLATIONS_TIMEOUT_MS)
  if (configured > 0) return configured
  return process.env.NODE_ENV === 'development' ? 2_000 : 5_000
}

/** DB에 인코딩 깨짐 등으로 `?` 위주 문자열만 들어온 경우 파일 번역을 유지 */
function shouldKeepFileStringInsteadOfDb(fileValue: unknown, dbValue: unknown): boolean {
  if (typeof fileValue !== 'string' || typeof dbValue !== 'string') return false
  if (!dbValue.includes('?')) return false
  const fileHasLetters = /\p{L}/u.test(fileValue)
  const dbLetters = dbValue.replace(/[^\p{L}]/gu, '')
  const dbLooksCorrupted = dbLetters.length === 0 || /^[?]+$/u.test(dbLetters)
  return fileHasLetters && dbLooksCorrupted
}

function isPlainMessageObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function restoreMissingMessageKeysFromFile(fileBranch: unknown, dbBranch: unknown): unknown {
  if (!isPlainMessageObject(fileBranch)) return dbBranch
  if (!isPlainMessageObject(dbBranch)) return structuredClone(fileBranch)
  const out: Record<string, unknown> = { ...dbBranch }
  for (const key of Object.keys(fileBranch)) {
    const f = fileBranch[key]
    const d = out[key]
    if (!(key in out) || d === undefined || d === null) {
      out[key] = isPlainMessageObject(f) ? structuredClone(f) : f
    } else if (isPlainMessageObject(f) && isPlainMessageObject(d)) {
      out[key] = restoreMissingMessageKeysFromFile(f, d)
    } else if (isPlainMessageObject(f) && !isPlainMessageObject(d)) {
      out[key] = structuredClone(f)
    }
  }
  return out
}

function normalizeDbTranslationRow(row: DbTranslationRow): { namespace: string; key_path: string } | null {
  const trans = row.translations
  if (!trans) return null
  if (Array.isArray(trans)) return trans[0] ?? null
  return trans
}

function mergeDbTranslations(fileMessages: MessagesRecord, dbTranslations: DbTranslationRow[]): MessagesRecord {
  const dbMessages = structuredClone(fileMessages)

  for (const dbTrans of dbTranslations) {
    const trans = normalizeDbTranslationRow(dbTrans)
    if (!trans?.namespace || !trans.key_path) continue

    if (!dbMessages[trans.namespace]) {
      dbMessages[trans.namespace] = {}
    }

    const keys = trans.key_path.split('.')
    let current = dbMessages[trans.namespace] as Record<string, unknown>

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }
      current = current[keys[i]] as Record<string, unknown>
    }

    const leafKey = keys[keys.length - 1]
    const existing = current[leafKey]
    const incoming = dbTrans.value
    if (
      typeof incoming === 'string' &&
      incoming.trim() === '' &&
      typeof existing === 'string' &&
      existing.length > 0
    ) {
      continue
    }
    if (shouldKeepFileStringInsteadOfDb(existing, incoming)) {
      continue
    }
    // Never replace a nested message tree with a scalar (keeps file children).
    if (isPlainMessageObject(existing) && !isPlainMessageObject(incoming)) {
      continue
    }
    // Deep-merge objects so DB partial branches cannot drop new file keys.
    if (isPlainMessageObject(existing) && isPlainMessageObject(incoming)) {
      current[leafKey] = restoreMissingMessageKeysFromFile(existing, incoming)
      continue
    }
    current[leafKey] = incoming
  }

  const mergedRoot = dbMessages
  for (const ns of Object.keys(fileMessages)) {
    mergedRoot[ns] = restoreMissingMessageKeysFromFile(fileMessages[ns], mergedRoot[ns])
  }

  return mergedRoot
}

async function fetchDbTranslations(locale: string): Promise<DbTranslationRow[] | null> {
  const timeoutMs = getDbTimeoutMs()
  const query = supabase
    .from('translation_values')
    .select(`
      locale,
      value,
      translations!inner(namespace, key_path)
    `)
    .eq('locale', locale)

  const { data, error } = await Promise.race([
    query,
    new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(
        () => resolve({ data: null, error: { message: 'translation_db_timeout' } }),
        timeoutMs
      )
    ),
  ])

  if (error?.message === 'translation_db_timeout') {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[i18n] translation_values query exceeded ${timeoutMs}ms, using file messages only`
      )
    }
    return null
  }

  if (error || !data?.length) {
    return null
  }

  return data as unknown as DbTranslationRow[]
}

function readCachedMessages(locale: string): MessagesRecord | null {
  const cached = messagesCache.get(locale)
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) messagesCache.delete(locale)
    return null
  }
  return cached.messages
}

function writeCachedMessages(locale: string, messages: MessagesRecord, ttlMs: number) {
  messagesCache.set(locale, {
    messages,
    expiresAt: Date.now() + ttlMs,
  })
}

function deepMergeMessages(base: MessagesRecord, overlay: MessagesRecord): MessagesRecord {
  const out: MessagesRecord = { ...base }
  for (const key of Object.keys(overlay)) {
    const baseVal = out[key]
    const overVal = overlay[key]
    if (isPlainMessageObject(baseVal) && isPlainMessageObject(overVal)) {
      out[key] = deepMergeMessages(
        baseVal as MessagesRecord,
        overVal as MessagesRecord
      )
    } else if (overVal !== undefined) {
      out[key] = overVal
    }
  }
  return out
}

async function loadLocaleOverlay(locale: string): Promise<MessagesRecord | null> {
  switch (locale) {
    case 'ja':
      return (await import('./locales/ja.json')).default as MessagesRecord
    case 'zh-CN':
      return (await import('./locales/zh-CN.json')).default as MessagesRecord
    case 'zh-TW':
      return (await import('./locales/zh-TW.json')).default as MessagesRecord
    case 'es':
      return (await import('./locales/es.json')).default as MessagesRecord
    case 'fr':
      return (await import('./locales/fr.json')).default as MessagesRecord
    case 'de':
      return (await import('./locales/de.json')).default as MessagesRecord
    default:
      return null
  }
}

async function loadFileMessages(locale: string): Promise<MessagesRecord> {
  if (locale === 'ko') {
    return (await import('./locales/ko.json')).default as MessagesRecord
  }

  const en = (await import('./locales/en.json')).default as MessagesRecord
  if (locale === 'en') return en

  // Customer UI overlays for ja / zh-CN / zh-TW / es / fr / de.
  // Missing keys fall back to English via deep merge.
  try {
    const overlay = await loadLocaleOverlay(locale)
    if (!overlay) return en
    return deepMergeMessages(en, overlay)
  } catch (error) {
    console.error(`[i18n] Failed to load locale overlay for ${locale}, using en`, error)
    return en
  }
}

export function pickMessageNamespaces(
  messages: MessagesRecord,
  namespaces: readonly string[]
): MessagesRecord {
  const picked: MessagesRecord = {}
  for (const ns of namespaces) {
    if (ns in messages) {
      picked[ns] = messages[ns]
    }
  }
  return picked
}

export async function loadLocaleMessagesForRoute(
  locale: string,
  pathname: string
): Promise<MessagesRecord> {
  const allMessages = await loadLocaleMessages(locale)
  const namespaces = resolveMessageNamespaces(pathname)
  return pickMessageNamespaces(allMessages, namespaces)
}

export async function loadLocaleMessages(locale: string): Promise<MessagesRecord> {
  const cached = readCachedMessages(locale)
  if (cached) return cached

  const fileMessages = await loadFileMessages(locale)

  if (shouldSkipDbTranslations()) {
    writeCachedMessages(locale, fileMessages, getCacheTtlMs())
    return fileMessages
  }

  const dbTranslations = await fetchDbTranslations(locale)
  if (!dbTranslations) {
    writeCachedMessages(locale, fileMessages, getFailureCacheTtlMs())
    return fileMessages
  }

  const mergedMessages = mergeDbTranslations(fileMessages, dbTranslations)
  writeCachedMessages(locale, mergedMessages, getCacheTtlMs())
  return mergedMessages
}

/** 관리 화면 등에서 DB 번역 캐시를 즉시 비우고 싶을 때 */
export function invalidateLocaleMessagesCache(locale?: string) {
  if (locale) {
    messagesCache.delete(locale)
    return
  }
  messagesCache.clear()
}
