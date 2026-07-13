'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import DynamicPricingManager from '@/components/DynamicPricingManager'
import ProductMediaTab from '@/components/product/ProductMediaTab'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  type AdminEditLocale,
} from '@/lib/adminEditLocales'

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
  const [newDepartureTime, setNewDepartureTime] = useState('')
  const [editLocale, setEditLocale] = useState<AdminEditLocale>('ko')

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
    setNewDepartureTime('')
  }, [section, product])

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
      }

      if (section === 'basic') {
        if (!basicForm.name.trim() || !basicForm.category || !basicForm.subCategory) {
          setError(t('basicValidation'))
          setSaving(false)
          return
        }
        updates = {
          name: basicForm.name.trim(),
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
    section === 'pricing'
      ? 'w-[min(98vw,96rem)] !max-w-[min(98vw,96rem)] max-h-[92vh] overflow-y-auto'
      : section === 'media'
        ? 'max-w-[min(96vw,72rem)] max-h-[90vh] overflow-y-auto'
        : 'max-w-2xl max-h-[90vh] overflow-y-auto'

  return (
    <Dialog open={section != null} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={dialogSize}>
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

        {section === 'location' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {editLocale === 'ko' ? (
              <>
                <Field label={tBasic('departureCity')}>
                  <Input
                    value={locationForm.departureCityKo}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, departureCityKo: e.target.value }))}
                  />
                </Field>
                <Field label={tBasic('arrivalCity')}>
                  <Input
                    value={locationForm.arrivalCityKo}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, arrivalCityKo: e.target.value }))}
                  />
                </Field>
                <Field label={tBasic('departureCountry')}>
                  <Input
                    value={locationForm.departureCountryKo}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, departureCountryKo: e.target.value }))}
                  />
                </Field>
                <Field label={tBasic('arrivalCountry')}>
                  <Input
                    value={locationForm.arrivalCountryKo}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, arrivalCountryKo: e.target.value }))}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label={tBasic('departureCity')}>
                  <Input
                    value={locationForm.departureCityEn}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, departureCityEn: e.target.value }))}
                  />
                </Field>
                <Field label={tBasic('arrivalCity')}>
                  <Input
                    value={locationForm.arrivalCityEn}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, arrivalCityEn: e.target.value }))}
                  />
                </Field>
                <Field label={tBasic('departureCountry')}>
                  <Input
                    value={locationForm.departureCountryEn}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, departureCountryEn: e.target.value }))}
                  />
                </Field>
                <Field label={tBasic('arrivalCountry')}>
                  <Input
                    value={locationForm.arrivalCountryEn}
                    onChange={(e) => setLocationForm((prev) => ({ ...prev, arrivalCountryEn: e.target.value }))}
                  />
                </Field>
              </>
            )}
          </div>
        ) : null}

        {section === 'basic' ? (
          <div className="grid gap-4">
            {editLocale === 'ko' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tBasic('nameInternalKo')}>
                  <Input
                    value={basicForm.name}
                    onChange={(e) => setBasicForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </Field>
                <Field label={tBasic('nameCustomerKo')}>
                  <Input
                    value={basicForm.customerNameKo}
                    onChange={(e) => setBasicForm((prev) => ({ ...prev, customerNameKo: e.target.value }))}
                  />
                </Field>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tBasic('nameInternalEn')}>
                  <Input
                    value={basicForm.nameEn}
                    onChange={(e) => setBasicForm((prev) => ({ ...prev, nameEn: e.target.value }))}
                  />
                </Field>
                <Field label={tBasic('nameCustomerEn')}>
                  <Input
                    value={basicForm.customerNameEn}
                    onChange={(e) => setBasicForm((prev) => ({ ...prev, customerNameEn: e.target.value }))}
                  />
                </Field>
              </div>
            )}
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
            <Field label={editLocale === 'ko' ? tCommon('productSummaryKo') : tCommon('productSummaryEn')}>
              <textarea
                value={editLocale === 'ko' ? basicForm.summaryKo : basicForm.summaryEn}
                onChange={(e) =>
                  setBasicForm((prev) =>
                    editLocale === 'ko'
                      ? { ...prev, summaryKo: e.target.value }
                      : { ...prev, summaryEn: e.target.value }
                  )
                }
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

        {section === 'pricing' ? (
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

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {section === 'media' ? (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => void handleDialogOpenChange(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        ) : section !== 'pricing' ? (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t('close')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('saveBasePrice')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
