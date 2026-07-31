'use client'

import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'
import { isAdminSmsDbTemplateKey } from '@/lib/adminSmsTemplateCatalog'
import { getBuiltinAdminSmsLocaleTemplate } from '@/lib/adminSmsBuiltinTemplates'

export type AdminSmsLocaleTemplateSnapshot = {
  body_template: string
  saved_in_db: boolean
}

const cache = new Map<string, AdminSmsLocaleTemplateSnapshot>()
const inflight = new Map<string, Promise<AdminSmsLocaleTemplateSnapshot>>()

function cacheKey(categoryId: AdminSmsCategoryId, locale: string) {
  return `${categoryId}:${locale}`
}

function fallbackSnapshot(
  categoryId: AdminSmsCategoryId,
  locale: string
): AdminSmsLocaleTemplateSnapshot {
  return {
    body_template: getBuiltinAdminSmsLocaleTemplate(categoryId, locale),
    saved_in_db: false,
  }
}

async function fetchFromApi(
  categoryId: AdminSmsCategoryId,
  locale: string
): Promise<AdminSmsLocaleTemplateSnapshot> {
  try {
    if (categoryId === 'pre_tour_contact') {
      const res = await fetch(`/api/pre-tour-contact-sms-template?locale=${locale}`)
      const data = (await res.json()) as {
        body_template?: string
        saved_in_db?: boolean
      }
      if (!res.ok) return fallbackSnapshot(categoryId, locale)
      return {
        body_template:
          data.body_template || getBuiltinAdminSmsLocaleTemplate(categoryId, locale),
        saved_in_db: !!data.saved_in_db,
      }
    }

    if (isAdminSmsDbTemplateKey(categoryId)) {
      const res = await fetchApiWithAuth(
        `/api/admin-sms-templates?template_key=${categoryId}&locale=${locale}`
      )
      const data = (await res.json()) as {
        body_template?: string
        saved_in_db?: boolean
      }
      if (!res.ok) return fallbackSnapshot(categoryId, locale)
      return {
        body_template:
          data.body_template || getBuiltinAdminSmsLocaleTemplate(categoryId, locale),
        saved_in_db: !!data.saved_in_db,
      }
    }
  } catch {
    return fallbackSnapshot(categoryId, locale)
  }

  return fallbackSnapshot(categoryId, locale)
}

export function getCachedAdminSmsLocaleTemplate(
  categoryId: AdminSmsCategoryId,
  locale: string
): AdminSmsLocaleTemplateSnapshot | null {
  return cache.get(cacheKey(categoryId, locale)) ?? null
}

export function prefetchAdminSmsLocaleTemplate(
  categoryId: AdminSmsCategoryId,
  locale: string
): void {
  const key = cacheKey(categoryId, locale)
  if (cache.has(key) || inflight.has(key)) return

  const promise = fetchFromApi(categoryId, locale).then((snapshot) => {
    cache.set(key, snapshot)
    inflight.delete(key)
    return snapshot
  })
  inflight.set(key, promise)
}

export async function loadAdminSmsLocaleTemplate(
  categoryId: AdminSmsCategoryId,
  locale: string,
  options?: { force?: boolean }
): Promise<AdminSmsLocaleTemplateSnapshot> {
  const key = cacheKey(categoryId, locale)
  if (!options?.force) {
    const cached = cache.get(key)
    if (cached) return cached
    const pending = inflight.get(key)
    if (pending) return pending
  } else {
    cache.delete(key)
    inflight.delete(key)
  }

  const promise = fetchFromApi(categoryId, locale).then((snapshot) => {
    cache.set(key, snapshot)
    inflight.delete(key)
    return snapshot
  })
  inflight.set(key, promise)
  return promise
}

export function invalidateAdminSmsLocaleTemplateCache(
  categoryId: AdminSmsCategoryId,
  locale: string
): void {
  const key = cacheKey(categoryId, locale)
  cache.delete(key)
  inflight.delete(key)
}
