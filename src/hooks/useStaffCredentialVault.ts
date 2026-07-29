'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type {
  StaffCredentialVaultAccessLogRow,
  StaffCredentialVaultCategory,
  StaffCredentialVaultFormPayload,
  StaffCredentialVaultListItem,
} from '@/lib/staffCredentialVault'

async function vaultFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ data?: T; error?: string; status: number }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    return { error: 'no session', status: 401 }
  }

  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  })

  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    return { error: json.error || 'request failed', status: res.status }
  }
  return { data: json, status: res.status }
}

export function useStaffCredentialVault() {
  const [items, setItems] = useState<StaffCredentialVaultListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<StaffCredentialVaultCategory | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (showArchived) params.set('archived', '1')
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      const qs = params.toString()
      const result = await vaultFetch<{ items: StaffCredentialVaultListItem[] }>(
        `/api/staff-credential-vault${qs ? `?${qs}` : ''}`
      )
      if (result.error) throw new Error(result.error)
      setItems(result.data?.items || [])
    } catch (e) {
      console.error('useStaffCredentialVault loadItems', e)
      setItems([])
      return { error: e }
    } finally {
      setLoading(false)
    }
    return {}
  }, [categoryFilter, showArchived])

  const createItem = useCallback(async (form: StaffCredentialVaultFormPayload) => {
    setSubmitting(true)
    try {
      const result = await vaultFetch<{ item: StaffCredentialVaultListItem }>(
        '/api/staff-credential-vault',
        {
          method: 'POST',
          body: JSON.stringify(form),
        }
      )
      if (result.error) throw new Error(result.error)
      const item = result.data?.item
      if (item) {
        setItems((prev) => [...prev, item].sort((a, b) => a.site_name.localeCompare(b.site_name)))
      }
      return { data: item }
    } catch (e) {
      console.error('useStaffCredentialVault createItem', e)
      return { error: e }
    } finally {
      setSubmitting(false)
    }
  }, [])

  const updateItem = useCallback(
    async (id: string, form: Partial<StaffCredentialVaultFormPayload> & { isArchived?: boolean }) => {
      setSubmitting(true)
      try {
        const result = await vaultFetch<{ item: StaffCredentialVaultListItem }>(
          `/api/staff-credential-vault/${id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              siteName: form.siteName,
              siteUrl: form.siteUrl,
              category: form.category,
              loginId: form.loginId,
              password: form.password,
              notes: form.notes,
              isArchived: form.isArchived,
            }),
          }
        )
        if (result.error) throw new Error(result.error)
        const item = result.data?.item
        if (item) {
          setItems((prev) => {
            const next = prev.map((row) => (row.id === id ? item : row))
            if (showArchived) return next.sort((a, b) => a.site_name.localeCompare(b.site_name))
            return next
              .filter((row) => !row.is_archived)
              .sort((a, b) => a.site_name.localeCompare(b.site_name))
          })
        }
        return { data: item }
      } catch (e) {
        console.error('useStaffCredentialVault updateItem', e)
        return { error: e }
      } finally {
        setSubmitting(false)
      }
    },
    [showArchived]
  )

  const deleteItem = useCallback(async (id: string) => {
    setSubmitting(true)
    try {
      const result = await vaultFetch<{ ok: boolean }>(`/api/staff-credential-vault/${id}`, {
        method: 'DELETE',
      })
      if (result.error) throw new Error(result.error)
      setItems((prev) => prev.filter((row) => row.id !== id))
      return {}
    } catch (e) {
      console.error('useStaffCredentialVault deleteItem', e)
      return { error: e }
    } finally {
      setSubmitting(false)
    }
  }, [])

  const revealPassword = useCallback(async (id: string, action: 'reveal_password' | 'copy_password') => {
    const result = await vaultFetch<{ password: string }>(`/api/staff-credential-vault/${id}/reveal`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    })
    if (result.error) {
      return { error: result.error }
    }
    return { password: result.data?.password || '' }
  }, [])

  const loadAccessLogs = useCallback(async (id: string) => {
    const result = await vaultFetch<{
      siteName: string
      logs: StaffCredentialVaultAccessLogRow[]
    }>(`/api/staff-credential-vault/${id}/access-logs`)
    if (result.error) {
      return { error: result.error }
    }
    return {
      siteName: result.data?.siteName || '',
      logs: result.data?.logs || [],
    }
  }, [])

  return {
    items,
    loading,
    submitting,
    categoryFilter,
    setCategoryFilter,
    showArchived,
    setShowArchived,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    revealPassword,
    loadAccessLogs,
  }
}
