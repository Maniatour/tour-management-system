'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchProductDetailsForAdminEdit } from '@/lib/fetchProductDetail'
import {
  fetchDefaultProductDetailsCustomerPageVisibility,
  formatSupabaseError,
  upsertDefaultProductDetailsMultilingual,
} from '@/lib/productDetailsMultilingualAdmin'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'

const SLOGAN_SLOT_IDS = ['slogan1', 'slogan2', 'slogan3'] as const

type SloganKey = (typeof SLOGAN_SLOT_IDS)[number]

type SloganForm = Record<SloganKey, string>

type VisibilityForm = Record<SloganKey, boolean>

type CustomerPageSloganEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

function readVisibility(row: Record<string, unknown> | null, key: SloganKey): boolean {
  const raw = row?.customer_page_visibility
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  return (raw as Record<string, unknown>)[key] !== false
}

function stripHtmlToPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export default function CustomerPageSloganEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
}: CustomerPageSloganEmbedProps) {
  const t = useTranslations('products.customerPageEdit.sloganEmbed')
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )
  const [activeSlot, setActiveSlot] = useState<SloganKey>('slogan1')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  )
  const [rowId, setRowId] = useState<string | null>(null)
  const [form, setForm] = useState<SloganForm>({ slogan1: '', slogan2: '', slogan3: '' })
  const [visibility, setVisibility] = useState<VisibilityForm>({
    slogan1: true,
    slogan2: true,
    slogan3: true,
  })
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)

  useEffect(() => {
    setEditLocale(normalizeAdminEditLocale(localeProp ?? 'ko'))
  }, [localeProp])

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { row, values } = await fetchProductDetailsForAdminEdit(productId, editLocale)
      const nextForm: SloganForm = {
        slogan1: stripHtmlToPlainText(String(values.slogan1 ?? '')),
        slogan2: stripHtmlToPlainText(String(values.slogan2 ?? '')),
        slogan3: stripHtmlToPlainText(String(values.slogan3 ?? '')),
      }
      const nextVisibility: VisibilityForm = {
        slogan1: readVisibility(values, 'slogan1'),
        slogan2: readVisibility(values, 'slogan2'),
        slogan3: readVisibility(values, 'slogan3'),
      }
      setRowId(row?.id ? String(row.id) : null)
      setForm(nextForm)
      setVisibility(nextVisibility)
      setInitialSnapshot(
        JSON.stringify({ form: nextForm, visibility: nextVisibility, locale: editLocale })
      )
    } catch (error) {
      console.error('슬로건 로드 오류:', error)
      setMessage({ text: t('loadError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [editLocale, productId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot) return
    const dirty =
      JSON.stringify({ form, visibility, locale: editLocale }) !== initialSnapshot
    onDirtyChange(dirty)
  }, [editLocale, form, initialSnapshot, onDirtyChange, visibility])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const existingVisibility = await fetchDefaultProductDetailsCustomerPageVisibility(
        supabase,
        productId,
        editLocale,
        rowId
      )

      const mergedVisibility = {
        ...existingVisibility,
        slogan1: visibility.slogan1,
        slogan2: visibility.slogan2,
        slogan3: visibility.slogan3,
      }

      const payload = {
        slogan1: form.slogan1.trim() || null,
        slogan2: form.slogan2.trim() || null,
        slogan3: form.slogan3.trim() || null,
        customer_page_visibility: mergedVisibility,
      }

      const { id: savedRowId } = await upsertDefaultProductDetailsMultilingual(supabase, {
        productId,
        languageCode: editLocale,
        existingRowId: rowId,
        patch: payload,
      })
      setRowId(savedRowId)

      setInitialSnapshot(JSON.stringify({ form, visibility, locale: editLocale }))
      setMessage({ text: t('saved'), type: 'success' })
      onSaved?.()
    } catch (error) {
      console.error('슬로건 저장 오류:', error)
      setMessage({ text: `${t('saveError')} ${formatSupabaseError(error)}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const slotMeta = (id: SloganKey) => ({
    id,
    label: t(`slots.${id}.label`),
    sublabel: t(`slots.${id}.sublabel`),
    hint: t(`slots.${id}.hint`),
  })

  const activeMeta = slotMeta(activeSlot)

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
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          DB: <code className="rounded bg-muted px-1">product_details_multilingual</code>
          {rowId ? (
            <span className="ml-2 text-[11px]">
              {t('rowId', { id: rowId })}
            </span>
          ) : (
            <span className="ml-2 text-amber-700">{t('newRowPending')}</span>
          )}
        </p>
        <p className="text-xs text-indigo-700">
          {t('editingLocale', { locale: getAdminEditLocaleLabel(editLocale) })}
        </p>
        {!rowId ? (
          <p className="text-xs text-amber-700">{t('emptyLocaleHint')}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-1">
        {SLOGAN_SLOT_IDS.map((id) => {
          const slot = slotMeta(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSlot(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeSlot === id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-white hover:text-foreground'
              }`}
            >
              {slot.label}
              <span className="ml-1 font-normal opacity-80">({slot.sublabel})</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {activeMeta.label} · {activeMeta.sublabel}
            </h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t('columnHint', { column: activeMeta.id, hint: activeMeta.hint })}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={visibility[activeSlot]}
              onChange={(e) =>
                setVisibility((prev) => ({ ...prev, [activeSlot]: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
            />
            {t('showOnCustomerPage')}
          </label>
        </div>

        <textarea
          value={form[activeSlot]}
          onChange={(e) => setForm((prev) => ({ ...prev, [activeSlot]: e.target.value }))}
          rows={activeSlot === 'slogan3' ? 5 : 3}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t('placeholder', { label: activeMeta.label })}
        />

        {form[activeSlot] ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('preview')}
            </p>
            <p
              className={
                activeSlot === 'slogan1'
                  ? 'mt-1 text-base font-semibold text-[#1a2b49]'
                  : activeSlot === 'slogan2'
                    ? 'mt-1 text-sm text-[#6b7280]'
                    : 'mt-1 text-sm text-foreground'
              }
            >
              {form[activeSlot]}
            </p>
          </div>
        ) : null}
      </div>

      {message ? (
        <p
          className={`text-sm ${
            message.type === 'error' ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t('save')}
      </button>
    </div>
  )
}
