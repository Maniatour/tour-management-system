'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Save, Search, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import ContentLibraryLocaleBadges from '@/components/admin/ContentLibraryLocaleBadges'
import LightRichEditor from '@/components/LightRichEditor'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import { getFaqLocalizedText } from '@/lib/productFaqLocales'
import { supabase } from '@/lib/supabase'
import {
  buildFaqLibraryPayload,
  faqDraftFromLibraryItem,
  fetchFaqLibrary,
  getFaqFilledLocales,
  type FaqLibraryItem,
} from '@/lib/reusableContentLibrary'
import type { SiteLocale } from '@/lib/siteLocales'

type FaqDraft = {
  name: string
  questionByLocale: Partial<Record<SiteLocale, string>>
  answerByLocale: Partial<Record<SiteLocale, string>>
}

function emptyFaqDraft(): FaqDraft {
  return { name: '', questionByLocale: {}, answerByLocale: {} }
}

type FaqLibraryManagerPanelProps = {
  onMutated?: () => void
  listMaxHeight?: string
}

export default function FaqLibraryManagerPanel({
  onMutated,
  listMaxHeight = 'max-h-[60vh]',
}: FaqLibraryManagerPanelProps) {
  const t = useTranslations('products.customerPageEdit.faqLibraryManager')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [faqs, setFaqs] = useState<FaqLibraryItem[]>([])
  const [selectedFaqId, setSelectedFaqId] = useState<string | null>(null)
  const [faqDraft, setFaqDraft] = useState<FaqDraft>(emptyFaqDraft)
  const [editLocale, setEditLocale] = useState<AdminEditLocale>('ko')

  const loadFaqs = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const rows = await fetchFaqLibrary(supabase as never, { activeOnly: false })
      setFaqs(rows)
    } catch (error) {
      console.error(error)
      setMessage(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadFaqs()
  }, [loadFaqs])

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return faqs.filter((item) => {
      if (item.is_active === false) return false
      if (!q) return true
      const hay = `${item.name} ${getFaqLocalizedText(item, 'question', 'ko')} ${getFaqLocalizedText(item, 'question', 'en')} ${getFaqLocalizedText(item, 'answer', 'ko')} ${getFaqLocalizedText(item, 'answer', 'en')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [faqs, search])

  const selectFaq = (item: FaqLibraryItem) => {
    setSelectedFaqId(item.id)
    setFaqDraft(faqDraftFromLibraryItem(item))
  }

  const startNewFaq = () => {
    setSelectedFaqId(null)
    setFaqDraft(emptyFaqDraft())
  }

  const currentFaqQuestion = faqDraft.questionByLocale[editLocale] ?? ''
  const currentFaqAnswer = faqDraft.answerByLocale[editLocale] ?? ''
  const localeLabel = getAdminEditLocaleLabel(editLocale)

  const saveFaq = async () => {
    const hasAnyLocale =
      Object.values(faqDraft.questionByLocale).some((v) => v?.trim()) &&
      Object.values(faqDraft.answerByLocale).some((v) => v?.trim())
    if (!hasAnyLocale) {
      setMessage(t('validationError'))
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        ...buildFaqLibraryPayload({
          name: faqDraft.name,
          questionByLocale: faqDraft.questionByLocale,
          answerByLocale: faqDraft.answerByLocale,
        }),
        updated_at: new Date().toISOString(),
      }

      if (selectedFaqId) {
        const { error } = await supabase
          .from('faq_library')
          .update(payload as never)
          .eq('id', selectedFaqId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('faq_library')
          .insert([payload] as never)
          .select('*')
          .single()
        if (error) throw error
        setSelectedFaqId(String((data as { id: string }).id))
      }
      setMessage(t('saveSuccess'))
      await loadFaqs()
      onMutated?.()
    } catch (error) {
      console.error(error)
      setMessage(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const deactivateFaq = async (id: string) => {
    if (!confirm(t('deactivateConfirm'))) return
    await supabase
      .from('faq_library')
      .update({ is_active: false } as never)
      .eq('id', id)
    if (selectedFaqId === id) startNewFaq()
    await loadFaqs()
    onMutated?.()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('hint')}</p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t('listTitle')}</h2>
            <button
              type="button"
              onClick={startNewFaq}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('newButton')}
            </button>
          </div>
          <div className={`${listMaxHeight} space-y-1.5 overflow-y-auto`}>
            {filteredFaqs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectFaq(item)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedFaqId === item.id
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 font-medium">
                    {item.name ||
                      getFaqLocalizedText(item, 'question', 'ko').slice(0, 60) ||
                      t('unnamed')}
                  </div>
                  <ContentLibraryLocaleBadges locales={getFaqFilledLocales(item)} />
                </div>
                <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {getFaqLocalizedText(item, 'question', 'ko') ||
                    getFaqLocalizedText(item, 'question', 'en')}
                </div>
              </button>
            ))}
            {filteredFaqs.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">{t('emptyList')}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {selectedFaqId ? t('editTitle') : t('newTitle')}
            </h2>
            <AdminEditLocaleToggle
              value={editLocale}
              onChange={(next) => setEditLocale(normalizeAdminEditLocale(next))}
              groupLabel={t('editLocaleGroup')}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{t('localeHint')}</p>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t('adminName')}</span>
            <input
              value={faqDraft.name}
              onChange={(e) => setFaqDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              placeholder={t('adminNamePlaceholder')}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t('question', { locale: localeLabel })}</span>
            <textarea
              value={currentFaqQuestion}
              onChange={(e) =>
                setFaqDraft((prev) => ({
                  ...prev,
                  questionByLocale: {
                    ...prev.questionByLocale,
                    [editLocale]: e.target.value,
                  },
                }))
              }
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t('answer', { locale: localeLabel })}</span>
            <LightRichEditor
              value={currentFaqAnswer}
              onChange={(value) =>
                setFaqDraft((prev) => ({
                  ...prev,
                  answerByLocale: {
                    ...prev.answerByLocale,
                    [editLocale]: value ?? '',
                  },
                }))
              }
              height={220}
              enableResize
            />
          </label>
          <ContentLibraryLocaleBadges
            locales={getFaqFilledLocales({
              content_i18n: {
                question: faqDraft.questionByLocale,
                answer: faqDraft.answerByLocale,
              },
            })}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveFaq()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('save')}
            </button>
            {selectedFaqId ? (
              <button
                type="button"
                onClick={() => void deactivateFaq(selectedFaqId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="h-4 w-4" />
                {t('deactivate')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
