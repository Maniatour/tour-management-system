'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { useContext } from 'react'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import { AuthContext } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { slugifyTravelGuideTitle, type TravelGuideArticleRow } from '@/lib/travelGuideArticles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

type Props = {
  locale: string
  t: (key: string) => string
}

type FormState = {
  slug: string
  titleEn: string
  titleKo: string
  excerptEn: string
  excerptKo: string
  bodyEn: string
  bodyKo: string
  categoryEn: string
  categoryKo: string
  coverImageUrl: string
  sortOrder: number
  isPublished: boolean
}

const emptyForm = (): FormState => ({
  slug: '',
  titleEn: '',
  titleKo: '',
  excerptEn: '',
  excerptKo: '',
  bodyEn: '',
  bodyKo: '',
  categoryEn: 'Travel Tips',
  categoryKo: 'Travel Tips',
  coverImageUrl: '',
  sortOrder: 0,
  isPublished: false,
})

function rowToForm(row: TravelGuideArticleRow): FormState {
  return {
    slug: row.slug,
    titleEn: row.title_en,
    titleKo: row.title_ko,
    excerptEn: row.excerpt_en,
    excerptKo: row.excerpt_ko,
    bodyEn: row.body_en,
    bodyKo: row.body_ko,
    categoryEn: row.category_en,
    categoryKo: row.category_ko,
    coverImageUrl: row.cover_image_url ?? '',
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  }
}

export default function TravelGuideEditorView({ locale, t }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useContext(AuthContext)
  const editId = searchParams.get('id')?.trim() ?? ''

  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(Boolean(editId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)

  const canWrite = auth?.hasPermission('canViewAdmin') ?? false
  const authReady = auth ? !auth.loading : false

  const suggestedSlug = useMemo(
    () => slugifyTravelGuideTitle(form.titleEn || form.titleKo),
    [form.titleEn, form.titleKo]
  )

  useEffect(() => {
    if (!authReady) return
    if (!canWrite) return

    if (!editId) {
      setLoading(false)
      return
    }

    let cancelled = false

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
        setSlugTouched(true)
      }
      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, canWrite, editId, t])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'titleEn' && !slugTouched) {
        next.slug = slugifyTravelGuideTitle(String(value))
      }
      return next
    })
  }

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

      const payload = {
        ...form,
        slug: form.slug.trim() || suggestedSlug,
        coverImageUrl: form.coverImageUrl.trim() || null,
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

      const slug = result.article?.slug ?? payload.slug
      router.push(`/${locale}/travel-guide/${slug}`)
    } catch (saveError) {
      console.error('[TravelGuideEditorView] save failed', saveError)
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

      router.push(`/${locale}/travel-guide`)
    } catch (deleteError) {
      console.error('[TravelGuideEditorView] delete failed', deleteError)
      setError(t('travelGuideDeleteFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (!authReady) {
    return (
      <CustomerPageShell locale={locale} className="travel-guide-page">
        <div className="kv-container py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      </CustomerPageShell>
    )
  }

  if (!canWrite) {
    return (
      <CustomerPageShell locale={locale} className="travel-guide-page">
        <div className="kv-container py-16">
          <div className="kv-travel-guide-empty">
            <h1 className="kv-section-title">{t('travelGuideWriteArticle')}</h1>
            <p>{t('travelGuideStaffOnly')}</p>
            <Link href={`/${locale}/auth`} className="kv-travel-guide-write-btn">
              {t('login')}
            </Link>
          </div>
        </div>
      </CustomerPageShell>
    )
  }

  return (
    <CustomerPageShell locale={locale} className="travel-guide-page">
      <section className="kv-section">
        <div className="kv-container kv-travel-guide-editor">
          <Link href={`/${locale}/travel-guide`} className="kv-travel-guide-back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('travelGuideBackToArticles')}
          </Link>

          <div className="kv-travel-guide-editor-header">
            <div>
              <h1 className="kv-section-title">
                {editId ? t('travelGuideEditArticle') : t('travelGuideWriteArticle')}
              </h1>
              <p className="kv-section-subtitle">{t('travelGuideEditorSubtitle')}</p>
            </div>
            <div className="kv-travel-guide-editor-actions">
              {editId ? (
                <Button type="button" variant="outline" onClick={deleteArticle} disabled={saving}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('travelGuideDelete')}
                </Button>
              ) : null}
              <Button type="button" onClick={saveArticle} disabled={saving || loading}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {t('travelGuideSave')}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="kv-travel-guide-article-skeleton" aria-busy="true" />
          ) : (
            <form
              className="kv-travel-guide-form"
              onSubmit={(event) => {
                event.preventDefault()
                void saveArticle()
              }}
            >
              <div className="kv-travel-guide-form-grid">
                <div className="space-y-2">
                  <Label htmlFor="titleEn">{t('travelGuideFieldTitleEn')}</Label>
                  <Input
                    id="titleEn"
                    value={form.titleEn}
                    onChange={(event) => updateField('titleEn', event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleKo">{t('travelGuideFieldTitleKo')}</Label>
                  <Input
                    id="titleKo"
                    value={form.titleKo}
                    onChange={(event) => updateField('titleKo', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">{t('travelGuideFieldSlug')}</Label>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(event) => {
                      setSlugTouched(true)
                      updateField('slug', event.target.value)
                    }}
                    placeholder={suggestedSlug}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coverImageUrl">{t('travelGuideFieldCover')}</Label>
                  <Input
                    id="coverImageUrl"
                    value={form.coverImageUrl}
                    onChange={(event) => updateField('coverImageUrl', event.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryEn">{t('travelGuideFieldCategoryEn')}</Label>
                  <Input
                    id="categoryEn"
                    value={form.categoryEn}
                    onChange={(event) => updateField('categoryEn', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryKo">{t('travelGuideFieldCategoryKo')}</Label>
                  <Input
                    id="categoryKo"
                    value={form.categoryKo}
                    onChange={(event) => updateField('categoryKo', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">{t('travelGuideFieldSortOrder')}</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) => updateField('sortOrder', Number(event.target.value) || 0)}
                  />
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <Checkbox
                    id="isPublished"
                    checked={form.isPublished}
                    onCheckedChange={(checked) => updateField('isPublished', checked === true)}
                  />
                  <Label htmlFor="isPublished">{t('travelGuideFieldPublished')}</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerptEn">{t('travelGuideFieldExcerptEn')}</Label>
                <Textarea
                  id="excerptEn"
                  value={form.excerptEn}
                  onChange={(event) => updateField('excerptEn', event.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerptKo">{t('travelGuideFieldExcerptKo')}</Label>
                <Textarea
                  id="excerptKo"
                  value={form.excerptKo}
                  onChange={(event) => updateField('excerptKo', event.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bodyEn">{t('travelGuideFieldBodyEn')}</Label>
                <Textarea
                  id="bodyEn"
                  value={form.bodyEn}
                  onChange={(event) => updateField('bodyEn', event.target.value)}
                  rows={14}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bodyKo">{t('travelGuideFieldBodyKo')}</Label>
                <Textarea
                  id="bodyKo"
                  value={form.bodyKo}
                  onChange={(event) => updateField('bodyKo', event.target.value)}
                  rows={14}
                  className="font-mono text-sm"
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </form>
          )}
        </div>
      </section>
    </CustomerPageShell>
  )
}
