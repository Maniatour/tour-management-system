'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import LightRichEditor, { markdownToHtml } from '@/components/LightRichEditor'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import { fetchProductDetailsRowForLocale } from '@/lib/fetchProductDetail'
import { getProductOverviewDescription } from '@/lib/productDetailDisplay'
import { normalizeAdminEditLocale, type AdminEditLocale } from '@/lib/adminEditLocales'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

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
  summary_ko: string
  summary_en: string
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
    summary_ko: '',
    summary_en: '',
  })
  const [productDescription, setProductDescription] = useState('')
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [row, productResult] = await Promise.all([
        fetchProductDetailsRowForLocale(productId, editLocale),
        supabase
          .from('products')
          .select('summary_ko, summary_en, description')
          .eq('id', productId)
          .maybeSingle(),
      ])

      if (productResult.error) throw productResult.error

      const productRow = (productResult.data ?? {}) as Record<string, unknown>
      const nextForm: OverviewForm = {
        greeting: String(row?.greeting ?? ''),
        description: String(row?.description ?? ''),
      }
      const nextVisibility: VisibilityForm = {
        greeting: readVisibility(row, 'greeting'),
        description: readVisibility(row, 'description'),
      }
      const nextSummary: SummaryForm = {
        summary_ko: String(productRow.summary_ko ?? ''),
        summary_en: String(productRow.summary_en ?? ''),
      }

      setRowId(row?.id ? String(row.id) : null)
      setForm(nextForm)
      setVisibility(nextVisibility)
      setSummaryForm(nextSummary)
      setProductDescription(String(productRow.description ?? ''))
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
      const existingVisibility =
        rowId != null
          ? ((
              await fromUntypedTable(supabase, 'product_details_multilingual')
                .select('customer_page_visibility')
                .eq('id', rowId)
                .maybeSingle()
            ).data as { customer_page_visibility?: Record<string, unknown> } | null)
          : null

      const mergedVisibility = {
        ...(existingVisibility?.customer_page_visibility ?? {}),
        greeting: visibility.greeting,
        description: visibility.description,
      }

      const payload = {
        greeting: form.greeting.trim() || null,
        description: form.description.trim() || null,
        customer_page_visibility: mergedVisibility,
        updated_at: new Date().toISOString(),
      }

      if (rowId) {
        const { error } = await fromUntypedTable(supabase, 'product_details_multilingual')
          .update(payload)
          .eq('id', rowId)
        if (error) throw error
      } else {
        const { data, error } = await fromUntypedTable(supabase, 'product_details_multilingual')
          .insert([
            {
              product_id: productId,
              language_code: editLocale,
              channel_id: null,
              variant_key: 'default',
              ...payload,
            },
          ])
          .select('id')
          .single()
        if (error) throw error
        setRowId(String((data as { id: string }).id))
      }

      const { error: productError } = await supabase
        .from('products')
        .update({
          summary_ko: summaryForm.summary_ko.trim() || null,
          summary_en: summaryForm.summary_en.trim() || null,
          updated_at: new Date().toISOString(),
        } as never)
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
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const activeMeta = OVERVIEW_SLOTS.find((slot) => slot.id === activeSlot) ?? OVERVIEW_SLOTS[0]

  const customerPreviewText = (() => {
    if (activeSlot === 'greeting') return form.greeting
    return getProductOverviewDescription(
      {
        summary_ko: summaryForm.summary_ko,
        summary_en: summaryForm.summary_en,
        description: productDescription,
      },
      form.description,
      editLocale,
      ''
    )
  })()

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            DB:{' '}
            <code className="rounded bg-muted px-1">product_details_multilingual</code>
            {rowId ? (
              <span className="ml-2 text-[11px]">행 ID: {rowId}</span>
            ) : (
              <span className="ml-2 text-amber-700">새 행 생성 예정</span>
            )}
          </p>
        </div>
        <AdminEditLocaleToggle
          value={editLocale}
          onChange={setEditLocale}
          groupLabel="투어 소개 편집 언어"
          koLabel="한국어"
          enLabel="English"
        />
      </div>

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
            고객 페이지 표시
          </label>
        </div>

        <LightRichEditor
          value={form[activeSlot]}
          onChange={(value) => setForm((prev) => ({ ...prev, [activeSlot]: value }))}
          height={activeSlot === 'greeting' ? 120 : 220}
          placeholder={`${activeMeta.label} 내용을 입력하세요`}
          enableResize
        />

        {activeSlot === 'description' && !form.description.trim() ? (
          <div className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/60 p-3">
            <p className="text-xs text-amber-900">
              상세정보 <code className="rounded bg-white/80 px-1">description</code>이 비어 있으면
              고객 페이지에 <code className="rounded bg-white/80 px-1">products.summary</code> 요약이
              표시됩니다.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">summary_ko</span>
                <textarea
                  value={summaryForm.summary_ko}
                  onChange={(e) =>
                    setSummaryForm((prev) => ({ ...prev, summary_ko: e.target.value }))
                  }
                  rows={3}
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">summary_en</span>
                <textarea
                  value={summaryForm.summary_en}
                  onChange={(e) =>
                    setSummaryForm((prev) => ({ ...prev, summary_en: e.target.value }))
                  }
                  rows={3}
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
          </div>
        ) : null}

        {customerPreviewText ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              고객 페이지 미리보기
            </p>
            <div
              className="prose prose-sm mt-1 max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(customerPreviewText) }}
            />
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
