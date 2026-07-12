import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

import { FALLBACK_SITE_LOGO_URL } from '@/lib/customerSiteBranding'

const FALLBACK_FAVICON_URL = FALLBACK_SITE_LOGO_URL

export { FALLBACK_SITE_LOGO_URL }

type ChannelFaviconRow = {
  id?: string | null
  name?: string | null
  favicon_url?: string | null
  type?: string | null
}

function pickChannelFaviconUrl(rows: ChannelFaviconRow[]): string | null {
  const homepage = rows.find(
    (row) =>
      row.id === 'M00001' ||
      /homepage|홈페이지/i.test(String(row.name ?? ''))
  )
  if (homepage?.favicon_url) return homepage.favicon_url

  const selfChannel = rows.find((row) => row.type === 'self')
  if (selfChannel?.favicon_url) return selfChannel.favicon_url

  return rows[0]?.favicon_url ?? null
}

async function fetchChannelFaviconUrlUncached(): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

  const timeoutMs = Math.max(
    500,
    Number(process.env.CHANNEL_FAVICON_METADATA_TIMEOUT_MS) > 0
      ? Number(process.env.CHANNEL_FAVICON_METADATA_TIMEOUT_MS)
      : process.env.NODE_ENV === 'development'
        ? 2_000
        : 5_000
  )

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const query = fromUntypedTable(supabase, 'channels')
    .select('id, name, favicon_url, type')
    .not('favicon_url', 'is', null)
    .limit(30)

  try {
    const { data, error } = await Promise.race([
      query,
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'favicon_metadata_timeout' } }), timeoutMs)
      ),
    ])

    if (error?.message === 'favicon_metadata_timeout') {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[metadata] channel favicon query exceeded ${timeoutMs}ms, using fallback icon`)
      }
      return null
    }

    if (error || !data?.length) return null
    return pickChannelFaviconUrl(data as ChannelFaviconRow[])
  } catch {
    return null
  }
}

function getFaviconRevalidateSeconds(): number {
  const configured = Number(process.env.CHANNEL_FAVICON_METADATA_REVALIDATE_SEC)
  if (configured > 0) return configured
  return process.env.NODE_ENV === 'development' ? 120 : 300
}

const getCachedChannelFaviconUrl = unstable_cache(
  fetchChannelFaviconUrlUncached,
  ['channel-favicon-url-v1'],
  {
    revalidate: getFaviconRevalidateSeconds(),
    tags: ['channel-favicon'],
  }
)

export { getCachedChannelFaviconUrl as getCachedChannelSiteLogoUrl }

export type CustomerSiteBrandingData = {
  logoUrl: string
  hasCustomLogo: boolean
}

export async function getCachedCustomerSiteBranding(): Promise<CustomerSiteBrandingData> {
  const customLogoUrl = await getCachedChannelFaviconUrl()
  return {
    logoUrl: customLogoUrl ?? FALLBACK_SITE_LOGO_URL,
    hasCustomLogo: Boolean(customLogoUrl),
  }
}

function buildIconsMetadata(faviconUrl: string): NonNullable<Metadata['icons']> {
  return {
    icon: [{ url: faviconUrl }],
    shortcut: [{ url: faviconUrl }],
    apple: [{ url: faviconUrl }],
  }
}

export async function getLocaleLayoutMetadata(): Promise<Metadata> {
  const fallbackMetadata: Metadata = {
    manifest: '/manifest.json',
    icons: buildIconsMetadata(FALLBACK_FAVICON_URL),
  }

  try {
    const faviconUrl = (await getCachedChannelFaviconUrl()) ?? FALLBACK_FAVICON_URL
    return {
      manifest: '/manifest.json',
      icons: buildIconsMetadata(faviconUrl),
    }
  } catch {
    return fallbackMetadata
  }
}
