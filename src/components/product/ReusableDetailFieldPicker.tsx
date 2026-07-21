'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Library, Loader2, Plus, Save, Unlink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ContentLibraryLocaleBadges from '@/components/admin/ContentLibraryLocaleBadges'
import LightRichEditor from '@/components/LightRichEditor'
import { supabase } from '@/lib/supabase'
import {
  REUSABLE_DETAIL_KIND_LABELS,
  buildDetailLibraryPayload,
  fetchDetailContentLibrary,
  getDetailContentExactText,
  getDetailContentFilledLocales,
  getDetailContentLocalizedText,
  isReusableDetailKind,
  upsertProductDetailContentLink,
  type DetailContentLibraryItem,
  type ReusableDetailKind,
} from '@/lib/reusableContentLibrary'

type ReusableDetailFieldPickerProps = {
  productId: string
  kind: ReusableDetailKind | string
  locale: string
  /** Current inline/custom value shown in the editor */
  value: string
  onChange: (value: string) => void
  editorHeight?: number
  placeholder?: string
  uiLocale?: string
  /** When library selection changes (null = custom/unlinked) */
  onLibraryIdChange?: (libraryId: string | null) => void
  /** Currently linked library id (controlled from parent) */
  libraryId?: string | null
  disabled?: boolean
}

/**
 * For reusable detail fields (운영 안내 / 정책):
 * pick a shared library item, or edit product-specific custom text.
 */
export default function ReusableDetailFieldPicker({
  productId,
  kind,
  locale,
  value,
  onChange,
  editorHeight = 280,
  placeholder,
  uiLocale,
  onLibraryIdChange,
  libraryId: libraryIdProp,
  disabled,
}: ReusableDetailFieldPickerProps) {
  const t = useTranslations('products.customerPageEdit.reusableLibrary')
  const tFields = useTranslations('products.customerPageEdit.detailFields')
  const reusable = isReusableDetailKind(kind)
  const [items, setItems] = useState<DetailContentLibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  const [localLibraryId, setLocalLibraryId] = useState<string | null>(libraryIdProp ?? null)
  const [message, setMessage] = useState<string | null>(null)

  const libraryId = libraryIdProp !== undefined ? libraryIdProp : localLibraryId

  const setLibraryId = useCallback(
    (id: string | null) => {
      setLocalLibraryId(id)
      onLibraryIdChange?.(id)
    },
    [onLibraryIdChange]
  )

  const loadLibrary = useCallback(async () => {
    if (!reusable) return
    setLoading(true)
    try {
      const rows = await fetchDetailContentLibrary(supabase as never, {
        kind: kind as ReusableDetailKind,
        activeOnly: true,
      })
      setItems(rows)
    } catch (error) {
      console.error('detail content library load error:', error)
      setMessage(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [kind, reusable, t])

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  useEffect(() => {
    if (libraryIdProp !== undefined) setLocalLibraryId(libraryIdProp)
  }, [libraryIdProp])

  const selected = useMemo(
    () => items.find((item) => item.id === libraryId) ?? null,
    [items, libraryId]
  )

  const editorLocaleProp =
    uiLocale === 'ko' || uiLocale === 'en' ? ({ uiLocale } as const) : {}
  const editorPlaceholderProp =
    placeholder != null && placeholder !== '' ? { placeholder } : {}

  const kindLabel = reusable
    ? tFields.has(kind as ReusableDetailKind)
      ? tFields(kind as ReusableDetailKind)
      : REUSABLE_DETAIL_KIND_LABELS[kind as ReusableDetailKind]
    : kind

  if (!reusable) {
    return (
      <LightRichEditor
        value={value}
        onChange={(next) => onChange(next ?? '')}
        height={editorHeight}
        enableResize
        {...editorLocaleProp}
        {...editorPlaceholderProp}
      />
    )
  }

  const handleSelectLibrary = (id: string) => {
    if (!id) {
      setLibraryId(null)
      return
    }
    const item = items.find((row) => row.id === id)
    setLibraryId(id)
    if (item) {
      onChange(getDetailContentLocalizedText(item, locale) || getDetailContentExactText(item, locale))
    }
  }

  const handleUnlink = () => {
    setLibraryId(null)
    setMessage(t('unlinked'))
  }

  const handleSaveAsLibrary = async () => {
    const body = value.trim()
    if (!body) {
      setMessage(t('emptyContent'))
      return
    }

    setSavingNew(true)
    setMessage(null)
    try {
      if (libraryId) {
        const existing = items.find((row) => row.id === libraryId) || selected
        const bodyByLocale: Partial<Record<string, string>> = {}
        if (existing) {
          for (const code of getDetailContentFilledLocales(existing)) {
            bodyByLocale[code] = getDetailContentExactText(existing, code)
          }
        }
        bodyByLocale[locale] = body

        const payload = {
          ...buildDetailLibraryPayload({
            kind: kind as ReusableDetailKind,
            name: existing?.name || kindLabel,
            bodyByLocale,
          }),
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from('detail_content_library')
          .update(payload as never)
          .eq('id', libraryId)
        if (error) throw error

        setItems((prev) =>
          prev.map((row) => (row.id === libraryId ? { ...row, ...payload } : row))
        )
        setMessage(t('updatedLibrary'))
        return
      }

      const name = window.prompt(
        t('namePrompt', { kind: kindLabel }),
        body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || kindLabel
      )
      if (name == null) return
      if (!name.trim()) {
        setMessage(t('nameRequired'))
        return
      }

      const payload = buildDetailLibraryPayload({
        kind: kind as ReusableDetailKind,
        name: name.trim(),
        bodyByLocale: { [locale]: body },
      })

      const { data, error } = await supabase
        .from('detail_content_library')
        .insert({
          ...payload,
          is_active: true,
        } as never)
        .select('*')
        .single()

      if (error) throw error
      const created = data as DetailContentLibraryItem
      setItems((prev) => [created, ...prev])
      setLibraryId(created.id)
      if (productId) {
        await upsertProductDetailContentLink(supabase as never, productId, kind as ReusableDetailKind, created.id)
      }
      setMessage(t('savedAndLinked'))
    } catch (error) {
      console.error('save as library error:', error)
      setMessage(t('saveError'))
    } finally {
      setSavingNew(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Library className="h-3.5 w-3.5 text-primary" />
          {t('title', { kind: kindLabel })}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={libraryId ?? ''}
            onChange={(e) => handleSelectLibrary(e.target.value)}
            disabled={disabled || loading}
            className="w-full flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('customOption')}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || t('unnamed')}
                {getDetailContentFilledLocales(item).length > 0
                  ? ` [${getDetailContentFilledLocales(item)
                      .map((code) => code.toUpperCase())
                      .join(', ')}]`
                  : ''}
              </option>
            ))}
          </select>
          {libraryId ? (
            <button
              type="button"
              onClick={handleUnlink}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <Unlink className="h-3.5 w-3.5" />
              {t('unlink')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSaveAsLibrary()}
            disabled={disabled || savingNew || !value.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {savingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : libraryId ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {libraryId ? t('updateLibrary') : t('saveToLibrary')}
          </button>
        </div>
        {selected ? (
          <div className="space-y-1">
            <p className="text-[11px] text-amber-700">{t('hintLinked')}</p>
            <ContentLibraryLocaleBadges locales={getDetailContentFilledLocales(selected)} />
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">{t('hintCustom')}</p>
        )}
        {loading ? (
          <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> {t('loading')}
          </p>
        ) : null}
        {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}
      </div>

      <LightRichEditor
        value={value}
        onChange={(next) => onChange(next ?? '')}
        height={editorHeight}
        enableResize
        {...editorLocaleProp}
        {...editorPlaceholderProp}
      />
    </div>
  )
}
