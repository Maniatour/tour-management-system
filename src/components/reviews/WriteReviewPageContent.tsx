'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  Check,
  Info,
  Loader2,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import ReviewBubbleRating from '@/components/reviews/ReviewBubbleRating'
import WriteReviewProductCard from '@/components/reviews/WriteReviewProductCard'
import WriteReviewProductPicker, {
  type WriteReviewProductOption,
} from '@/components/reviews/WriteReviewProductPicker'
import { supabase } from '@/lib/supabase'
import { withPrimaryImages } from '@/lib/fetchProductPrimaryImagesBatch'
import {
  fetchProductFieldTranslations,
  getProductLocalizedField,
} from '@/lib/productFieldTranslations'
import { readPublicOperatorIdBrowser } from '@/lib/operators/readPublicOperatorIdBrowser'
import { normalizeSiteLocale } from '@/lib/siteLocales'
import {
  BOOKED_WITH_OPTIONS,
  COMPANION_TYPES,
  WRITE_REVIEW_MAX_PHOTO_BYTES,
  WRITE_REVIEW_MAX_PHOTOS,
  WRITE_REVIEW_MIN_WORDS,
  countReviewWords,
  type BookedWithOption,
  type CompanionType,
  type SubRatingValue,
} from '@/lib/customerReviewSubmit'

function buildVisitedMonthOptions(locale: string) {
  const months: Array<{ value: string; label: string }> = []
  const now = new Date()
  const formatter = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  })

  for (let i = 0; i < 36; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    months.push({ value, label: formatter.format(date) })
  }
  return months
}

function currentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function ExplorerBadge({ text }: { text: string }) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-lg bg-[#f2f2f2] px-3 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--wr-accent)]">
        <Trophy className="h-5 w-5" aria-hidden />
      </div>
      <p className="pt-1.5 text-sm leading-snug text-foreground">{text}</p>
    </div>
  )
}

export default function WriteReviewPageContent() {
  const t = useTranslations('writeReview')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get('productId')?.trim() || ''
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [product, setProduct] = useState<WriteReviewProductOption | null>(null)
  const [productLoading, setProductLoading] = useState(Boolean(productId))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [ratingValue, setRatingValue] = useState<number | null>(null)
  const [ratingGuide, setRatingGuide] = useState<SubRatingValue>(null)
  const [ratingPickup, setRatingPickup] = useState<SubRatingValue>(null)
  const [visitedMonth, setVisitedMonth] = useState('')
  const [monthOptions, setMonthOptions] = useState<Array<{ value: string; label: string }>>([])
  const [companionType, setCompanionType] = useState<CompanionType | null>(null)
  const [bookedWith, setBookedWith] = useState<BookedWithOption | ''>('')
  const [tipTab, setTipTab] = useState<'experience' | 'advice' | 'length'>('experience')
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [certified, setCertified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const wordCount = countReviewWords(content)
  const siteLocale = normalizeSiteLocale(locale)
  const photoPreviews = useMemo(
    () => photos.map((file) => URL.createObjectURL(file)),
    [photos]
  )

  useEffect(() => {
    const options = buildVisitedMonthOptions(locale)
    setMonthOptions(options)
    setVisitedMonth((current) => current || currentMonthValue())
  }, [locale])

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [photoPreviews])

  useEffect(() => {
    if (!productId) {
      setProduct(null)
      setProductLoading(false)
      return
    }

    let cancelled = false
    setProductLoading(true)

    void (async () => {
      try {
        const operatorId = readPublicOperatorIdBrowser()
        const { data } = await supabase
          .from('products')
          .select('id, name, name_ko, name_en, customer_name_ko, customer_name_en')
          .eq('id', productId)
          .eq('operator_id', operatorId)
          .eq('status', 'active')
          .eq('is_published', true)
          .maybeSingle()

        if (cancelled) return
        if (!data) {
          setProduct(null)
          return
        }

        const [withImage] = await withPrimaryImages([data])
        const translations = await fetchProductFieldTranslations(data.id)
        const titleText =
          getProductLocalizedField(withImage, 'customer_name', siteLocale, translations) ||
          getProductLocalizedField(withImage, 'name', siteLocale, translations) ||
          withImage.name?.trim() ||
          withImage.id

        setProduct({
          id: withImage.id,
          title: titleText,
          imageUrl: withImage.primary_image,
        })
      } finally {
        if (!cancelled) setProductLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [productId, siteLocale])

  const selectProduct = (next: WriteReviewProductOption) => {
    setProduct(next)
    setPickerOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    params.set('productId', next.id)
    router.replace(`/${locale}/reviews/write?${params.toString()}`, { scroll: false })
  }

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const next = [...photos]
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > WRITE_REVIEW_MAX_PHOTO_BYTES) continue
      if (next.length >= WRITE_REVIEW_MAX_PHOTOS) break
      next.push(file)
    }
    setPhotos(next)
  }

  const helpWrite = () => {
    if (content.trim()) return
    setContent(t(`helpDraft.${tipTab}`))
  }

  const canSubmit =
    Boolean(product?.id) &&
    rating != null &&
    wordCount >= WRITE_REVIEW_MIN_WORDS &&
    certified &&
    authorName.trim().length >= 2 &&
    !submitting

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit || !product || rating == null) return

    setSubmitting(true)
    setError(null)

    try {
      const body = new FormData()
      body.set('productId', product.id)
      body.set('locale', locale)
      body.set('authorName', authorName.trim())
      body.set('rating', String(rating))
      if (ratingValue) body.set('ratingValue', String(ratingValue))
      if (ratingGuide === 'na') body.set('ratingGuide', 'na')
      else if (typeof ratingGuide === 'number') body.set('ratingGuide', String(ratingGuide))
      if (ratingPickup === 'na') body.set('ratingPickup', 'na')
      else if (typeof ratingPickup === 'number') body.set('ratingPickup', String(ratingPickup))
      body.set('visitedMonth', visitedMonth)
      if (companionType) body.set('companionType', companionType)
      if (bookedWith) body.set('bookedWith', bookedWith)
      body.set('title', title.trim())
      body.set('content', content.trim())
      body.set('certified', certified ? 'true' : 'false')
      body.set('companyWebsite', '')
      for (const photo of photos) body.append('photos', photo)

      const response = await fetch('/api/public/customer-reviews', {
        method: 'POST',
        body,
      })
      const payload = (await response.json()) as { ok?: boolean; message?: string }
      if (!response.ok || !payload.ok) {
        setError(payload.message ? t('submitError') : t('submitError'))
        return
      }
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError(t('submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <CustomerPageShell locale={locale} className="bg-white">
        <div
          className="mx-auto max-w-[560px] px-4 py-16 text-center sm:px-6"
          style={{ ['--wr-accent' as string]: '#00aa6c', ['--wr-accent-dark' as string]: '#034732' }}
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wr-accent)] text-white">
            <Check className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('successTitle')}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{t('successBody')}</p>
          {product ? (
            <a
              href={`/${locale}/products/${product.id}`}
              className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-[var(--wr-accent-dark)] px-6 text-sm font-semibold text-white hover:opacity-95"
            >
              {t('backToTour')}
            </a>
          ) : null}
        </div>
      </CustomerPageShell>
    )
  }

  return (
    <CustomerPageShell locale={locale} className="bg-white">
      <div
        className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-5 sm:px-6 sm:pt-8"
        style={{ ['--wr-accent' as string]: '#00aa6c', ['--wr-accent-dark' as string]: '#034732' }}
      >
        {productLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-0">
            {product ? (
              <WriteReviewProductCard
                title={product.title}
                imageUrl={product.imageUrl}
                providerName={t('byProvider')}
                changeLabel={t('changeActivity')}
                onChangeActivity={() => setPickerOpen(true)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex w-full items-center justify-center rounded-xl border border-dashed border-border px-4 py-8 text-sm font-medium text-muted-foreground hover:bg-muted/40"
              >
                {t('chooseActivity')}
              </button>
            )}

            <ExplorerBadge text={t('explorerBadge')} />

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <h2 className="text-lg font-bold text-foreground">{t('overallQuestion')}</h2>
              <div className="mt-4">
                <ReviewBubbleRating
                  name={t('overallQuestion')}
                  value={rating}
                  onChange={setRating}
                  size="lg"
                />
              </div>
            </section>

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <h2 className="text-lg font-bold text-foreground">{t('subQuestion')}</h2>
              <div className="mt-5 space-y-5">
                <SubRatingRow
                  label={t('valueForMoney')}
                  value={ratingValue}
                  onChange={(value) => setRatingValue(value === 'na' ? null : value)}
                />
                <SubRatingRow
                  label={t('guide')}
                  value={ratingGuide}
                  onChange={setRatingGuide}
                  naLabel={t('notApplicable')}
                />
                <SubRatingRow
                  label={t('meetingOrPickup')}
                  value={ratingPickup}
                  onChange={setRatingPickup}
                  naLabel={t('notApplicable')}
                />
              </div>
            </section>

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <h2 className="text-lg font-bold text-foreground">{t('whenDidYouGo')}</h2>
              <div className="relative mt-3">
                <select
                  value={visitedMonth}
                  onChange={(event) => setVisitedMonth(event.target.value)}
                  className="h-12 w-full appearance-none rounded-lg border border-[#c6c6c6] bg-white px-3 pr-10 text-sm text-foreground"
                >
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ▾
                </span>
              </div>
            </section>

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <h2 className="text-lg font-bold text-foreground">{t('whoDidYouGoWith')}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {COMPANION_TYPES.map((type) => {
                  const selected = companionType === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCompanionType(selected ? null : type)}
                      className={`h-10 rounded-full border px-4 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-foreground bg-foreground text-white'
                          : 'border-[#c6c6c6] bg-white text-foreground hover:border-foreground'
                      }`}
                    >
                      {t(`companion.${type}`)}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <h2 className="text-lg font-bold text-foreground">{t('whoDidYouBookWith')}</h2>
              <div className="relative mt-3">
                <select
                  value={bookedWith}
                  onChange={(event) => setBookedWith(event.target.value as BookedWithOption | '')}
                  className="h-12 w-full appearance-none rounded-lg border border-[#c6c6c6] bg-white px-3 pr-10 text-sm text-foreground"
                >
                  <option value="">{t('selectOne')}</option>
                  {BOOKED_WITH_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`bookedWith.${option}`)}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ▾
                </span>
              </div>
            </section>

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <h2 className="text-lg font-bold text-foreground">{t('writeYourReview')}</h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {(['experience', 'advice', 'length'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setTipTab(tab)}
                    className={`text-sm font-medium text-[var(--wr-accent)] underline-offset-2 hover:underline ${
                      tipTab === tab ? 'underline' : ''
                    }`}
                  >
                    {t(`tips.${tab}`)}
                  </button>
                ))}
              </div>
              <div className="mt-3 overflow-hidden rounded-lg border border-[#c6c6c6]">
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={t(`placeholders.${tipTab}`)}
                  rows={8}
                  className="min-h-[180px] w-full resize-y border-0 bg-white px-3 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
                />
                <div className="flex items-center justify-between border-t border-[#e0e0e0] px-3 py-2">
                  <button
                    type="button"
                    onClick={helpWrite}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-[var(--wr-accent)]"
                  >
                    <Sparkles className="h-4 w-4 text-[var(--wr-accent)]" aria-hidden />
                    {t('helpMeWrite')}
                  </button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {t('wordCount', { count: wordCount, min: WRITE_REVIEW_MIN_WORDS })}
                  </span>
                </div>
              </div>
            </section>

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <h2 className="text-lg font-bold text-foreground">{t('titleYourReview')}</h2>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder={t('titlePlaceholder')}
                className="mt-3 h-12 w-full rounded-lg border border-[#c6c6c6] bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </section>

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <h2 className="text-lg font-bold text-foreground">{t('yourName')}</h2>
              <input
                type="text"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                maxLength={80}
                placeholder={t('yourNamePlaceholder')}
                className="mt-3 h-12 w-full rounded-lg border border-[#c6c6c6] bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </section>

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <h2 className="flex items-center gap-1.5 text-lg font-bold text-foreground">
                {t('addPhotos')}
                <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
              </h2>
              <div className="mt-3 flex items-start gap-3 rounded-lg bg-[#f2f2f2] px-3 py-3">
                <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-[var(--wr-accent)]" aria-hidden />
                <p className="text-sm leading-snug text-foreground">{t('photoMilestone')}</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  addPhotos(event.target.files)
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-[#c6c6c6] bg-white px-4 py-10 text-foreground hover:bg-muted/30"
              >
                <Camera className="h-8 w-8 text-muted-foreground" aria-hidden />
                <span className="mt-3 text-sm font-medium">{t('addPhotosCta')}</span>
              </button>
              {photos.length > 0 ? (
                <ul className="mt-3 grid grid-cols-3 gap-2">
                  {photos.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-md">
                      <Image
                        src={photoPreviews[index] ?? ''}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                        className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                        aria-label={t('removePhoto')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="border-t border-[#e0e0e0] pt-6 mt-6">
              <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
                <input
                  type="checkbox"
                  checked={certified}
                  onChange={(event) => setCertified(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#c6c6c6]"
                />
                <span>{t('certify')}</span>
              </label>
              <input type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" className="hidden" />
            </section>

            {error ? <p className="pt-4 text-sm text-destructive">{error}</p> : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-[var(--wr-accent-dark)] text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : t('submit')}
            </button>
          </form>
        )}
      </div>

      <WriteReviewProductPicker
        open={pickerOpen}
        locale={locale}
        searchPlaceholder={t('searchActivity')}
        emptyLabel={t('noActivities')}
        closeLabel={t('close')}
        onClose={() => setPickerOpen(false)}
        onSelect={selectProduct}
      />
    </CustomerPageShell>
  )
}

function SubRatingRow({
  label,
  value,
  onChange,
  naLabel,
}: {
  label: string
  value: SubRatingValue
  onChange: (value: SubRatingValue) => void
  naLabel?: string
}) {
  const numeric = typeof value === 'number' ? value : null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-[140px] text-sm font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <ReviewBubbleRating
          name={label}
          value={numeric}
          onChange={(next) => onChange(next)}
          size="sm"
        />
        {naLabel ? (
          <button
            type="button"
            onClick={() => onChange(value === 'na' ? null : 'na')}
            className={`h-7 rounded-full border px-2.5 text-xs font-medium ${
              value === 'na'
                ? 'border-foreground bg-foreground text-white'
                : 'border-[#c6c6c6] text-muted-foreground hover:border-foreground'
            }`}
          >
            {naLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
