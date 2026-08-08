'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ClipboardCopy,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import {
  credentialVaultCategoryLabel,
  STAFF_CREDENTIAL_VAULT_CATEGORIES,
  type StaffCredentialVaultAccessLogRow,
  type StaffCredentialVaultListItem,
} from '@/lib/staffCredentialVault'
import { useStaffCredentialVault } from '@/hooks/useStaffCredentialVault'
import {
  EMPTY_STAFF_CREDENTIAL_VAULT_FORM,
  type StaffCredentialVaultFormState,
} from '@/components/admin/work/staffCredentialVaultFormState'
import { StaffCredentialVaultFormModal } from '@/components/admin/work/StaffCredentialVaultFormModal'
import { StaffCredentialVaultAccessLogModal } from '@/components/admin/work/StaffCredentialVaultAccessLogModal'

type AdminWorkCredentialVaultPanelProps = {
  locale: string
  active: boolean
}

export function AdminWorkCredentialVaultPanel({
  locale,
  active,
}: AdminWorkCredentialVaultPanelProps) {
  const isKo = locale === 'ko'
  const vault = useStaffCredentialVault()
  const {
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
  } = vault
  const [search, setSearch] = useState('')
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [revealLoadingId, setRevealLoadingId] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<StaffCredentialVaultFormState>({ ...EMPTY_STAFF_CREDENTIAL_VAULT_FORM })
  const [editingItem, setEditingItem] = useState<StaffCredentialVaultListItem | null>(null)

  const [logOpen, setLogOpen] = useState(false)
  const [logSiteName, setLogSiteName] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [logs, setLogs] = useState<StaffCredentialVaultAccessLogRow[]>([])

  useEffect(() => {
    if (!active) return
    void loadItems()
  }, [active, loadItems, categoryFilter, showArchived])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.site_name.toLowerCase().includes(q) ||
        item.login_id.toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q)
    )
  }, [search, items])

  const openCreate = () => {
    setFormMode('create')
    setForm({ ...EMPTY_STAFF_CREDENTIAL_VAULT_FORM })
    setEditingItem(null)
    setFormOpen(true)
  }

  const openEdit = (item: StaffCredentialVaultListItem) => {
    setFormMode('edit')
    setEditingItem(item)
    setForm({
      siteName: item.site_name,
      siteUrl: item.site_url || '',
      category: item.category,
      loginId: item.login_id,
      password: '',
      notes: item.notes || '',
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.siteName.trim() || !form.loginId.trim()) {
      alert(isKo ? '사이트명과 로그인 ID를 입력해 주세요.' : 'Site name and login ID are required.')
      return
    }
    if (formMode === 'create' && !form.password) {
      alert(isKo ? '비밀번호를 입력해 주세요.' : 'Password is required.')
      return
    }

    const trimmedSiteUrl = form.siteUrl.trim()
    const trimmedNotes = form.notes.trim()

    const result =
      formMode === 'create'
        ? await createItem({
            siteName: form.siteName.trim(),
            category: form.category,
            loginId: form.loginId.trim(),
            password: form.password,
            ...(trimmedSiteUrl ? { siteUrl: trimmedSiteUrl } : {}),
            ...(trimmedNotes ? { notes: trimmedNotes } : {}),
          })
        : editingItem
          ? await updateItem(editingItem.id, {
              siteName: form.siteName.trim(),
              category: form.category,
              loginId: form.loginId.trim(),
              ...(trimmedSiteUrl ? { siteUrl: trimmedSiteUrl } : { siteUrl: '' }),
              ...(trimmedNotes ? { notes: trimmedNotes } : { notes: '' }),
              ...(form.password ? { password: form.password } : {}),
            })
          : { error: 'missing item' }

    if (result.error) {
      alert(isKo ? '저장에 실패했습니다.' : 'Failed to save.')
      return
    }

    setFormOpen(false)
    setEditingItem(null)
    setRevealed((prev) => {
      if (!editingItem) return prev
      const next = { ...prev }
      delete next[editingItem.id]
      return next
    })
  }

  const handleReveal = async (item: StaffCredentialVaultListItem) => {
    if (revealed[item.id]) {
      setRevealed((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      return
    }

    setRevealLoadingId(item.id)
    try {
      const result = await revealPassword(item.id, 'reveal_password')
      if (result.error || !result.password) {
        alert(isKo ? '비밀번호를 불러오지 못했습니다.' : 'Failed to reveal password.')
        return
      }
      setRevealed((prev) => ({ ...prev, [item.id]: result.password! }))
      window.setTimeout(() => {
        setRevealed((prev) => {
          if (!prev[item.id]) return prev
          const next = { ...prev }
          delete next[item.id]
          return next
        })
      }, 30_000)
    } finally {
      setRevealLoadingId(null)
    }
  }

  const handleCopyPassword = async (item: StaffCredentialVaultListItem) => {
    setRevealLoadingId(item.id)
    try {
      const result = await revealPassword(item.id, 'copy_password')
      if (result.error || !result.password) {
        alert(isKo ? '비밀번호를 복사하지 못했습니다.' : 'Failed to copy password.')
        return
      }
      await navigator.clipboard.writeText(result.password)
      alert(isKo ? '비밀번호가 복사되었습니다.' : 'Password copied.')
    } finally {
      setRevealLoadingId(null)
    }
  }

  const handleCopyLoginId = async (loginId: string) => {
    await navigator.clipboard.writeText(loginId)
    alert(isKo ? '로그인 ID가 복사되었습니다.' : 'Login ID copied.')
  }

  const handleDelete = async (item: StaffCredentialVaultListItem) => {
    if (
      !confirm(
        isKo
          ? `"${item.site_name}" 항목을 영구 삭제하시겠습니까?`
          : `Permanently delete "${item.site_name}"?`
      )
    ) {
      return
    }
    const result = await deleteItem(item.id)
    if (result.error) alert(isKo ? '삭제에 실패했습니다.' : 'Failed to delete.')
  }

  const handleArchiveToggle = async (item: StaffCredentialVaultListItem) => {
    const result = await updateItem(item.id, { isArchived: !item.is_archived })
    if (result.error) alert(isKo ? '상태 변경에 실패했습니다.' : 'Failed to update status.')
  }

  const openAccessLogs = useCallback(
    async (item: StaffCredentialVaultListItem) => {
      setLogOpen(true)
      setLogSiteName(item.site_name)
      setLogLoading(true)
      setLogs([])
      const result = await loadAccessLogs(item.id)
      setLogLoading(false)
      if (result.error) {
        alert(isKo ? '열람 기록을 불러오지 못했습니다.' : 'Failed to load access log.')
        setLogOpen(false)
        return
      }
      setLogs(result.logs || [])
    },
    [isKo, loadAccessLogs]
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[140px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input {...BROWSER_AUTOFILL_OFF_PROPS} type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isKo ? '사이트·ID 검색' : 'Search site or ID'}
            className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-2 text-xs"
          />
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-sky-700"
        >
          <Plus className="h-3.5 w-3.5" />
          {isKo ? '등록' : 'Add'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            categoryFilter === 'all'
              ? 'bg-sky-100 text-sky-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isKo ? '전체' : 'All'}
        </button>
        {STAFF_CREDENTIAL_VAULT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(cat.id)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              categoryFilter === cat.id
                ? 'bg-sky-100 text-sky-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isKo ? cat.labelKo : cat.labelEn}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-1.5 text-[10px] text-gray-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-gray-300"
          />
          {isKo ? '보관함 포함' : 'Include archived'}
        </label>
        <button
          type="button"
          onClick={() => void loadItems()}
          className="text-[10px] font-medium text-sky-700 hover:underline"
        >
          {isKo ? '새로고침' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {isKo ? '불러오는 중…' : 'Loading…'}
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">
          {isKo ? '등록된 로그인 정보가 없습니다.' : 'No saved logins yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const passwordVisible = revealed[item.id]
            const isLoading = revealLoadingId === item.id
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-2.5 ${
                  item.is_archived ? 'border-gray-200 bg-gray-50 opacity-80' : 'border-sky-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                        {credentialVaultCategoryLabel(item.category, locale)}
                      </span>
                      {item.is_archived && (
                        <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                          {isKo ? '보관' : 'Archived'}
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1 text-sm font-semibold text-gray-900">{item.site_name}</h4>
                    {item.site_url && (
                      <a
                        href={item.site_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-sky-700 hover:underline"
                      >
                        {isKo ? '사이트 열기' : 'Open site'}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => void openAccessLogs(item)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100"
                      title={isKo ? '열람 기록' : 'Access log'}
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100"
                      title={isKo ? '수정' : 'Edit'}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleArchiveToggle(item)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100"
                      title={item.is_archived ? (isKo ? '복구' : 'Restore') : isKo ? '보관' : 'Archive'}
                    >
                      {item.is_archived ? (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                      title={isKo ? '삭제' : 'Delete'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 space-y-1.5 rounded-md bg-gray-50 px-2.5 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">{isKo ? 'ID' : 'Login'}</span>
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="truncate font-medium text-gray-900">{item.login_id}</span>
                      <button
                        type="button"
                        onClick={() => void handleCopyLoginId(item.login_id)}
                        className="rounded p-0.5 text-gray-500 hover:bg-white"
                        title={isKo ? 'ID 복사' : 'Copy ID'}
                      >
                        <ClipboardCopy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">{isKo ? '비밀번호' : 'Password'}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-gray-900">
                        {passwordVisible || '••••••••'}
                      </span>
                      <button
                        type="button"
                        disabled={isLoading || item.is_archived}
                        onClick={() => void handleReveal(item)}
                        className="rounded p-0.5 text-gray-500 hover:bg-white disabled:opacity-50"
                        title={passwordVisible ? (isKo ? '숨기기' : 'Hide') : isKo ? '열람' : 'Reveal'}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : passwordVisible ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isLoading || item.is_archived}
                        onClick={() => void handleCopyPassword(item)}
                        className="rounded p-0.5 text-gray-500 hover:bg-white disabled:opacity-50"
                        title={isKo ? '비밀번호 복사' : 'Copy password'}
                      >
                        <ClipboardCopy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {item.notes && (
                  <p className="mt-2 text-[10px] leading-relaxed text-gray-600">{item.notes}</p>
                )}
                <p className="mt-1.5 text-[10px] text-gray-400">
                  {item.updated_by_name || item.created_by_name || item.created_by_email}
                  {' · '}
                  {new Date(item.updated_at).toLocaleString(isKo ? 'ko-KR' : 'en-US')}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <StaffCredentialVaultFormModal
        open={formOpen}
        mode={formMode}
        locale={locale}
        values={form}
        onChange={setForm}
        onClose={() => {
          setFormOpen(false)
          setEditingItem(null)
        }}
        onSave={handleSave}
        saving={submitting}
      />

      <StaffCredentialVaultAccessLogModal
        open={logOpen}
        locale={locale}
        siteName={logSiteName}
        logs={logs || []}
        loading={logLoading}
        onClose={() => setLogOpen(false)}
      />
    </div>
  )
}
