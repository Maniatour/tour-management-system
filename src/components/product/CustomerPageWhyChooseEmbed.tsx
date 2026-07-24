'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Library,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react'
import WhyChooseLibraryManagerModal from '@/components/product/WhyChooseLibraryManagerModal'
import WhyChooseLibraryPicker from '@/components/product/WhyChooseLibraryPicker'
import { normalizeAdminEditLocale, type AdminEditLocale } from '@/lib/adminEditLocales'
import {
  fetchProductAttachedWhyChooseItems,
  fetchWhyChooseLibrary,
  getWhyChooseLocalizedText,
  type WhyChooseLibraryItem,
} from '@/lib/whyChooseLibrary'
import { supabase } from '@/lib/supabase'

type WhyChooseItem = WhyChooseLibraryItem & {
  link_id?: string
  product_id: string
  order_index: number
}

type CustomerPageWhyChooseEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

function itemLabel(item: WhyChooseItem, locale: AdminEditLocale, empty: string) {
  return getWhyChooseLocalizedText(item, 'title', locale).trim() || item.name.trim() || empty
}

function snapshot(items: WhyChooseItem[]) {
  return JSON.stringify(items.map((i) => ({ id: i.id, link_id: i.link_id ?? null, order_index: i.order_index })))
}

export default function CustomerPageWhyChooseEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
}: CustomerPageWhyChooseEmbedProps) {
  const t = useTranslations('products.customerPageEdit.whyChooseEmbed')
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [items, setItems] = useState<WhyChooseItem[]>([])
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)
  const [showLibraryPicker, setShowLibraryPicker] = useState(false)
  const [libraryItems, setLibraryItems] = useState<WhyChooseLibraryItem[]>([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set())
  const [showLibraryManager, setShowLibraryManager] = useState(false)

  const activeItem = items.find((item) => item.id === activeItemId) ?? null
  const hasPendingLinks = items.some((item) => !item.link_id)

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const attached = await fetchProductAttachedWhyChooseItems(supabase as never, productId, {
        includeInactive: true,
      })
      const nextItems: WhyChooseItem[] = attached.map(
        ({ link_is_active: _linkActive, ...row }) => row
      )
      setItems(nextItems)
      setActiveItemId(nextItems[0]?.id ?? null)
      setInitialSnapshot(snapshot(nextItems))
    } catch (error) {
      console.error('Why choose 로드 오류:', error)
      setMessage({ text: t('loadError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [productId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot) return
    onDirtyChange(snapshot(items) !== initialSnapshot)
  }, [initialSnapshot, items, onDirtyChange])

  useEffect(() => {
    setEditLocale(normalizeAdminEditLocale(localeProp ?? 'ko'))
  }, [localeProp])

  const closeLibraryPicker = () => {
    setShowLibraryPicker(false)
    setSelectedLibraryIds(new Set())
  }

  const handleSave = async () => {
    const pendingItems = items.filter((item) => !item.link_id)
    if (pendingItems.length === 0) return
    setSaving(true)
    setMessage(null)
    try {
      const { data: links, error } = await supabase
        .from('product_why_choose_links')
        .insert(
          pendingItems.map((item) => ({
            product_id: productId,
            library_id: item.id,
            order_index: item.order_index,
            is_active: true,
          })) as never
        )
        .select('*')
      if (error) throw error
      const linkByLibraryId = new Map(
        ((links || []) as Record<string, unknown>[]).map((link) => [
          String(link.library_id),
          String(link.id),
        ])
      )
      const nextItems = items.map((item) => {
        if (item.link_id) return item
        const linkId = linkByLibraryId.get(item.id)
        return linkId ? { ...item, link_id: linkId } : item
      })
      setItems(nextItems)
      setInitialSnapshot(snapshot(nextItems))
      setMessage({
        text:
          pendingItems.length > 1
            ? t('savedBatch', { count: String(pendingItems.length) })
            : t('saved'),
        type: 'success',
      })
      onSaved?.()
    } catch (error) {
      console.error('Why choose 저장 오류:', error)
      setMessage({ text: t('saveError'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const openLibraryPicker = async () => {
    setShowLibraryPicker(true)
    setSelectedLibraryIds(new Set())
    setLibraryLoading(true)
    try {
      const rows = await fetchWhyChooseLibrary(supabase as never, {
        activeOnly: true,
        search: librarySearch,
      })
      const attachedIds = new Set(items.map((item) => item.id))
      setLibraryItems(rows.filter((row) => !attachedIds.has(row.id)))
    } catch (error) {
      console.error('Why choose library load error:', error)
      setMessage({ text: t('libraryLoadError'), type: 'error' })
    } finally {
      setLibraryLoading(false)
    }
  }

  const attachSelected = () => {
    const selectedRows = libraryItems.filter((row) => selectedLibraryIds.has(row.id))
    if (selectedRows.length === 0) {
      setMessage({ text: t('libraryNoneSelected'), type: 'error' })
      return
    }
    const orderBase = items.length
    const newAttached: WhyChooseItem[] = selectedRows.map((row, idx) => ({
      ...row,
      product_id: productId,
      order_index: orderBase + idx,
    }))
    const nextItems = [...items, ...newAttached]
    setItems(nextItems)
    setActiveItemId(newAttached[newAttached.length - 1]!.id)
    closeLibraryPicker()
    setMessage({
      text:
        newAttached.length === 1
          ? t('libraryAttachedDraft')
          : t('libraryAttachedDraftCount', { count: String(newAttached.length) }),
      type: 'success',
    })
  }

  const handleRemove = async () => {
    if (!activeItemId || !activeItem) return
    if (!activeItem.link_id) {
      const remaining = items.filter((item) => item.id !== activeItemId)
      setItems(remaining)
      setActiveItemId(remaining[0]?.id ?? null)
      setMessage({ text: t('libraryAttachCancelled'), type: 'success' })
      return
    }
    if (!confirm(t('deleteConfirm'))) return
    setSaving(true)
    try {
      const { error } = await supabase.from('product_why_choose_links').delete().eq('id', activeItem.link_id)
      if (error) throw error
      const remaining = items.filter((item) => item.id !== activeItemId)
      setItems(remaining)
      setActiveItemId(remaining[0]?.id ?? null)
      setInitialSnapshot(snapshot(remaining))
      setMessage({ text: t('removed'), type: 'success' })
      onSaved?.()
    } catch (error) {
      console.error('Why choose 삭제 오류:', error)
      setMessage({ text: t('deleteError'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const moveItem = async (direction: 'up' | 'down') => {
    if (!activeItemId) return
    const index = items.findIndex((item) => item.id === activeItemId)
    if (index < 0) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= items.length) return
    const reordered = [...items]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)
    const withOrder = reordered.map((item, idx) => ({ ...item, order_index: idx }))
    setItems(withOrder)
    try {
      const linked = withOrder.filter((item) => item.link_id)
      if (linked.length > 0) {
        await Promise.all(
          linked.map((item) =>
            supabase
              .from('product_why_choose_links')
              .update({ order_index: item.order_index } as never)
              .eq('id', item.link_id!)
          )
        )
        onSaved?.()
      }
      setInitialSnapshot(snapshot(withOrder))
    } catch (error) {
      console.error('Why choose 순서 변경 오류:', error)
      setMessage({ text: t('reorderError'), type: 'error' })
      void loadData()
    }
  }

  const toggleLibraryId = (id: string) =>
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleAllLibrary = () =>
    setSelectedLibraryIds((prev) =>
      prev.size === libraryItems.length ? new Set() : new Set(libraryItems.map((i) => i.id))
    )
  const refreshAfterLibraryChange = useCallback(async () => {
    await loadData()
    onSaved?.()
  }, [loadData, onSaved])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('libraryHint')}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void openLibraryPicker()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <Library className="h-3.5 w-3.5" />
            {t('addFromLibrary')}
          </button>
          <button
            type="button"
            onClick={() => setShowLibraryManager(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
            title={t('manageLibraryTitle')}
          >
            {t('manageLibrary')}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
          <BadgeCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {items.map((item, index) => (
              <button
                key={`${item.id}-${item.link_id ?? 'pending'}`}
                type="button"
                onClick={() => setActiveItemId(item.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeItemId === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-muted-foreground hover:bg-muted'
                } ${!item.link_id ? 'border-dashed border-amber-300' : ''}`}
              >
                {index + 1}. {itemLabel(item, editLocale, t('noTitle'))}
                {!item.link_id ? ` (${t('unsaved')})` : ''}
              </button>
            ))}
          </div>
          {activeItem ? (
            <div className="flex items-center justify-end gap-1">
              <button type="button" onClick={() => void moveItem('up')} className="rounded-md border border-border p-1 hover:bg-muted" aria-label={t('moveUp')}>
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => void moveItem('down')} className="rounded-md border border-border p-1 hover:bg-muted" aria-label={t('moveDown')}>
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => void handleRemove()} className="rounded-md border border-border p-1 text-red-600 hover:bg-red-50" aria-label={t('remove')}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </>
      )}

      {message ? (
        <p className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || !hasPendingLinks}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t('save')}
      </button>

      {showLibraryPicker ? (
        <WhyChooseLibraryPicker
          editLocale={editLocale}
          libraryItems={libraryItems}
          libraryLoading={libraryLoading}
          librarySearch={librarySearch}
          selectedLibraryIds={selectedLibraryIds}
          saving={saving}
          onSearchChange={setLibrarySearch}
          onSearch={() => void openLibraryPicker()}
          onClose={closeLibraryPicker}
          onAttach={attachSelected}
          onToggleAll={toggleAllLibrary}
          onToggleItem={toggleLibraryId}
        />
      ) : null}

      {showLibraryManager ? (
        <WhyChooseLibraryManagerModal
          onClose={() => {
            setShowLibraryManager(false)
            void refreshAfterLibraryChange()
          }}
          onMutated={() => void refreshAfterLibraryChange()}
        />
      ) : null}
    </div>
  )
}
