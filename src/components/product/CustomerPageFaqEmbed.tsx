'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import LightRichEditor, { markdownToHtml } from '@/components/LightRichEditor'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  getFaqExactText,
  getFaqLocalizedText,
  mergeFaqI18n,
  type FaqContentI18n,
} from '@/lib/productFaqLocales'
import { supabase } from '@/lib/supabase'
import { useCustomerPageEditLabels } from '@/hooks/useCustomerPageEditLabels'
import { useModalEditorHeight } from '@/hooks/useModalEditorHeight'

type FaqItem = {
  id?: string
  product_id: string
  question: string
  answer: string
  question_en: string
  answer_en: string
  content_i18n?: FaqContentI18n | null
  order_index: number
  is_active: boolean
}

type FaqForm = {
  questionDraft: string
  answerDraft: string
  is_active: boolean
  content_i18n: FaqContentI18n
  question: string
  answer: string
  question_en: string
  answer_en: string
}

type CustomerPageFaqEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onOpenFullAdmin?: (tabId: string) => void
}

function emptyFaq(productId: string, orderIndex: number): FaqItem {
  return {
    product_id: productId,
    question: '',
    answer: '',
    question_en: '',
    answer_en: '',
    content_i18n: {},
    order_index: orderIndex,
    is_active: true,
  }
}

function faqToForm(item: FaqItem, locale: AdminEditLocale): FaqForm {
  return {
    questionDraft: getFaqExactText(item, 'question', locale),
    answerDraft: getFaqExactText(item, 'answer', locale),
    is_active: item.is_active !== false,
    content_i18n: item.content_i18n || {},
    question: item.question ?? '',
    answer: item.answer ?? '',
    question_en: item.question_en ?? '',
    answer_en: item.answer_en ?? '',
  }
}

function getFaqLabel(item: FaqItem, locale: AdminEditLocale, emptyLabel: string): string {
  return getFaqExactText(item, 'question', locale) || emptyLabel
}

function mergeFormLocale(
  form: FaqForm,
  locale: AdminEditLocale
): Omit<FaqForm, 'questionDraft' | 'answerDraft'> & {
  questionDraft: string
  answerDraft: string
} {
  const merged = mergeFaqI18n(
    {
      question: form.question,
      answer: form.answer,
      question_en: form.question_en,
      answer_en: form.answer_en,
      content_i18n: form.content_i18n,
    },
    locale,
    form.questionDraft,
    form.answerDraft
  )
  return {
    ...form,
    ...merged,
    question: merged.question,
    answer: merged.answer,
    question_en: merged.question_en || '',
    answer_en: merged.answer_en || '',
    questionDraft: form.questionDraft,
    answerDraft: form.answerDraft,
  }
}

export default function CustomerPageFaqEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
  onOpenFullAdmin,
}: CustomerPageFaqEmbedProps) {
  const { t, editorUiLocale } = useCustomerPageEditLabels()
  const tf = (key: string, values?: Record<string, string>) =>
    values ? t(`faqEmbed.${key}`, values) : t(`faqEmbed.${key}`)
  const editorHeight = useModalEditorHeight(320)
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )
  const editLocaleRef = useRef(editLocale)
  editLocaleRef.current = editLocale
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [activeFaqId, setActiveFaqId] = useState<string | null>(null)
  const [form, setForm] = useState<FaqForm>(() => faqToForm(emptyFaq(productId, 0), 'ko'))
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)
  const [isNewDraft, setIsNewDraft] = useState(false)

  const activeFaq = faqs.find((item) => item.id === activeFaqId) ?? null

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { data, error } = await supabase
        .from('product_faqs')
        .select('*')
        .eq('product_id', productId)
        .order('order_index', { ascending: true })

      if (error) throw error

      const items = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id ?? ''),
        product_id: String(row.product_id ?? productId),
        question: String(row.question ?? ''),
        answer: String(row.answer ?? ''),
        question_en: String(row.question_en ?? ''),
        answer_en: String(row.answer_en ?? ''),
        content_i18n: (row.content_i18n as FaqContentI18n) || {},
        order_index: Number(row.order_index ?? 0),
        is_active: row.is_active !== false,
      }))

      const visible = items.filter((item) => item.is_active)
      const first = visible[0] ?? items[0] ?? null

      setFaqs(items)
      setActiveFaqId(first?.id ?? null)
      setIsNewDraft(false)

      if (first) {
        const nextForm = faqToForm(first, editLocale)
        setForm(nextForm)
        setInitialSnapshot(
          JSON.stringify({ faqId: first.id, form: nextForm, locale: editLocale })
        )
      } else {
        setForm(faqToForm(emptyFaq(productId, 0), editLocale))
        setInitialSnapshot(JSON.stringify({ faqId: null, form: {}, locale: editLocale }))
      }
    } catch (error) {
      console.error('FAQ 로드 오류:', error)
      setMessage({ text: tf('loadError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [editLocale, productId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (isNewDraft || !activeFaq) return
    const nextForm = faqToForm(activeFaq, editLocale)
    setForm(nextForm)
    setInitialSnapshot(
      JSON.stringify({ faqId: activeFaq.id, form: nextForm, locale: editLocale })
    )
  }, [activeFaq?.id])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot) return
    const dirty =
      JSON.stringify({ faqId: activeFaqId, form, locale: editLocale, isNewDraft }) !==
      initialSnapshot
    onDirtyChange(dirty)
  }, [activeFaqId, editLocale, form, initialSnapshot, isNewDraft, onDirtyChange])

  const switchLocale = (next: AdminEditLocale) => {
    if (next === editLocaleRef.current) return
    const merged = mergeFormLocale(form, editLocale)
    const source = {
      question: merged.question,
      answer: merged.answer,
      question_en: merged.question_en,
      answer_en: merged.answer_en,
      content_i18n: merged.content_i18n,
    }
    setForm({
      ...merged,
      questionDraft: getFaqExactText(source, 'question', next),
      answerDraft: getFaqExactText(source, 'answer', next),
    })
    setEditLocale(next)
  }

  useEffect(() => {
    switchLocale(normalizeAdminEditLocale(localeProp ?? 'ko'))
    // Parent header owns locale; sync drafts when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only localeProp
  }, [localeProp])

  const handleSave = async () => {
    const merged = mergeFormLocale(form, editLocale)
    const hasQ =
      !!getFaqLocalizedText(merged, 'question', 'ko') ||
      !!getFaqLocalizedText(merged, 'question', 'en')
    const hasA =
      !!getFaqLocalizedText(merged, 'answer', 'ko') ||
      !!getFaqLocalizedText(merged, 'answer', 'en')
    if (!hasQ || !hasA) {
      setMessage({ text: tf('validationError'), type: 'error' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        product_id: productId,
        question: merged.question,
        answer: merged.answer,
        question_en: merged.question_en.trim() || null,
        answer_en: merged.answer_en.trim() || null,
        content_i18n: merged.content_i18n || {},
        is_active: merged.is_active,
        updated_at: new Date().toISOString(),
      }

      if (activeFaqId && !isNewDraft) {
        const { error } = await supabase
          .from('product_faqs')
          .update(payload as never)
          .eq('id', activeFaqId)
        if (error) throw error

        const updatedItem: FaqItem = {
          id: activeFaqId,
          product_id: productId,
          question: merged.question,
          answer: merged.answer,
          question_en: merged.question_en,
          answer_en: merged.answer_en,
          content_i18n: merged.content_i18n,
          order_index: activeFaq?.order_index ?? 0,
          is_active: merged.is_active,
        }
        setFaqs((prev) =>
          prev.map((item) => (item.id === activeFaqId ? updatedItem : item))
        )
        const nextForm = faqToForm(updatedItem, editLocale)
        setForm(nextForm)
        setInitialSnapshot(
          JSON.stringify({
            faqId: activeFaqId,
            form: nextForm,
            locale: editLocale,
            isNewDraft: false,
          })
        )
      } else {
        const orderIndex = faqs.length
        const { data, error } = await supabase
          .from('product_faqs')
          .insert([{ ...payload, order_index: orderIndex }] as never)
          .select('*')
          .single()
        if (error) throw error

        const created = data as Record<string, unknown>
        const newItem: FaqItem = {
          id: String(created.id),
          product_id: productId,
          question: merged.question,
          answer: merged.answer,
          question_en: merged.question_en,
          answer_en: merged.answer_en,
          content_i18n: (created.content_i18n as FaqContentI18n) || merged.content_i18n,
          order_index: orderIndex,
          is_active: merged.is_active,
        }
        setFaqs((prev) => [...prev, newItem])
        setActiveFaqId(newItem.id!)
        setIsNewDraft(false)
        const nextForm = faqToForm(newItem, editLocale)
        setForm(nextForm)
        setInitialSnapshot(
          JSON.stringify({
            faqId: newItem.id,
            form: nextForm,
            locale: editLocale,
            isNewDraft: false,
          })
        )
      }

      setMessage({ text: tf('saved'), type: 'success' })
      onSaved?.()
    } catch (error) {
      console.error('FAQ 저장 오류:', error)
      setMessage({ text: tf('saveError'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = () => {
    const draft = emptyFaq(productId, faqs.length)
    setActiveFaqId(null)
    setIsNewDraft(true)
    setForm(faqToForm(draft, editLocale))
  }

  const handleDelete = async () => {
    if (!activeFaqId || isNewDraft) {
      setIsNewDraft(false)
      setActiveFaqId(faqs[0]?.id ?? null)
      if (faqs[0]) setForm(faqToForm(faqs[0], editLocale))
      return
    }
    if (!confirm(tf('deleteConfirm'))) return

    setSaving(true)
    try {
      const { error } = await supabase.from('product_faqs').delete().eq('id', activeFaqId)
      if (error) throw error
      const remaining = faqs.filter((item) => item.id !== activeFaqId)
      setFaqs(remaining)
      const next = remaining[0] ?? null
      setActiveFaqId(next?.id ?? null)
      if (next) setForm(faqToForm(next, editLocale))
      setMessage({ text: tf('saved'), type: 'success' })
      onSaved?.()
    } catch (error) {
      console.error('FAQ 삭제 오류:', error)
      setMessage({ text: tf('deleteError'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const moveFaq = async (direction: 'up' | 'down') => {
    if (!activeFaqId || isNewDraft) return
    const index = faqs.findIndex((item) => item.id === activeFaqId)
    if (index < 0) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= faqs.length) return

    const reordered = [...faqs]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)
    const withOrder = reordered.map((item, idx) => ({ ...item, order_index: idx }))
    setFaqs(withOrder)

    try {
      await Promise.all(
        withOrder.map((item) =>
          item.id
            ? supabase
                .from('product_faqs')
                .update({ order_index: item.order_index } as never)
                .eq('id', item.id)
            : Promise.resolve()
        )
      )
      onSaved?.()
    } catch (error) {
      console.error('FAQ 순서 변경 오류:', error)
      setMessage({ text: tf('reorderError'), type: 'error' })
      void loadData()
    }
  }

  const localeLabel = getAdminEditLocaleLabel(editLocale)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tf('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          DB: <code className="rounded bg-muted px-1">product_faqs</code>
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          {tf('add')}
        </button>
      </div>

      {faqs.length === 0 && !isNewDraft ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
          <HelpCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{tf('empty')}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {faqs.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setIsNewDraft(false)
                setActiveFaqId(item.id ?? null)
                setForm(faqToForm(item, editLocale))
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                !isNewDraft && activeFaqId === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              Q{index + 1}. {getFaqLabel(item, editLocale, tf('noQuestion'))}
            </button>
          ))}
          {isNewDraft ? (
            <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              {tf('newFaq')}
            </span>
          ) : null}
        </div>
      )}

      {(activeFaqId || isNewDraft) && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {tf('editTitle', { locale: localeLabel })}
            </h4>
            <div className="flex items-center gap-1">
              {!isNewDraft && activeFaqId ? (
                <>
                  <button
                    type="button"
                    onClick={() => void moveFaq('up')}
                    className="rounded-md border border-border p-1 hover:bg-muted"
                    aria-label={tf('moveUp')}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void moveFaq('down')}
                    className="rounded-md border border-border p-1 hover:bg-muted"
                    aria-label={tf('moveDown')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-md border border-border p-1 text-red-600 hover:bg-red-50"
                aria-label={tf('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
            />
            {tf('showActive')}
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium">
              {tf('question', { locale: localeLabel })}
            </span>
            <input
              value={form.questionDraft}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, questionDraft: e.target.value }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              placeholder={tf('questionPlaceholder')}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium">
              {tf('answer', { locale: localeLabel })}
            </span>
            <LightRichEditor
              value={form.answerDraft}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, answerDraft: value ?? '' }))
              }
              height={editorHeight}
              placeholder={tf('answerPlaceholder')}
              enableResize
              uiLocale={editorUiLocale}
              maxHeight={1200}
            />
          </label>

          {form.answerDraft ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {tf('preview')}
              </p>
              <div
                className="prose prose-sm mt-1 max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(form.answerDraft) }}
              />
            </div>
          ) : null}
        </div>
      )}

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
        disabled={saving || (!activeFaqId && !isNewDraft)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {tf('save')}
      </button>

      {onOpenFullAdmin ? (
        <button
          type="button"
          onClick={() => onOpenFullAdmin('faq')}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          {tf('openFullAdmin')}
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
