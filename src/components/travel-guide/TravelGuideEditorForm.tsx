'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Save, Trash2 } from 'lucide-react'
import { useContext } from 'react'
import LightRichEditor from '@/components/LightRichEditor'
import TravelGuideCategoryCombobox from '@/components/travel-guide/TravelGuideCategoryCombobox'
import TravelGuideEditorLocaleTabs from '@/components/travel-guide/TravelGuideEditorLocaleTabs'
import TravelGuideImageField from '@/components/travel-guide/TravelGuideImageField'
import { AuthContext } from '@/contexts/AuthContext'
import { fetchTravelGuideArticlesForStaff } from '@/lib/fetchTravelGuideArticlesForStaff'
import { supabase } from '@/lib/supabase'
import {
  buildTravelGuideCategoryOptions,
  TRAVEL_GUIDE_CATEGORY_PRESETS,
} from '@/lib/travelGuideCategoryPresets'
import {
  createEmptyTravelGuideLocalizedStrings,
  localizedToTravelGuidePayload,
  TRAVEL_GUIDE_EDITOR_LOCALES,
  TRAVEL_GUIDE_FALLBACK_LOCALE,
  travelGuideRowToLocalized,
  type TravelGuideEditorLocale,
} from '@/lib/travelGuideEditorLocales'
import {
  deriveTravelGuideExcerpt,
  slugifyTravelGuideTitle,
  type TravelGuideArticleRow,
} from '@/lib/travelGuideArticles'
import { uploadTravelGuideImage } from '@/lib/uploadTravelGuideImage'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

export type TravelGuideEditorFormVariant = 'page' | 'modal'

export type TravelGuideEditorSavedArticle = {
  id: string
  slug: string
  isPublished: boolean
}

type Props = {
  t: (key: string, values?: Record<string, string | number>) => string
  editId?: string | undefined
  variant?: TravelGuideEditorFormVariant
  /** 모달 헤더 등 외부 컨테이너에 언어 탭을 포털로 렌더 */
  localeToolbarTarget?: HTMLElement | null
  onSaved?: (article: TravelGuideEditorSavedArticle) => void
  onCancel?: () => void
  onDeleted?: () => void
}

type FormState = {
  title: Record<TravelGuideEditorLocale, string>
  body: Record<TravelGuideEditorLocale, string>
  category: Record<TravelGuideEditorLocale, string>
  coverImageUrl: string
  sortOrder: number
  isPublished: boolean
}

const emptyForm = (): FormState => ({
  title: createEmptyTravelGuideLocalizedStrings(),
  body: createEmptyTravelGuideLocalizedStrings(),
  category: {
    ...createEmptyTravelGuideLocalizedStrings('Travel Tips'),
    ko: 'Travel Tips',
  },
  coverImageUrl: '',
  sortOrder: 0,
  isPublished: false,
})

function rowToForm(row: TravelGuideArticleRow): FormState {
  return {
    title: travelGuideRowToLocalized(row, 'title'),
    body: travelGuideRowToLocalized(row, 'body'),
    category: travelGuideRowToLocalized(row, 'category'),
    coverImageUrl: row.cover_image_url ?? '',
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  }
}

export default function TravelGuideEditorForm({
  t,
  editId = '',
  variant = 'page',
  localeToolbarTarget = null,
  onSaved,
  onCancel,
  onDeleted,
}: Props) {
  const auth = useContext(AuthContext)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [activeLocale, setActiveLocale] = useState<TravelGuideEditorLocale>(TRAVEL_GUIDE_FALLBACK_LOCALE)
  const [loading, setLoading] = useState(Boolean(editId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryOptions, setCategoryOptions] = useState<
    Record<TravelGuideEditorLocale, string[]>
  >({
    en: [],
    ko: [],
  })

  const canWrite = auth?.hasPermission('canViewAdmin') ?? false
  const authReady = auth ? !auth.loading : false

  const autoSlug = useMemo(
    () => slugifyTravelGuideTitle(form.title[TRAVEL_GUIDE_FALLBACK_LOCALE]),
    [form.title]
  )

  const uploadBodyImage = useCallback(async (file: File) => uploadTravelGuideImage(file), [])

  const addCustomCategoryLabel = useCallback(
    (value: string) => t('travelGuideCategoryAddCustom', { value }),
    [t]
  )

  const localeHasContent = useMemo(() => {
    const result: Partial<Record<TravelGuideEditorLocale, boolean>> = {}
    for (const locale of TRAVEL_GUIDE_EDITOR_LOCALES) {
      const code = locale.code
      result[code] = Boolean(
        form.title[code].trim() || form.body[code].trim() || form.category[code].trim()
      )
    }
    return result
  }, [form.title, form.body, form.category])

  useEffect(() => {
    if (!authReady || !canWrite) return

    let cancelled = false

    void (async () => {
      const articles = await fetchTravelGuideArticlesForStaff()
      if (cancelled) return

      const options = buildTravelGuideCategoryOptions(TRAVEL_GUIDE_CATEGORY_PRESETS, articles)
      setCategoryOptions({ en: options.en, ko: options.ko })
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, canWrite])

  useEffect(() => {
    if (!authReady || !canWrite) return

    if (!editId) {
      setForm(emptyForm())
      setActiveLocale(TRAVEL_GUIDE_FALLBACK_LOCALE)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        if (!cancelled) {
          setError(t('travelGuideAuthRequired'))
          setLoading(false)
        }
        return
      }

      const response = await fetch(`/api/travel-guide/${editId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) {
        if (!cancelled) {
          setError(t('travelGuideLoadFailed'))
          setLoading(false)
        }
        return
      }

      const payload = (await response.json()) as { article?: TravelGuideArticleRow }
      if (!cancelled && payload.article) {
        setForm(rowToForm(payload.article))
      }
      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, canWrite, editId, t])

  const updateLocalizedField = (
    field: 'title' | 'body' | 'category',
    locale: TravelGuideEditorLocale,
    value: string
  ) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: { ...prev[field], [locale]: value },
      }

      if (field === 'category' && locale === 'en') {
        const preset = TRAVEL_GUIDE_CATEGORY_PRESETS.find((item) => item.en === value.trim())
        if (preset) {
          next.category = { ...next.category, ko: preset.ko }
        }
      }
      if (field === 'category' && locale === 'ko') {
        const preset = TRAVEL_GUIDE_CATEGORY_PRESETS.find((item) => item.ko === value.trim())
        if (preset) {
          next.category = { ...next.category, en: preset.en }
        }
      }

      return next
    })
  }

  const mergedCategoryOptions = useMemo(() => {
    const merged: Record<TravelGuideEditorLocale, string[]> = { en: [], ko: [] }
    for (const locale of TRAVEL_GUIDE_EDITOR_LOCALES) {
      const code = locale.code
      const set = new Set(categoryOptions[code])
      if (form.category[code].trim()) set.add(form.category[code].trim())
      merged[code] = Array.from(set).sort((a, b) =>
        a.localeCompare(b, code === 'ko' ? 'ko' : 'en')
      )
    }
    return merged
  }, [categoryOptions, form.category])

  const saveArticle = async () => {
    setSaving(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError(t('travelGuideAuthRequired'))
        return
      }

      const slug = autoSlug
      if (!slug) {
        setError(t('travelGuideTitleEnRequired'))
        return
      }

      const localizedPayload = localizedToTravelGuidePayload({
        title: form.title,
        body: form.body,
        category: form.category,
      })

      const payload = {
        ...localizedPayload,
        slug,
        excerptEn: deriveTravelGuideExcerpt(form.body.en),
        excerptKo: deriveTravelGuideExcerpt(form.body.ko),
        coverImageUrl: form.coverImageUrl.trim() || null,
        sortOrder: form.sortOrder,
        isPublished: form.isPublished,
      }

      const response = await fetch(editId ? `/api/travel-guide/${editId}` : '/api/travel-guide', {
        method: editId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const result = (await response.json()) as { error?: string; article?: TravelGuideArticleRow }
      if (!response.ok) {
        setError(result.error ?? t('travelGuideSaveFailed'))
        return
      }

      const savedSlug = result.article?.slug ?? slug
      const savedId = result.article?.id ?? editId
      onSaved?.({
        id: savedId,
        slug: savedSlug,
        isPublished: result.article?.is_published ?? form.isPublished,
      })
    } catch (saveError) {
      console.error('[TravelGuideEditorForm] save failed', saveError)
      setError(t('travelGuideSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const deleteArticle = async () => {
    if (!editId) return
    if (!window.confirm(t('travelGuideDeleteConfirm'))) return

    setSaving(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError(t('travelGuideAuthRequired'))
        return
      }

      const response = await fetch(`/api/travel-guide/${editId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) {
        setError(t('travelGuideDeleteFailed'))
        return
      }

      onDeleted?.()
    } catch (deleteError) {
      console.error('[TravelGuideEditorForm] delete failed', deleteError)
      setError(t('travelGuideDeleteFailed'))
    } finally {
      setSaving(false)
    }
  }

  const headerLocaleTabs =
    localeToolbarTarget != null
      ? createPortal(
          <TravelGuideEditorLocaleTabs
            compact
            activeLocale={activeLocale}
            onChange={setActiveLocale}
            hasContent={localeHasContent}
          />,
          localeToolbarTarget
        )
      : null

  if (!authReady) {
    return (
      <>
        {headerLocaleTabs}
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      </>
    )
  }

  if (!canWrite) {
    return (
      <>
        {headerLocaleTabs}
        <p className="py-6 text-sm text-muted-foreground">{t('travelGuideStaffOnly')}</p>
      </>
    )
  }

  if (loading) {
    return (
      <>
        {headerLocaleTabs}
        <div className="kv-travel-guide-article-skeleton min-h-[240px]" aria-busy="true" />
      </>
    )
  }

  const activeLocaleConfig = TRAVEL_GUIDE_EDITOR_LOCALES.find((item) => item.code === activeLocale)
  const isEnglishTab = activeLocale === TRAVEL_GUIDE_FALLBACK_LOCALE

  const richEditorProps = {
    height: variant === 'modal' ? 300 : 340,
    minHeight: 180,
    maxHeight: 1200,
    enableImageUpload: true,
    enableImageResize: true,
    enableColorPicker: true,
    enableFontSize: true,
    enableFontFamily: true,
    enableLink: true,
    enableList: true,
    enableTable: true,
    enableBold: true,
    enableItalic: true,
    enableUnderline: true,
    enableResize: true,
    uploadImageFile: uploadBodyImage,
    className: 'kv-travel-guide-rich-editor rounded-xl border-border/80',
  } as const

  return (
    <form
      className={cn(
        'flex flex-col gap-5',
        variant === 'modal'
          ? 'bg-transparent p-0'
          : 'kv-travel-guide-form mt-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm'
      )}
      onSubmit={(event) => {
        event.preventDefault()
        void saveArticle()
      }}
    >
      {headerLocaleTabs ?? (
        <TravelGuideEditorLocaleTabs
          activeLocale={activeLocale}
          onChange={setActiveLocale}
          hasContent={localeHasContent}
          fallbackHint={t('travelGuideLocaleFallbackHint')}
        />
      )}

      {localeToolbarTarget && activeLocale !== TRAVEL_GUIDE_FALLBACK_LOCALE ? (
        <p className="text-xs text-muted-foreground">{t('travelGuideLocaleFallbackHint')}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:items-stretch md:gap-5">
        <TravelGuideImageField
          id="coverImageUrl"
          label={t('travelGuideFieldCover')}
          value={form.coverImageUrl}
          onChange={(next) => setForm((prev) => ({ ...prev, coverImageUrl: next }))}
          uploadLabel={t('travelGuideCoverUpload')}
          urlPlaceholder={t('travelGuideCoverUrlPlaceholder')}
          pasteHint={t('travelGuideImagePasteHint')}
          emptyLabel={t('travelGuideCoverEmpty')}
          expandLabel={t('travelGuideCoverExpand')}
          className="md:min-h-full"
        />

        <div className="flex min-w-0 flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor={`title-${activeLocale}`}>
              {t('travelGuideFieldTitle', { language: activeLocaleConfig?.label ?? activeLocale })}
              {isEnglishTab ? ' *' : null}
            </Label>
            <Input
              id={`title-${activeLocale}`}
              value={form.title[activeLocale]}
              onChange={(event) => updateLocalizedField('title', activeLocale, event.target.value)}
              required={isEnglishTab}
              placeholder={
                isEnglishTab
                  ? t('travelGuideFieldTitleEn')
                  : t('travelGuideFieldTitleOptional', {
                      language: activeLocaleConfig?.label ?? activeLocale,
                    })
              }
            />
            {isEnglishTab && autoSlug ? (
              <p className="text-xs text-muted-foreground">{t('travelGuideSlugAuto', { slug: autoSlug })}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`category-${activeLocale}`}>
              {t('travelGuideFieldCategory', { language: activeLocaleConfig?.label ?? activeLocale })}
            </Label>
            <TravelGuideCategoryCombobox
              id={`category-${activeLocale}`}
              value={form.category[activeLocale]}
              onChange={(next) => updateLocalizedField('category', activeLocale, next)}
              options={mergedCategoryOptions[activeLocale]}
              placeholder={
                activeLocale === 'ko'
                  ? t('travelGuideCategoryKoPlaceholder')
                  : t('travelGuideCategoryEnPlaceholder')
              }
              addCustomLabel={addCustomCategoryLabel}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="sortOrder">{t('travelGuideFieldSortOrder')}</Label>
              <Input
                id="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))
                }
              />
            </div>
            <div className="flex items-center gap-2 sm:pb-2">
              <Checkbox
                id="isPublished"
                checked={form.isPublished}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isPublished: checked === true }))
                }
              />
              <Label htmlFor="isPublished">{t('travelGuideFieldPublished')}</Label>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`body-${activeLocale}`}>
          {t('travelGuideFieldBody', { language: activeLocaleConfig?.label ?? activeLocale })}
        </Label>
        <LightRichEditor
          key={`body-${activeLocale}`}
          value={form.body[activeLocale]}
          onChange={(next) => updateLocalizedField('body', activeLocale, next ?? '')}
          uiLocale={activeLocale}
          {...richEditorProps}
        />
        <p className="text-xs text-muted-foreground">{t('travelGuideBodyResizeHint')}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className={variant === 'modal' ? 'kv-travel-guide-form-footer' : 'kv-travel-guide-editor-actions'}>
        {variant === 'modal' && onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t('travelGuideEditorCancel')}
          </Button>
        ) : null}
        {editId ? (
          <Button type="button" variant="outline" onClick={deleteArticle} disabled={saving}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('travelGuideDelete')}
          </Button>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t('travelGuideSave')}
        </Button>
      </div>
    </form>
  )
}
