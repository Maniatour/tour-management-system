'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import { fetchProductDetailsForAdminEdit } from '@/lib/fetchProductDetail'
import { useCustomerPageEditLabels } from '@/hooks/useCustomerPageEditLabels'
import { useModalEditorHeight } from '@/hooks/useModalEditorHeight'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  fetchDefaultProductDetailsCustomerPageVisibility,
  formatSupabaseError,
  upsertDefaultProductDetailsMultilingual,
} from '@/lib/productDetailsMultilingualAdmin'
import {
  buildProductTranslationMap,
  fetchProductFieldTranslations,
  upsertProductFieldTranslations,
} from '@/lib/productFieldTranslations'
import { isLegacyColumnLocale } from '@/lib/siteLocales'
import { supabase } from '@/lib/supabase'

const OVERVIEW_SLOTS = [
  {
    id: 'greeting' as const,
    label: '인사말',
    hint: '투어 소개 탭 상단 인사 문구',
    column: 'greeting',
  },
  {
    id: 'description' as const,
    label: '투어 설명',
    hint: '투어 소개 탭 본문 (description 우선, 없으면 요약 필드)',
    column: 'description',
  },
]

type OverviewKey = (typeof OVERVIEW_SLOTS)[number]['id']

type OverviewForm = Record<OverviewKey, string>

type VisibilityForm = Record<OverviewKey, boolean>

type SummaryForm = {
  summary: string
}

type CustomerPageOverviewEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

function readVisibility(row: Record<string, unknown> | null, key: OverviewKey): boolean {
  const raw = row?.customer_page_visibility
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  return (raw as Record<string, unknown>)[key] !== false
}

export default function CustomerPageOverviewEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
}: CustomerPageOverviewEmbedProps) {
  const { showOnCustomerPage, editorUiLocale, contentPlaceholder } = useCustomerPageEditLabels()
  const { height: editorHeight, measureRef: editorMeasureRef } = useModalEditorHeight(120)
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )
  const [activeSlot, setActiveSlot] = useState<OverviewKey>('greeting')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rowId, setRowId] = useState<string | null>(null)
  const [form, setForm] = useState<OverviewForm>({ greeting: '', description: '' })
  const [visibility, setVisibility] = useState<VisibilityForm>({
    greeting: true,
    description: true,
  })
  const [summaryForm, setSummaryForm] = useState<SummaryForm>({
    summary: '',
  })
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)

  useEffect(() => {
    setEditLocale(normalizeAdminEditLocale(localeProp ?? 'ko'))
  }, [localeProp])

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [details, productResult, translationRows] = await Promise.all([
        fetchProductDetailsForAdminEdit(productId, editLocale),
        supabase
          .from('products')
          .select('summary_ko, summary_en')
          .eq('id', productId)
          .maybeSingle(),
        fetchProductFieldTranslations(productId),
      ])

      if (productResult.error) throw productResult.error

      const { row, values } = details
      const productRow = (productResult.data ?? {}) as Record<string, unknown>
      const nextForm: OverviewForm = {
        greeting: String(values.greeting ?? ''),
        description: String(values.description ?? ''),
      }
      const nextVisibility: VisibilityForm = {
        greeting: readVisibility(values, 'greeting'),
        description: readVisibility(values, 'description'),
      }
      const summaryMap = buildProductTranslationMap(productRow, translationRows).summary || {}
      const nextSummary: SummaryForm = {
        summary:
          summaryMap[editLocale] ||
          summaryMap.en ||
          summaryMap.ko ||
          '',
      }

      setRowId(row?.id ? String(row.id) : null)
      setForm(nextForm)
      setVisibility(nextVisibility)
      setSummaryForm(nextSummary)
      setInitialSnapshot(
        JSON.stringify({
          form: nextForm,
          visibility: nextVisibility,
          summary: nextSummary,
          locale: editLocale,
        })
      )
    } catch (error) {
      console.error('투어 소개 로드 오류:', error)
      setMessage('투어 소개 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [editLocale, productId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot) return
    const dirty =
      JSON.stringify({
        form,
        visibility,
        summary: summaryForm,
        locale: editLocale,
      }) !== initialSnapshot
    onDirtyChange(dirty)
  }, [editLocale, form, initialSnapshot, onDirtyChange, summaryForm, visibility])

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
        greeting: visibility.greeting,
        description: visibility.description,
      }

      const payload = {
        greeting: form.greeting.trim() || null,
        description: form.description.trim() || null,
        customer_page_visibility: mergedVisibility,
      }

      const { id: savedRowId } = await upsertDefaultProductDetailsMultilingual(supabase, {
        productId,
        languageCode: editLocale,
        existingRowId: rowId,
        patch: payload,
      })
      setRowId(savedRowId)

      const legacyPatch = await upsertProductFieldTranslations({
        productId,
        locale: editLocale,
        values: { summary: summaryForm.summary },
      })
      const productUpdate: Record<string, unknown> = {
        ...legacyPatch,
      }
      if (isLegacyColumnLocale(editLocale)) {
        if (editLocale === 'ko') productUpdate.summary_ko = summaryForm.summary.trim() || null
        else productUpdate.summary_en = summaryForm.summary.trim() || null
      }
      const { error: productError } = await supabase
        .from('products')
        .update(productUpdate as never)
        .eq('id', productId)
      if (productError) throw productError

      setInitialSnapshot(
        JSON.stringify({
          form,
          visibility,
          summary: summaryForm,
          locale: editLocale,
        })
      )
      setMessage('저장되었습니다.')
      onSaved?.()
    } catch (error) {
      console.error('투어 소개 저장 오류:', error)
      setMessage(`저장 중 오류가 발생했습니다. ${formatSupabaseError(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const activeMeta = OVERVIEW_SLOTS.find((slot) => slot.id === activeSlot) ?? OVERVIEW_SLOTS[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        투어 소개 불러오는 중…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        DB: <code className="rounded bg-muted px-1">product_details_multilingual</code>
        {rowId ? (
          <span className="ml-2 text-[11px]">행 ID: {rowId}</span>
        ) : (
          <span className="ml-2 text-amber-700">새 행 생성 예정</span>
        )}
      </p>

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-1">
        {OVERVIEW_SLOTS.map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => setActiveSlot(slot.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeSlot === slot.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-white hover:text-foreground'
            }`}
          >
            {slot.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground">{activeMeta.label}</h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              컬럼: <code className="rounded bg-muted px-1">{activeMeta.column}</code> ·{' '}
              {activeMeta.hint}
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
            {showOnCustomerPage}
          </label>
        </div>

        <div ref={editorMeasureRef}>
          <LightRichEditor
            value={form[activeSlot]}
            onChange={(value) => setForm((prev) => ({ ...prev, [activeSlot]: value }))}
            height={activeSlot === 'greeting' ? Math.min(180, editorHeight) : editorHeight}
            placeholder={contentPlaceholder(activeMeta.label)}
            enableResize
            uiLocale={editorUiLocale}
            maxHeight={1200}
          />
        </div>

        {activeSlot === 'description' && !form.description.trim() ? (
          <div className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/60 p-3">
            <p className="text-xs text-amber-900">
              상세정보 <code className="rounded bg-white/80 px-1">description</code>이 비어 있으면
              고객 페이지에 <code className="rounded bg-white/80 px-1">products.summary</code> 요약이
              표시됩니다.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-foreground">
                summary ({getAdminEditLocaleLabel(editLocale)})
              </span>
              <textarea
                value={summaryForm.summary}
                onChange={(e) => setSummaryForm({ summary: e.target.value })}
                rows={3}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        ) : null}

      </div>

      {message ? (
        <p className={`text-sm ${message.includes('오류') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        저장
      </button>
    </div>
  )
}
