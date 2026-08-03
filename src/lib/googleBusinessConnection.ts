import type {
  GoogleBusinessAccountItem,
  GoogleBusinessConnectionStatus,
  GoogleBusinessLocationItem,
} from '@/types/googleBusiness'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import {
  decryptGoogleBusinessRefreshToken,
  encryptGoogleBusinessRefreshToken,
  isGoogleBusinessTokenEncryptionConfigured,
} from '@/lib/googleBusinessTokenCrypto'
import { refreshGoogleBusinessAccessToken } from '@/lib/googleBusinessOAuth'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

/** GBP account resource id: accounts/{accountId} */
export function normalizeGoogleAccountName(accountName: string): string {
  const trimmed = accountName.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('accounts/')) return trimmed
  return `accounts/${trimmed.replace(/^accounts\//, '')}`
}

/**
 * Business Information API v1 returns locations/{id}.
 * Reviews API v4 expects accounts/{accountId}/locations/{locationId}.
 */
export function normalizeGoogleLocationName(
  locationName: string,
  accountName: string
): string {
  const trimmed = locationName.trim()
  if (!trimmed) return trimmed

  const account = normalizeGoogleAccountName(accountName)
  const accountId = account.replace(/^accounts\//, '')

  if (trimmed.includes('/locations/')) {
    return trimmed
  }

  if (trimmed.startsWith('locations/')) {
    const locationId = trimmed.slice('locations/'.length).split('/')[0]
    return `accounts/${accountId}/locations/${locationId}`
  }

  if (/^\d+$/.test(trimmed)) {
    return `accounts/${accountId}/locations/${trimmed}`
  }

  return trimmed
}

export function isValidGoogleLocationName(locationName: string): boolean {
  const trimmed = locationName.trim()
  return (
    /\/locations\/[^/]+/.test(trimmed) ||
    /^locations\/[^/]+/.test(trimmed) ||
    /^\d+$/.test(trimmed)
  )
}

type ConnectionRow = {
  id: string
  operator_id: string
  connected_email: string
  google_account_name: string | null
  google_account_display_name: string | null
  google_location_name: string | null
  google_location_title: string | null
  refresh_token_ciphertext: string
  connected_by_email: string | null
  connected_by_user_id: string | null
  created_at: string
  updated_at: string
  last_synced_at?: string | null
  last_import_review_count?: number | null
}

function mapConnectionStatus(row: ConnectionRow | null): GoogleBusinessConnectionStatus {
  if (!row) {
    return {
      connected: false,
      connectedEmail: null,
      googleAccountName: null,
      googleAccountDisplayName: null,
      googleLocationName: null,
      googleLocationTitle: null,
      updatedAt: null,
      lastSyncedAt: null,
      lastImportReviewCount: null,
    }
  }

  return {
    connected: true,
    connectedEmail: row.connected_email,
    googleAccountName: row.google_account_name,
    googleAccountDisplayName: row.google_account_display_name,
    googleLocationName: row.google_location_name,
    googleLocationTitle: row.google_location_title,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at ?? null,
    lastImportReviewCount:
      typeof row.last_import_review_count === 'number' ? row.last_import_review_count : null,
  }
}

export async function getGoogleBusinessConnectionStatus(
  operatorId?: string | null
): Promise<GoogleBusinessConnectionStatus> {
  if (!supabaseAdmin) {
    return mapConnectionStatus(null)
  }

  const { data, error } = await fromUntypedTable(supabaseAdmin, 'google_business_connections')
    .select(
      'id, operator_id, connected_email, google_account_name, google_account_display_name, google_location_name, google_location_title, refresh_token_ciphertext, connected_by_email, connected_by_user_id, created_at, updated_at, last_synced_at, last_import_review_count'
    )
    .eq('operator_id', resolveOperatorId(operatorId))
    .maybeSingle()

  if (error) {
    console.error('[googleBusinessConnection] status query failed', error.message)
    return mapConnectionStatus(null)
  }

  return mapConnectionStatus((data as ConnectionRow | null) ?? null)
}

export async function upsertGoogleBusinessConnection(input: {
  operatorId: string
  connectedEmail: string
  refreshToken: string
  connectedByEmail: string
  connectedByUserId: string
}): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }
  if (!isGoogleBusinessTokenEncryptionConfigured()) {
    throw new Error('token_encryption_not_configured')
  }

  const refreshTokenCiphertext = encryptGoogleBusinessRefreshToken(input.refreshToken)
  const now = new Date().toISOString()

  const { error } = await fromUntypedTable(supabaseAdmin, 'google_business_connections').upsert(
    {
      operator_id: resolveOperatorId(input.operatorId),
      connected_email: input.connectedEmail,
      refresh_token_ciphertext: refreshTokenCiphertext,
      connected_by_email: input.connectedByEmail,
      connected_by_user_id: input.connectedByUserId,
      updated_at: now,
    } as never,
    { onConflict: 'operator_id' }
  )

  if (error) {
    throw new Error(error.message || 'connection_upsert_failed')
  }
}

export async function updateGoogleBusinessConnectionSelection(input: {
  operatorId: string
  googleAccountName: string
  googleAccountDisplayName: string | null
  googleLocationName: string
  googleLocationTitle: string | null
}): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const { error } = await fromUntypedTable(supabaseAdmin, 'google_business_connections')
    .update({
      google_account_name: input.googleAccountName,
      google_account_display_name: input.googleAccountDisplayName,
      google_location_name: input.googleLocationName,
      google_location_title: input.googleLocationTitle,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('operator_id', resolveOperatorId(input.operatorId))

  if (error) {
    throw new Error(error.message || 'connection_update_failed')
  }
}

export async function deleteGoogleBusinessConnection(operatorId?: string | null): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const { error } = await fromUntypedTable(supabaseAdmin, 'google_business_connections')
    .delete()
    .eq('operator_id', resolveOperatorId(operatorId))

  if (error) {
    throw new Error(error.message || 'connection_delete_failed')
  }
}

export async function getGoogleBusinessAccessToken(
  operatorId?: string | null
): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  }

  const { data, error } = await fromUntypedTable(supabaseAdmin, 'google_business_connections')
    .select('refresh_token_ciphertext')
    .eq('operator_id', resolveOperatorId(operatorId))
    .maybeSingle()

  if (error || !data) {
    throw new Error('not_connected')
  }

  const row = data as { refresh_token_ciphertext?: string }
  if (!row.refresh_token_ciphertext) {
    throw new Error('missing_refresh_token')
  }

  const refreshToken = decryptGoogleBusinessRefreshToken(row.refresh_token_ciphertext)
  const refreshed = await refreshGoogleBusinessAccessToken(refreshToken)
  return refreshed.accessToken
}

export async function fetchGoogleBusinessProfileEmail(
  accessToken: string
): Promise<string> {
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) {
    return 'connected@google.com'
  }
  const profile = (await profileRes.json()) as { email?: string }
  return profile.email?.trim() || 'connected@google.com'
}

export async function listGoogleBusinessAccounts(
  accessToken: string
): Promise<GoogleBusinessAccountItem[]> {
  const res = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`accounts_list_failed:${res.status}:${body.slice(0, 200)}`)
  }

  const payload = (await res.json()) as {
    accounts?: Array<{
      name?: string
      accountName?: string
      type?: string
      verificationState?: string
    }>
  }

  return (payload.accounts ?? [])
    .filter((row) => typeof row.name === 'string' && row.name.length > 0)
    .map((row) => ({
      name: row.name!,
      accountName: row.accountName?.trim() || row.name!,
      type: row.type ?? null,
      verificationState: row.verificationState ?? null,
    }))
}

export async function listGoogleBusinessLocationsV4(input: {
  accessToken: string
  accountName: string
}): Promise<GoogleBusinessLocationItem[]> {
  const accountName = input.accountName.trim()
  if (!accountName.startsWith('accounts/')) {
    throw new Error('invalid_account_name')
  }

  const locations: GoogleBusinessLocationItem[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${accountName}/locations`)
    url.searchParams.set('pageSize', '100')
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`locations_v4_list_failed:${res.status}:${body.slice(0, 300)}`)
    }

    const payload = (await res.json()) as {
      locations?: Array<{
        name?: string
        locationName?: string
        address?: {
          addressLines?: string[]
          locality?: string
          administrativeArea?: string
          postalCode?: string
        }
      }>
      nextPageToken?: string
    }

    for (const row of payload.locations ?? []) {
      if (!row.name) continue
      const addressParts = [
        ...(row.address?.addressLines ?? []),
        row.address?.locality,
        row.address?.administrativeArea,
        row.address?.postalCode,
      ].filter(Boolean)
      locations.push({
        name: normalizeGoogleLocationName(row.name, accountName),
        title: row.locationName?.trim() || row.name,
        storefrontAddress: addressParts.length ? addressParts.join(', ') : null,
      })
    }

    pageToken = payload.nextPageToken
  } while (pageToken)

  return locations
}

export async function listGoogleBusinessLocations(input: {
  accessToken: string
  accountName: string
}): Promise<GoogleBusinessLocationItem[]> {
  const accountName = input.accountName.trim()
  if (!accountName.startsWith('accounts/')) {
    throw new Error('invalid_account_name')
  }

  const locations: GoogleBusinessLocationItem[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`
    )
    url.searchParams.set('readMask', 'name,title,storefrontAddress,metadata')
    url.searchParams.set('pageSize', '100')
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`locations_list_failed:${res.status}:${body.slice(0, 300)}`)
    }

    const payload = (await res.json()) as {
      locations?: Array<{
        name?: string
        title?: string
        storefrontAddress?: {
          addressLines?: string[]
          locality?: string
          administrativeArea?: string
          postalCode?: string
        }
      }>
      nextPageToken?: string
    }

    for (const row of payload.locations ?? []) {
      if (!row.name) continue
      const addressParts = [
        ...(row.storefrontAddress?.addressLines ?? []),
        row.storefrontAddress?.locality,
        row.storefrontAddress?.administrativeArea,
        row.storefrontAddress?.postalCode,
      ].filter(Boolean)
      locations.push({
        name: normalizeGoogleLocationName(row.name, accountName),
        title: row.title?.trim() || row.name,
        storefrontAddress: addressParts.length ? addressParts.join(', ') : null,
      })
    }

    pageToken = payload.nextPageToken
  } while (pageToken)

  if (locations.length > 0) {
    return locations
  }

  return listGoogleBusinessLocationsV4(input)
}

/** Selected account returned empty — try every linked GBP account (common with org vs location-group). */
export async function discoverGoogleBusinessLocations(input: {
  accessToken: string
  preferredAccountName?: string | null
}): Promise<{
  locations: GoogleBusinessLocationItem[]
  resolvedAccountName: string | null
  triedAccounts: string[]
}> {
  const accounts = await listGoogleBusinessAccounts(input.accessToken)
  const triedAccounts: string[] = []
  const preferred = input.preferredAccountName?.trim()

  const orderedAccounts = preferred
    ? [
        ...accounts.filter((row) => row.name === preferred),
        ...accounts.filter((row) => row.name !== preferred),
      ]
    : accounts

  for (const account of orderedAccounts) {
    triedAccounts.push(account.name)
    try {
      const locations = await listGoogleBusinessLocations({
        accessToken: input.accessToken,
        accountName: account.name,
      })
      if (locations.length > 0) {
        return {
          locations,
          resolvedAccountName: account.name,
          triedAccounts,
        }
      }
    } catch (error) {
      console.warn('[googleBusinessConnection] locations for account failed', account.name, error)
    }
  }

  return { locations: [], resolvedAccountName: null, triedAccounts }
}
