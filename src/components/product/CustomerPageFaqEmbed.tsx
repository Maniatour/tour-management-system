'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Library,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import ContentLibraryLocaleBadges from '@/components/admin/ContentLibraryLocaleBadges'
import FaqLibraryManagerPanel from '@/components/admin/FaqLibraryManagerPanel'
import LightRichEditor from '@/components/LightRichEditor'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  getFaqLocalizedText,
  mergeFaqI18n,
  resolveFaqEditorDraftForLocale,
  type FaqContentI18n,
} from '@/lib/productFaqLocales'
import {
  fetchFaqLibrary,
  fetchProductAttachedFaqs,
  getFaqFilledLocales,
  type FaqLibraryItem,
} from '@/lib/reusableContentLibrary'
import { supabase } from '@/lib/supabase'
import { useCustomerPageEditLabels } from '@/hooks/useCustomerPageEditLabels'
import { useModalEditorHeight } from '@/hooks/useModalEditorHeight'

type FaqItem = {
  /** faq_library.id */
  id?: string
  link_id?: string
  product_id: string
  name?: string
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
    // Prefer selected locale, then en → ko (same as customer page)
    questionDraft: getFaqLocalizedText(item, 'question', locale),
    answerDraft: getFaqLocalizedText(item, 'answer', locale),
    is_active: item.is_active !== false,
    content_i18n: item.content_i18n || {},
    question: item.question ?? '',
    answer: item.answer ?? '',
    question_en: item.question_en ?? '',
    answer_en: item.answer_en ?? '',
  }
}

function getFaqLabel(item: FaqItem, locale: AdminEditLocale, emptyLabel: string): string {
  return getFaqLocalizedText(item, 'question', locale).trim() || emptyLabel
}

function faqsSnapshot(items: FaqItem[]) {
  return items.map((item) => ({
    id: item.id ?? null,
    link_id: item.link_id ?? null,
    order_index: item.order_index,
    is_active: item.is_active,
  }))
}

function buildEditorSnapshot(
  faqId: string | null,
  form: FaqForm,
  locale: AdminEditLocale,
  isNewDraft: boolean,
  items: FaqItem[]
) {
  return JSON.stringify({
    faqId,
    form,
    locale,
    isNewDraft,
    faqs: faqsSnapshot(items),
  })
}
function buildLibraryPayload(
  merged: ReturnType<typeof mergeFormLocale>,
  nameFallback?: string
) {
  const name =
    merged.question.trim().slice(0, 120) || nameFallback || 'FAQ'
  return {
    name,
    question: merged.question,
    answer: merged.answer,
    question_en: merged.question_en.trim() || null,
    answer_en: merged.answer_en.trim() || null,
    content_i18n: merged.content_i18n || {},
    is_active: merged.is_active,
    updated_at: new Date().toISOString(),
  }
}

function applyMergedFormToFaq(item: FaqItem, merged: ReturnType<typeof mergeFormLocale>): FaqItem {
  return {
    ...item,
    name: merged.question.trim().slice(0, 120) || item.name || 'FAQ',
    question: merged.question,
    answer: merged.answer,
    question_en: merged.question_en,
    answer_en: merged.answer_en,
    content_i18n: merged.content_i18n,
    is_active: merged.is_active,
  }
}

function mergeFormLocale(
  form: FaqForm,
  locale: AdminEditLocale
): Omit<FaqForm, 'questionDraft' | 'answerDraft'> & {
  questionDraft: string
  answerDraft: string
} {
  const source = {
    question: form.question,
    answer: form.answer,
    question_en: form.question_en,
    answer_en: form.answer_en,
    content_i18n: form.content_i18n,
  }
  const merged = mergeFaqI18n(
    source,
    locale,
    resolveFaqEditorDraftForLocale(source, 'question', locale, form.questionDraft),
    resolveFaqEditorDraftForLocale(source, 'answer', locale, form.answerDraft)
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
}: CustomerPageFaqEmbedProps) {
  const { t, editorUiLocale } = useCustomerPageEditLabels()
  const tf = (key: string, values?: Record<string, string>) =>
    values ? t(`faqEmbed.${key}`, values) : t(`faqEmbed.${key}`)
  const { height: editorHeight, measureRef: editorMeasureRef } = useModalEditorHeight(80)
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
  const [showLibraryPicker, setShowLibraryPicker] = useState(false)
  const [libraryItems, setLibraryItems] = useState<FaqLibraryItem[]>([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set())
  const [showLibraryManager, setShowLibraryManager] = useState(false)

  const syncActiveFormToFaqs = useCallback(() => {
    if (!activeFaqId || isNewDraft) return
    const merged = mergeFormLocale(form, editLocale)
    setFaqs((prev) =>
      prev.map((item) =>
        item.id === activeFaqId
          ? {
              ...item,
              question: merged.question,
              answer: merged.answer,
              question_en: merged.question_en,
              answer_en: merged.answer_en,
              content_i18n: merged.content_i18n,
              is_active: merged.is_active,
            }
          : item
      )
    )
  }, [activeFaqId, editLocale, form, isNewDraft])

  const activeFaq = faqs.find((item) => item.id === activeFaqId) ?? null

  const selectFaq = (item: FaqItem) => {
    syncActiveFormToFaqs()
    setIsNewDraft(false)
    setActiveFaqId(item.id ?? null)
    setForm(faqToForm(item, editLocale))
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const attached = await fetchProductAttachedFaqs(supabase as never, productId, {
        includeInactive: true,
      })

      const items: FaqItem[] = attached.map((row) => ({
        id: row.id,
        link_id: row.link_id,
        product_id: row.product_id,
        name: row.name,
        question: row.question ?? '',
        answer: row.answer ?? '',
        question_en: row.question_en ?? '',
        answer_en: row.answer_en ?? '',
        content_i18n: row.content_i18n || {},
        order_index: row.order_index,
        is_active: row.is_active !== false && row.link_is_active !== false,
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
          buildEditorSnapshot(first.id ?? null, nextForm, editLocale, false, items)
        )
      } else {
        setForm(faqToForm(emptyFaq(productId, 0), editLocale))
        setInitialSnapshot(buildEditorSnapshot(null, faqToForm(emptyFaq(productId, 0), editLocale), editLocale, false, []))
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
    setForm(faqToForm(activeFaq, editLocale))
  }, [activeFaq?.id, editLocale, activeFaq, isNewDraft])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot) return
    const dirty =
      buildEditorSnapshot(activeFaqId, form, editLocale, isNewDraft, faqs) !== initialSnapshot
    onDirtyChange(dirty)
  }, [activeFaqId, editLocale, form, initialSnapshot, isNewDraft, onDirtyChange, faqs])

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
      questionDraft: getFaqLocalizedText(source, 'question', next),
      answerDraft: getFaqLocalizedText(source, 'answer', next),
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
    const hasPendingLinks = faqs.some((item) => item.id && !item.link_id)

    if (isNewDraft) {
      if (!hasQ || !hasA) {
        setMessage({ text: tf('validationError'), type: 'error' })
        return
      }
    } else if (activeFaqId) {
      if (!hasQ || !hasA) {
        setMessage({ text: tf('validationError'), type: 'error' })
        return
      }
    } else if (!hasPendingLinks) {
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      if (isNewDraft) {
        const libraryPayload = buildLibraryPayload(merged, activeFaq?.name)
        const orderIndex = faqs.length
        const { data, error } = await supabase
          .from('faq_library')
          .insert([libraryPayload] as never)
          .select('*')
          .single()
        if (error) throw error

        const created = data as Record<string, unknown>
        const { data: link, error: linkError } = await supabase
          .from('product_faq_links')
          .insert([
            {
              product_id: productId,
              faq_id: created.id,
              order_index: orderIndex,
              is_active: true,
            },
          ] as never)
          .select('*')
          .single()
        if (linkError) throw linkError

        const newItem: FaqItem = {
          id: String(created.id),
          link_id: String((link as Record<string, unknown>).id),
          product_id: productId,
          name: libraryPayload.name,
          question: merged.question,
          answer: merged.answer,
          question_en: merged.question_en,
          answer_en: merged.answer_en,
          content_i18n: (created.content_i18n as FaqContentI18n) || merged.content_i18n,
          order_index: orderIndex,
          is_active: merged.is_active,
        }
        const nextFaqs = [...faqs, newItem]
        setFaqs(nextFaqs)
        setActiveFaqId(newItem.id!)
        setIsNewDraft(false)
        const nextForm = faqToForm(newItem, editLocale)
        setForm(nextForm)
        setInitialSnapshot(
          buildEditorSnapshot(newItem.id ?? null, nextForm, editLocale, false, nextFaqs)
        )
        setMessage({ text: tf('saved'), type: 'success' })
        onSaved?.()
        return
      }

      let nextFaqs = [...faqs]
      if (activeFaqId) {
        nextFaqs = nextFaqs.map((item) =>
          item.id === activeFaqId ? applyMergedFormToFaq(item, merged) : item
        )
      }

      const libraryPayload = buildLibraryPayload(merged, activeFaq?.name)
      const activeInList = activeFaqId
        ? nextFaqs.find((item) => item.id === activeFaqId) ?? null
        : null

      if (activeFaqId && activeInList?.link_id) {
        const savedLinkId = activeInList.link_id
        const { error } = await supabase
          .from('faq_library')
          .update(libraryPayload as never)
          .eq('id', activeFaqId)
        if (error) throw error

        await supabase
          .from('product_faq_links')
          .update({
            is_active: merged.is_active,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', savedLinkId)

        nextFaqs = nextFaqs.map((item) =>
          item.id === activeFaqId
            ? {
                ...applyMergedFormToFaq(item, merged),
                link_id: savedLinkId,
                order_index: activeInList.order_index,
              }
            : item
        )
      }

      const pendingItems = nextFaqs.filter((item) => item.id && !item.link_id)
      if (pendingItems.length > 0) {
        if (activeFaqId && pendingItems.some((item) => item.id === activeFaqId)) {
          const { error } = await supabase
            .from('faq_library')
            .update(libraryPayload as never)
            .eq('id', activeFaqId)
          if (error) throw error
        }

        const { data: links, error: linkError } = await supabase
          .from('product_faq_links')
          .insert(
            pendingItems.map((item) => ({
              product_id: productId,
              faq_id: item.id!,
              order_index: item.order_index,
              is_active: item.is_active,
            })) as never
          )
          .select('*')
        if (linkError) throw linkError

        const linkByFaqId = new Map(
          ((links || []) as Record<string, unknown>[]).map((link) => [
            String(link.faq_id),
            String(link.id),
          ])
        )

        nextFaqs = nextFaqs.map((item) => {
          if (!item.id || item.link_id) return item
          const linkId = linkByFaqId.get(item.id)
          return linkId ? { ...item, link_id: linkId } : item
        })
      }

      setFaqs(nextFaqs)
      const resolvedActive =
        (activeFaqId ? nextFaqs.find((item) => item.id === activeFaqId) : null) ??
        nextFaqs[0] ??
        null
      if (resolvedActive) {
        const nextForm = faqToForm(resolvedActive, editLocale)
        setForm(nextForm)
        setActiveFaqId(resolvedActive.id ?? null)
        setIsNewDraft(false)
        setInitialSnapshot(
          buildEditorSnapshot(resolvedActive.id ?? null, nextForm, editLocale, false, nextFaqs)
        )
      } else {
        setInitialSnapshot(buildEditorSnapshot(null, form, editLocale, false, nextFaqs))
      }

      setMessage({
        text:
          pendingItems.length > 1
            ? tf('savedBatch', { count: String(pendingItems.length) })
            : tf('saved'),
        type: 'success',
      })
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

  const openLibraryPicker = async () => {
    setShowLibraryPicker(true)
    setSelectedLibraryIds(new Set())
    setLibraryLoading(true)
    try {
      const rows = await fetchFaqLibrary(supabase as never, {
        activeOnly: true,
        search: librarySearch,
      })
      const attachedIds = new Set(faqs.map((item) => item.id).filter(Boolean))
      setLibraryItems(rows.filter((row) => !attachedIds.has(row.id)))
    } catch (error) {
      console.error('FAQ library load error:', error)
      setMessage({ text: tf('libraryLoadError'), type: 'error' })
    } finally {
      setLibraryLoading(false)
    }
  }

  const toggleLibrarySelection = (faqId: string) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev)
      if (next.has(faqId)) next.delete(faqId)
      else next.add(faqId)
      return next
    })
  }

  const toggleSelectAllLibrary = () => {
    setSelectedLibraryIds((prev) => {
      if (prev.size === libraryItems.length) return new Set()
      return new Set(libraryItems.map((item) => item.id))
    })
  }

  const attachSelectedLibraryFaqs = () => {
    const selectedItems = libraryItems.filter((row) => selectedLibraryIds.has(row.id))
    if (selectedItems.length === 0) {
      setMessage({ text: tf('libraryNoneSelected'), type: 'error' })
      return
    }

    const orderBase = faqs.length
    const newAttached: FaqItem[] = selectedItems.map((item, idx) => ({
      id: item.id,
      product_id: productId,
      name: item.name,
      question: item.question,
      answer: item.answer,
      question_en: item.question_en ?? '',
      answer_en: item.answer_en ?? '',
      content_i18n: item.content_i18n || {},
      order_index: orderBase + idx,
      is_active: true,
    }))

    const nextFaqs = [...faqs, ...newAttached]
    const lastItem = newAttached[newAttached.length - 1]!
    setFaqs(nextFaqs)
    setActiveFaqId(lastItem.id!)
    setIsNewDraft(false)
    setForm(faqToForm(lastItem, editLocale))
    setShowLibraryPicker(false)
    setSelectedLibraryIds(new Set())
    setMessage({
      text:
        newAttached.length === 1
          ? tf('libraryAttachedDraft')
          : tf('libraryAttachedDraftCount', { count: String(newAttached.length) }),
      type: 'success',
    })
  }

  const handleDelete = async () => {
    if (!activeFaqId || isNewDraft) {
      setIsNewDraft(false)
      setActiveFaqId(faqs[0]?.id ?? null)
      if (faqs[0]) setForm(faqToForm(faqs[0], editLocale))
      return
    }

    if (!activeFaq?.link_id) {
      const remaining = faqs.filter((item) => item.id !== activeFaqId)
      setFaqs(remaining)
      const next = remaining[0] ?? null
      setActiveFaqId(next?.id ?? null)
      if (next) setForm(faqToForm(next, editLocale))
      setMessage({ text: tf('libraryAttachCancelled'), type: 'success' })
      return
    }

    if (!confirm(tf('deleteConfirm'))) return

    setSaving(true)
    try {
      const linkId = activeFaq?.link_id
      if (!linkId) throw new Error('link missing')
      const { error } = await supabase.from('product_faq_links').delete().eq('id', linkId)
      if (error) throw error
      const remaining = faqs.filter((item) => item.id !== activeFaqId)
      setFaqs(remaining)
      const next = remaining[0] ?? null
      setActiveFaqId(next?.id ?? null)
      if (next) setForm(faqToForm(next, editLocale))
      setInitialSnapshot(
        buildEditorSnapshot(
          next?.id ?? null,
          next ? faqToForm(next, editLocale) : form,
          editLocale,
          false,
          remaining
        )
      )
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
      const linkedUpdates = withOrder.filter((item) => item.link_id)
      if (linkedUpdates.length > 0) {
        await Promise.all(
          linkedUpdates.map((item) =>
            supabase
              .from('product_faq_links')
              .update({ order_index: item.order_index } as never)
              .eq('id', item.link_id!)
          )
        )
        onSaved?.()
      }
      setInitialSnapshot(
        buildEditorSnapshot(activeFaqId, form, editLocale, isNewDraft, withOrder)
      )
    } catch (error) {
      console.error('FAQ 순서 변경 오류:', error)
      setMessage({ text: tf('reorderError'), type: 'error' })
      void loadData()
    }
  }

  const refreshAfterLibraryChange = useCallback(async () => {
    await loadData()
    onSaved?.()
  }, [loadData, onSaved])

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
        <p className="text-xs text-muted-foreground">{tf('libraryHint')}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void openLibraryPicker()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <Library className="h-3.5 w-3.5" />
            {tf('addFromLibrary')}
          </button>
          <button
            type="button"
            onClick={() => setShowLibraryManager(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
            title={tf('manageLibraryTitle')}
          >
            {tf('manageLibrary')}
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            {tf('add')}
          </button>
        </div>
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
              key={`${item.id ?? 'draft'}-${item.link_id ?? 'pending'}-${index}`}
              type="button"
              onClick={() => selectFaq(item)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                !isNewDraft && activeFaqId === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted'
              } ${!item.link_id ? 'border-dashed border-amber-300' : ''}`}
            >
              Q{index + 1}. {getFaqLabel(item, editLocale, tf('noQuestion'))}
              {!item.link_id ? ` (${tf('unsaved')})` : ''}
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
            <div ref={editorMeasureRef}>
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
            </div>
          </label>
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
        disabled={
          saving ||
          (!isNewDraft &&
            !activeFaqId &&
            !faqs.some((item) => item.id && !item.link_id))
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {tf('save')}
      </button>

      {showLibraryPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">{tf('libraryPickerTitle')}</h3>
              <button
                type="button"
                onClick={() => setShowLibraryPicker(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={tf('libraryClose')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 border-b border-border px-4 py-3">
              <input
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void openLibraryPicker()
                }}
                placeholder={tf('librarySearchPlaceholder')}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void openLibraryPicker()}
                className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80"
              >
                {tf('librarySearch')}
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {libraryLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tf('libraryLoading')}
                </div>
              ) : libraryItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {tf('libraryEmpty')}
                </p>
              ) : (
                <>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={
                        libraryItems.length > 0 &&
                        selectedLibraryIds.size === libraryItems.length
                      }
                      onChange={toggleSelectAllLibrary}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                    />
                    {selectedLibraryIds.size === libraryItems.length
                      ? tf('libraryDeselectAll')
                      : tf('librarySelectAll')}
                  </label>
                  {libraryItems.map((item) => {
                    const checked = selectedLibraryIds.has(item.id)
                    return (
                      <label
                        key={item.id}
                        className={`flex w-full cursor-pointer gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          checked
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLibrarySelection(item.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-ring"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium text-foreground">
                              {item.name || item.question.slice(0, 80) || tf('libraryUnnamed')}
                            </div>
                            <ContentLibraryLocaleBadges locales={getFaqFilledLocales(item)} />
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {getFaqLocalizedText(item, 'question', editLocale) || item.question}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {tf('librarySelectedCount', { count: String(selectedLibraryIds.size) })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLibraryPicker(false)
                    setSelectedLibraryIds(new Set())
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  {tf('libraryClose')}
                </button>
                <button
                  type="button"
                  onClick={attachSelectedLibraryFaqs}
                  disabled={saving || selectedLibraryIds.size === 0}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {tf('libraryAddSelected', { count: String(selectedLibraryIds.size) })}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showLibraryManager ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">{tf('manageLibraryTitle')}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowLibraryManager(false)
                  void refreshAfterLibraryChange()
                }}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={tf('libraryClose')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <FaqLibraryManagerPanel
                listMaxHeight="max-h-[50vh]"
                onMutated={() => void refreshAfterLibraryChange()}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
