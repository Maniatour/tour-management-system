'use client'

import { useEffect, useMemo, useState } from 'react'
import { GripVertical, Loader2, Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import DynamicPricingManager from '@/components/DynamicPricingManager'
import ProductMediaTab from '@/components/product/ProductMediaTab'
import ProductTagsBilingualEditor, {
  saveProductTagsWithTranslations,
  type TagTranslationState,
} from '@/components/product/ProductTagsBilingualEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizableDialogContent } from '@/components/ui/ResizableDialogContent'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PRICING_EDIT_MODAL_STORAGE_KEY = 'admin-product-card-pricing-edit-modal-rect'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import {
  buildDepartureUpdateFields,
  productToBasicForm,
  productToLocationForm,
  productToPricingForm,
  productToTourDetailsForm,
  fetchProductPrimaryImage,
  type AdminProductCardEditProduct,
  type AdminProductCardEditSection,
} from '@/lib/adminProductCardEdit'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import {
  cardEditSectionSupportsLocaleSwitch,
  getAdminEditLocaleLabel,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  buildProductTranslationMap,
  fetchProductFieldTranslations,
  upsertProductFieldTranslations,
  type ProductTranslationField,
  type ProductTranslationMap,
} from '@/lib/productFieldTranslations'
import { isLegacyColumnLocale } from '@/lib/siteLocales'

type Product = Database['public']['Tables']['products']['Row']

type AdminProductCardEditModalsProps = {
  product: Product
  section: AdminProductCardEditSection | null
  onClose: () => void
  onSaved: (productId: string, updates: Partial<Product>) => void
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
    </div>
  )
}

export default function AdminProductCardEditModals({
  product,
  section,
  onClose,
  onSaved,
}: AdminProductCardEditModalsProps) {
  const t = useTranslations('products.cardEditModal')
  const tBasic = useTranslations('products.basicInfoTab')
  const tProducts = useTranslations('products')
  const tCommon = useTranslations('common')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [subCategories, setSubCategories] = useState<string[]>([])

  const editProduct = product as AdminProductCardEditProduct

  const [locationForm, setLocationForm] = useState(() => productToLocationForm(editProduct))
  const [basicForm, setBasicForm] = useState(() => productToBasicForm(editProduct))
  const [tourForm, setTourForm] = useState(() => productToTourDetailsForm(editProduct))
  const [pricingForm, setPricingForm] = useState(() => productToPricingForm(editProduct))
  const [tagKeys, setTagKeys] = useState<string[]>(() => product.tags ?? [])
  const [tagTranslations, setTagTranslations] = useState<TagTranslationState>({})
  const [newDepartureTime, setNewDepartureTime] = useState('')
  const [editLocale, setEditLocale] = useState<AdminEditLocale>('ko')
  const [translationMap, setTranslationMap] = useState<ProductTranslationMap>({})

  const showLocaleToggle = cardEditSectionSupportsLocaleSwitch(section)

  useEffect(() => {
    if (!section) return
    setError(null)
    setEditLocale('ko')
    const current = product as AdminProductCardEditProduct
    setLocationForm(productToLocationForm(current))
    setBasicForm(productToBasicForm(current))
    setTourForm(productToTourDetailsForm(current))
    setPricingForm(productToPricingForm(current))
    setTagKeys(product.tags ?? [])
    setTagTranslations({})
    setNewDepartureTime('')
    setTranslationMap(buildProductTranslationMap(current, []))

    let cancelled = false
    void (async () => {
      const rows = await fetchProductFieldTranslations(product.id)
      if (cancelled) return
      setTranslationMap(buildProductTranslationMap(current, rows))
    })()

    return () => {
      cancelled = true
    }
  }, [section, product])

  const readTranslated = (field: ProductTranslationField): string => {
    if (isLegacyColumnLocale(editLocale)) {
      if (field === 'name') return editLocale === 'ko' ? basicForm.name : basicForm.nameEn
      if (field === 'customer_name') {
        return editLocale === 'ko' ? basicForm.customerNameKo : basicForm.customerNameEn
      }
      if (field === 'summary') {
        return editLocale === 'ko' ? basicForm.summaryKo : basicForm.summaryEn
      }
      if (field === 'departure_city') {
        return editLocale === 'ko' ? locationForm.departureCityKo : locationForm.departureCityEn
      }
      if (field === 'arrival_city') {
        return editLocale === 'ko' ? locationForm.arrivalCityKo : locationForm.arrivalCityEn
      }
      if (field === 'departure_country') {
        return editLocale === 'ko'
          ? locationForm.departureCountryKo
          : locationForm.departureCountryEn
      }
      if (field === 'arrival_country') {
        return editLocale === 'ko' ? locationForm.arrivalCountryKo : locationForm.arrivalCountryEn
      }
    }
    // Edit UI must not fall back to another language — show empty when unset.
    return translationMap[field]?.[editLocale] ?? ''
  }

  const writeTranslated = (field: ProductTranslationField, value: string) => {
    if (isLegacyColumnLocale(editLocale)) {
      if (field === 'name') {
        setBasicForm((prev) =>
          editLocale === 'ko' ? { ...prev, name: value } : { ...prev, nameEn: value }
        )
        return
      }
      if (field === 'customer_name') {
        setBasicForm((prev) =>
          editLocale === 'ko'
            ? { ...prev, customerNameKo: value }
            : { ...prev, customerNameEn: value }
        )
        return
      }
      if (field === 'summary') {
        setBasicForm((prev) =>
          editLocale === 'ko' ? { ...prev, summaryKo: value } : { ...prev, summaryEn: value }
        )
        return
      }
      if (field === 'departure_city') {
        setLocationForm((prev) =>
          editLocale === 'ko'
            ? { ...prev, departureCityKo: value }
            : { ...prev, departureCityEn: value }
        )
        return
      }
      if (field === 'arrival_city') {
        setLocationForm((prev) =>
          editLocale === 'ko'
            ? { ...prev, arrivalCityKo: value }
            : { ...prev, arrivalCityEn: value }
        )
        return
      }
      if (field === 'departure_country') {
        setLocationForm((prev) =>
          editLocale === 'ko'
            ? { ...prev, departureCountryKo: value }
            : { ...prev, departureCountryEn: value }
        )
        return
      }
      if (field === 'arrival_country') {
        setLocationForm((prev) =>
          editLocale === 'ko'
            ? { ...prev, arrivalCountryKo: value }
            : { ...prev, arrivalCountryEn: value }
        )
        return
      }
    }

    setTranslationMap((prev) => ({
      ...prev,
      [field]: {
        ...(prev[field] || {}),
        [editLocale]: value,
      },
    }))
  }

  useEffect(() => {
    if (section !== 'basic') return

    const loadCategories = async () => {
      const { data } = await supabase.from('products').select('category, sub_category')
      const categorySet = new Set<string>()
      const subCategorySet = new Set<string>()
      ;(data ?? []).forEach((row: { category?: string | null; sub_category?: string | null }) => {
        if (row.category) categorySet.add(row.category)
        if (row.sub_category) subCategorySet.add(row.sub_category)
      })
      setCategories(Array.from(categorySet).sort())
      setSubCategories(Array.from(subCategorySet).sort())
    }

    void loadCategories()
  }, [section])

  const title = useMemo(() => {
    switch (section) {
      case 'location':
        return t('locationTitle')
      case 'basic':
        return t('basicTitle')
      case 'tour-details':
        return t('tourDetailsTitle')
      case 'pricing':
        return t('pricingTitle')
      case 'media':
        return t('mediaTitle')
      case 'tags':
        return t('tagsTitle')
      default:
        return ''
    }
  }, [section, t])

  const handleSave = async () => {
    if (!section) return
    setSaving(true)
    setError(null)

    try {
      let updates: Record<string, unknown> = {}

      if (section === 'location') {
        updates = buildDepartureUpdateFields(locationForm)
        const locationValues: Partial<Record<ProductTranslationField, string>> = {
          departure_city: readTranslated('departure_city'),
          arrival_city: readTranslated('arrival_city'),
          departure_country: readTranslated('departure_country'),
          arrival_country: readTranslated('arrival_country'),
        }
        // Always persist ko/en columns, then upsert the active locale (covers ja/zh/…).
        const legacyFromKo = await upsertProductFieldTranslations({
          productId: product.id,
          locale: 'ko',
          values: {
            departure_city: locationForm.departureCityKo,
            arrival_city: locationForm.arrivalCityKo,
            departure_country: locationForm.departureCountryKo,
            arrival_country: locationForm.arrivalCountryKo,
          },
        })
        const legacyFromEn = await upsertProductFieldTranslations({
          productId: product.id,
          locale: 'en',
          values: {
            departure_city: locationForm.departureCityEn,
            arrival_city: locationForm.arrivalCityEn,
            departure_country: locationForm.departureCountryEn,
            arrival_country: locationForm.arrivalCountryEn,
          },
        })
        if (!isLegacyColumnLocale(editLocale)) {
          await upsertProductFieldTranslations({
            productId: product.id,
            locale: editLocale,
            values: locationValues,
          })
        }
        updates = { ...updates, ...legacyFromKo, ...legacyFromEn }
      }

      if (section === 'basic') {
        if (!basicForm.name.trim() || !basicForm.category || !basicForm.subCategory) {
          setError(t('basicValidation'))
          setSaving(false)
          return
        }
        updates = {
          name: basicForm.name.trim(),
          name_ko: basicForm.name.trim() || null,
          name_en: basicForm.nameEn.trim() || null,
          customer_name_ko: basicForm.customerNameKo.trim() || basicForm.name.trim(),
          customer_name_en: basicForm.customerNameEn.trim() || basicForm.nameEn.trim() || 'Product',
          product_code: basicForm.productCode.trim() || null,
          status: basicForm.status,
          category: basicForm.category,
          sub_category: basicForm.subCategory,
          summary_ko: basicForm.summaryKo.trim() || null,
          summary_en: basicForm.summaryEn.trim() || null,
        }
        await upsertProductFieldTranslations({
          productId: product.id,
          locale: 'ko',
          values: {
            name: basicForm.name,
            customer_name: basicForm.customerNameKo.trim() || basicForm.name,
            summary: basicForm.summaryKo,
          },
        })
        await upsertProductFieldTranslations({
          productId: product.id,
          locale: 'en',
          values: {
            name: basicForm.nameEn,
            customer_name: basicForm.customerNameEn.trim() || basicForm.nameEn || 'Product',
            summary: basicForm.summaryEn,
          },
        })
        if (!isLegacyColumnLocale(editLocale)) {
          await upsertProductFieldTranslations({
            productId: product.id,
            locale: editLocale,
            values: {
              name: readTranslated('name'),
              customer_name: readTranslated('customer_name'),
              summary: readTranslated('summary'),
            },
          })
        }
      }

      if (section === 'tour-details') {
        const maxParticipants = Number(tourForm.maxParticipants)
        if (!tourForm.duration.trim() || !maxParticipants || maxParticipants <= 0) {
          setError(t('tourValidation'))
          setSaving(false)
          return
        }
        updates = {
          duration: tourForm.duration.trim(),
          max_participants: maxParticipants,
          tour_departure_times: tourForm.tourDepartureTimes,
        }
      }

      if (section === 'pricing') {
        const adult = Number(pricingForm.adultBasePrice)
        updates = {
          base_price: adult,
          adult_base_price: adult,
          child_base_price: Number(pricingForm.childBasePrice) || 0,
          infant_base_price: Number(pricingForm.infantBasePrice) || 0,
          homepage_pricing_type: pricingForm.homepagePricingType,
        }
      }

      if (section === 'tags') {
        await saveProductTagsWithTranslations(product.id, tagKeys, tagTranslations)
        onSaved(product.id, { tags: tagKeys } as Partial<Product>)
        onClose()
        return
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updates as never)
        .eq('id', product.id)

      if (updateError) throw updateError

      onSaved(product.id, updates as Partial<Product>)
      onClose()
    } catch (saveError) {
      console.error('카드뷰 상품 수정 오류:', saveError)
      setError(t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const addDepartureTime = () => {
    if (!newDepartureTime || tourForm.tourDepartureTimes.includes(newDepartureTime)) return
    setTourForm((prev) => ({
      ...prev,
      tourDepartureTimes: [...prev.tourDepartureTimes, newDepartureTime].sort(),
    }))
    setNewDepartureTime('')
  }

  const removeDepartureTime = (index: number) => {
    setTourForm((prev) => ({
      ...prev,
      tourDepartureTimes: prev.tourDepartureTimes.filter((_, idx) => idx !== index),
    }))
  }

  const handleDialogOpenChange = async (open: boolean) => {
    if (open) return

    if (section === 'media') {
      try {
        const primaryImage = await fetchProductPrimaryImage(product.id)
        onSaved(product.id, { primary_image: primaryImage } as Partial<Product>)
      } catch (refreshError) {
        console.error('대표 이미지 새로고침 오류:', refreshError)
      }
    }

    onClose()
  }

  const dialogSize =
    section === 'media'
      ? 'max-w-[min(96vw,72rem)] max-h-[90vh] overflow-y-auto'
      : 'max-w-2xl max-h-[90vh] overflow-y-auto'

  const dialogHeader =
    section === 'pricing' ? (
      <DialogHeader
        data-dialog-drag-handle
        className="shrink-0 border-b px-4 py-3 pr-16 text-left sm:cursor-grab sm:px-5 sm:py-4 sm:pr-[4.5rem] sm:active:cursor-grabbing"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <GripVertical
              className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block"
              aria-hidden
            />
            <DialogTitle className="pr-2">{title}</DialogTitle>
          </div>
          {showLocaleToggle ? (
            <AdminEditLocaleToggle
              value={editLocale}
              onChange={setEditLocale}
              groupLabel={t('editLocaleGroup')}
              koLabel={t('editLocaleKo')}
              enLabel={t('editLocaleEn')}
            />
          ) : null}
        </div>
      </DialogHeader>
    ) : (
      <DialogHeader>
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="pr-2">{title}</DialogTitle>
          {showLocaleToggle ? (
            <AdminEditLocaleToggle
              value={editLocale}
              onChange={setEditLocale}
              groupLabel={t('editLocaleGroup')}
              koLabel={t('editLocaleKo')}
              enLabel={t('editLocaleEn')}
            />
          ) : null}
        </div>
      </DialogHeader>
    )

  const pricingBody = (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700">{tBasic('homepagePricingType')}</span>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="homepagePricingType"
              checked={pricingForm.homepagePricingType === 'separate'}
              onChange={() => setPricingForm((prev) => ({ ...prev, homepagePricingType: 'separate' }))}
            />
            {tBasic('separatePricing')}
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="homepagePricingType"
              checked={pricingForm.homepagePricingType === 'single'}
              onChange={() =>
                setPricingForm((prev) => ({
                  ...prev,
                  homepagePricingType: 'single',
                  childBasePrice: prev.adultBasePrice,
                  infantBasePrice: prev.adultBasePrice,
                }))
              }
            />
            {tBasic('singlePricing')}
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={tBasic('adult')}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={pricingForm.adultBasePrice}
              onChange={(e) => {
                const adult = parseFloat(e.target.value) || 0
                setPricingForm((prev) => ({
                  ...prev,
                  adultBasePrice: adult,
                  basePrice: adult,
                  ...(prev.homepagePricingType === 'single'
                    ? { childBasePrice: adult, infantBasePrice: adult }
                    : {}),
                }))
              }}
            />
          </Field>
          {pricingForm.homepagePricingType === 'separate' ? (
            <>
              <Field label={tBasic('child')}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pricingForm.childBasePrice}
                  onChange={(e) =>
                    setPricingForm((prev) => ({
                      ...prev,
                      childBasePrice: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </Field>
              <Field label={tBasic('infant')}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pricingForm.infantBasePrice}
                  onChange={(e) =>
                    setPricingForm((prev) => ({
                      ...prev,
                      infantBasePrice: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </Field>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 p-2 sm:p-4">
        <h3 className="mb-3 px-2 text-sm font-semibold text-gray-900">{t('dynamicPricingSection')}</h3>
        <DynamicPricingManager productId={product.id} />
      </div>
    </div>
  )

  const pricingFooter = (
    <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:gap-0 sm:px-5">
      <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
        {t('close')}
      </Button>
      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('saveBasePrice')}
      </Button>
    </DialogFooter>
  )

  return (
    <Dialog open={section != null} onOpenChange={handleDialogOpenChange}>
      {section === 'pricing' ? (
        <ResizableDialogContent
          storageKey={PRICING_EDIT_MODAL_STORAGE_KEY}
          defaultWidth={1400}
          defaultHeight={860}
          respectHeaderInset={false}
          className="flex flex-col gap-0 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {dialogHeader}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {pricingBody}
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          </div>
          {pricingFooter}
        </ResizableDialogContent>
      ) : (
      <DialogContent
        className={dialogSize}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {dialogHeader}

        {section === 'location' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${tBasic('departureCity')} (${getAdminEditLocaleLabel(editLocale)})`}>
              <Input
                value={readTranslated('departure_city')}
                onChange={(e) => writeTranslated('departure_city', e.target.value)}
              />
            </Field>
            <Field label={`${tBasic('arrivalCity')} (${getAdminEditLocaleLabel(editLocale)})`}>
              <Input
                value={readTranslated('arrival_city')}
                onChange={(e) => writeTranslated('arrival_city', e.target.value)}
              />
            </Field>
            <Field label={`${tBasic('departureCountry')} (${getAdminEditLocaleLabel(editLocale)})`}>
              <Input
                value={readTranslated('departure_country')}
                onChange={(e) => writeTranslated('departure_country', e.target.value)}
              />
            </Field>
            <Field label={`${tBasic('arrivalCountry')} (${getAdminEditLocaleLabel(editLocale)})`}>
              <Input
                value={readTranslated('arrival_country')}
                onChange={(e) => writeTranslated('arrival_country', e.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {section === 'basic' ? (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={
                  editLocale === 'ko'
                    ? tBasic('nameInternalKo')
                    : editLocale === 'en'
                      ? tBasic('nameInternalEn')
                      : `${tBasic('nameInternalEn')} (${getAdminEditLocaleLabel(editLocale)})`
                }
              >
                <Input
                  value={readTranslated('name')}
                  onChange={(e) => writeTranslated('name', e.target.value)}
                />
              </Field>
              <Field
                label={
                  editLocale === 'ko'
                    ? tBasic('nameCustomerKo')
                    : editLocale === 'en'
                      ? tBasic('nameCustomerEn')
                      : `${tBasic('nameCustomerEn')} (${getAdminEditLocaleLabel(editLocale)})`
                }
              >
                <Input
                  value={readTranslated('customer_name')}
                  onChange={(e) => writeTranslated('customer_name', e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tBasic('productCode')}>
                <Input
                  value={basicForm.productCode}
                  onChange={(e) => setBasicForm((prev) => ({ ...prev, productCode: e.target.value }))}
                />
              </Field>
              <Field label={tBasic('salesStatus')}>
                <select
                  value={basicForm.status}
                  onChange={(e) =>
                    setBasicForm((prev) => ({
                      ...prev,
                      status: e.target.value as 'active' | 'inactive' | 'draft',
                    }))
                  }
                  className="app-input w-full"
                >
                  <option value="draft">{tProducts('status.draft')}</option>
                  <option value="active">{tProducts('status.active')}</option>
                  <option value="inactive">{tProducts('status.inactive')}</option>
                </select>
              </Field>
              <Field label={tBasic('category')}>
                <select
                  value={basicForm.category}
                  onChange={(e) => setBasicForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="app-input w-full"
                >
                  <option value="">{tBasic('categorySelect')}</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={tBasic('subCategory')}>
                <select
                  value={basicForm.subCategory}
                  onChange={(e) => setBasicForm((prev) => ({ ...prev, subCategory: e.target.value }))}
                  className="app-input w-full"
                >
                  <option value="">{tBasic('subCategorySelect')}</option>
                  {subCategories.map((subCategory) => (
                    <option key={subCategory} value={subCategory}>
                      {subCategory}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label={
                editLocale === 'ko'
                  ? tCommon('productSummaryKo')
                  : editLocale === 'en'
                    ? tCommon('productSummaryEn')
                    : `${tCommon('productSummaryEn')} (${getAdminEditLocaleLabel(editLocale)})`
              }
            >
              <textarea
                value={readTranslated('summary')}
                onChange={(e) => writeTranslated('summary', e.target.value)}
                className="app-input min-h-[88px] w-full resize-y"
              />
            </Field>
          </div>
        ) : null}

        {section === 'tour-details' ? (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tBasic('totalTourHours')}>
                <Input
                  value={tourForm.duration}
                  onChange={(e) => setTourForm((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder={tBasic('totalTourHoursPlaceholder')}
                />
              </Field>
              <Field label={tBasic('maxParticipants')}>
                <Input
                  type="number"
                  min={1}
                  value={tourForm.maxParticipants}
                  onChange={(e) =>
                    setTourForm((prev) => ({
                      ...prev,
                      maxParticipants: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label={tCommon('tourDepartureTimes')}>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newDepartureTime}
                  onChange={(e) => setNewDepartureTime(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addDepartureTime} disabled={!newDepartureTime}>
                  <Plus className="mr-1 h-4 w-4" />
                  {tCommon('addDepartureTime')}
                </Button>
              </div>
              {tourForm.tourDepartureTimes.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tourForm.tourDepartureTimes.map((time, index) => (
                    <span
                      key={`${time}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                    >
                      {time}
                      <button
                        type="button"
                        onClick={() => removeDepartureTime(index)}
                        className="rounded-full p-0.5 hover:bg-primary/10"
                        aria-label={tCommon('removeDepartureTime')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </Field>
          </div>
        ) : null}

        {section === 'media' ? (
          <div className="rounded-xl border border-border/60 p-2 sm:p-4">
            <p className="mb-4 px-2 text-sm text-muted-foreground">{t('mediaHint')}</p>
            <ProductMediaTab
              productId={product.id}
              isNewProduct={false}
              formData={{}}
              setFormData={() => {}}
            />
          </div>
        ) : null}

        {section === 'tags' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('tagsHint')}</p>
            <ProductTagsBilingualEditor
              selectedTags={tagKeys}
              onTagsChange={setTagKeys}
              onTranslationsChange={setTagTranslations}
            />
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {section === 'media' ? (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => void handleDialogOpenChange(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
      )}
    </Dialog>
  )
}
