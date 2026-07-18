'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Copy, Star, Tags } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import ProductsGygCard from '@/components/products/ProductsGygCard'
import ProductListingRibbonPicker from '@/components/products/ProductListingRibbonPicker'
import { formatProductDepartureLine, resolveProductListingPrice } from '@/lib/productDetailDisplay'
import {
  applyProductListingRibbonSelection,
  type ProductListingRibbonSelection,
} from '@/lib/productListingRibbon'
import {
  getProductCardPreviewLabels,
  type AdminProductCardPreviewLocale,
} from '@/lib/adminProductCardPreviewLabels'
import AdminProductCardEditModals from '@/components/admin/product-card/AdminProductCardEditModals'
import type { AdminProductCardEditSection } from '@/lib/adminProductCardEdit'
import { buildAdminProductCustomerEditPath } from '@/lib/adminProductCustomerEdit'

type Product = Database['public']['Tables']['products']['Row']

interface ProductCardProps {
  product: Product
  locale: string
  displayLocale?: AdminProductCardPreviewLocale
  priority?: boolean
  onStatusChange?: (productId: string, newStatus: string) => void
  onPublishChange?: (productId: string, isPublished: boolean) => void
  onProductCopied?: (newProductId: string) => void
  onFavoriteToggle?: (productId: string, isFavorite: boolean) => void
  onRibbonToggle?: (productId: string, tags: string[]) => void
  onProductUpdated?: (productId: string, updates: Partial<Product>) => void
}

function getCustomerDisplayName(product: Product, locale: string) {
  if (locale === 'en' && product.customer_name_en) return product.customer_name_en
  return product.customer_name_ko || product.name_ko || product.name
}

function getListingPrice(product: Product) {
  return resolveProductListingPrice(product as unknown as Record<string, unknown>) ?? product.base_price ?? 0
}

export default function ProductCard({
  product,
  locale,
  displayLocale,
  priority = false,
  onStatusChange,
  onPublishChange,
  onProductCopied,
  onFavoriteToggle,
  onRibbonToggle,
  onProductUpdated,
}: ProductCardProps) {
  const t = useTranslations('products')
  const tCardEdit = useTranslations('products.cardEditModal')
  const router = useRouter()
  const cardLocale: AdminProductCardPreviewLocale =
    displayLocale ?? (locale === 'en' ? 'en' : 'ko')
  const previewLabels = getProductCardPreviewLabels(cardLocale)
  const [isUpdating, setIsUpdating] = useState(false)
  const [localStatus, setLocalStatus] = useState(product.status || 'inactive')
  const [localPublished, setLocalPublished] = useState(product.is_published !== false)
  const [isUpdatingPublish, setIsUpdatingPublish] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [isTogglingRibbon, setIsTogglingRibbon] = useState(false)
  const [isFavorite, setIsFavorite] = useState(Boolean(product.is_favorite))
  const [localTags, setLocalTags] = useState<string[]>(product.tags ?? [])
  const [imageError, setImageError] = useState(false)
  const [localProduct, setLocalProduct] = useState(product)
  const [editSection, setEditSection] = useState<AdminProductCardEditSection | null>(null)

  useEffect(() => {
    setLocalProduct(product)
    setLocalPublished(product.is_published !== false)
  }, [product])

  useEffect(() => {
    setLocalTags(localProduct.tags ?? [])
  }, [localProduct.id, localProduct.tags])

  const primaryImage =
    ((localProduct as Record<string, unknown>).primary_image as string | null | undefined) ??
    ((localProduct as Record<string, unknown>).thumbnail_url as string | null | undefined) ??
    null

  const handleProductSaved = (productId: string, updates: Partial<Product>) => {
    if ('primary_image' in updates) {
      setImageError(false)
    }
    if (Array.isArray(updates.tags)) {
      setLocalTags(updates.tags)
    }
    setLocalProduct((prev) => ({ ...prev, ...updates }))
    onProductUpdated?.(productId, updates)
  }

  const openEditSection = (section: AdminProductCardEditSection) => {
    setEditSection(section)
  }

  const handleStatusToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isUpdating) return

    const newStatus = localStatus === 'active' ? 'inactive' : 'active'

    try {
      setIsUpdating(true)
      setLocalStatus(newStatus)

      const { error } = await supabase.from('products').update({ status: newStatus }).eq('id', localProduct.id)

      if (error) {
        console.error('상품 상태 업데이트 오류:', error)
        setLocalStatus(localProduct.status || 'inactive')
        return
      }

      onStatusChange?.(localProduct.id, newStatus)
    } catch (error) {
      console.error('상품 상태 업데이트 중 예상치 못한 오류:', error)
      setLocalStatus(product.status || 'inactive')
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePublishToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isUpdatingPublish) return

    const newPublished = !localPublished

    try {
      setIsUpdatingPublish(true)
      setLocalPublished(newPublished)

      const { error } = await supabase
        .from('products')
        .update({ is_published: newPublished })
        .eq('id', localProduct.id)

      if (error) {
        console.error('상품 배포 상태 업데이트 오류:', error)
        setLocalPublished(localProduct.is_published !== false)
        return
      }

      setLocalProduct((prev) => ({ ...prev, is_published: newPublished }))
      onPublishChange?.(localProduct.id, newPublished)
      onProductUpdated?.(localProduct.id, { is_published: newPublished })
    } catch (error) {
      console.error('상품 배포 상태 업데이트 중 예상치 못한 오류:', error)
      setLocalPublished(product.is_published !== false)
    } finally {
      setIsUpdatingPublish(false)
    }
  }

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isTogglingFavorite) return

    const newFavoriteStatus = !isFavorite

    try {
      setIsTogglingFavorite(true)
      setIsFavorite(newFavoriteStatus)

      let favoriteOrder: number | null = null
      if (newFavoriteStatus) {
        const { data: favorites } = await supabase
          .from('products')
          .select('favorite_order')
          .eq('is_favorite', true)
          .not('favorite_order', 'is', null)
          .order('favorite_order', { ascending: false })
          .limit(1)

        favoriteOrder =
          favorites && favorites.length > 0 ? ((favorites[0] as { favorite_order: number }).favorite_order || 0) + 1 : 1
      }

      const { error } = await supabase
        .from('products')
        .update({
          is_favorite: newFavoriteStatus,
          favorite_order: favoriteOrder,
        })
        .eq('id', product.id)

      if (error) {
        console.error('즐겨찾기 상태 업데이트 오류:', error)
        setIsFavorite(Boolean(product.is_favorite))
        return
      }

      onFavoriteToggle?.(product.id, newFavoriteStatus)
    } catch (error) {
      console.error('즐겨찾기 상태 업데이트 중 예상치 못한 오류:', error)
      setIsFavorite(Boolean(product.is_favorite))
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  const handleCopyProduct = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isCopying) return

    try {
      setIsCopying(true)

      const copyData = {
        name: locale === 'en' ? `${product.name_en || product.name} (Copy)` : `${product.name} (복사본)`,
        name_en: product.name_en ? `${product.name_en} (Copy)` : null,
        product_code: product.product_code ? `${product.product_code}_COPY` : null,
        category: product.category,
        sub_category: product.sub_category,
        description: product.description,
        duration: product.duration,
        base_price: product.base_price,
        max_participants: product.max_participants,
        status: 'draft' as const,
        departure_city: product.departure_city,
        arrival_city: product.arrival_city,
        departure_country: product.departure_country,
        arrival_country: product.arrival_country,
        languages: product.languages,
        group_size: product.group_size,
        adult_age: product.adult_age,
        child_age_min: product.child_age_min,
        child_age_max: product.child_age_max,
        infant_age: product.infant_age,
        tags: product.tags,
      }

      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert(copyData)
        .select()
        .single()

      if (productError) {
        console.error('상품 복사 오류:', productError)
        alert('상품 복사 중 오류가 발생했습니다.')
        return
      }

      const newProductData = newProduct as { id: string } | null
      alert(`상품이 성공적으로 복사되었습니다! 새 상품 ID: ${newProductData?.id}`)
      onProductCopied?.(newProductData?.id || '')
      window.location.href = `/${locale}/admin/products/${newProductData?.id}`
    } catch (error) {
      console.error('상품 복사 중 예상치 못한 오류:', error)
      alert('상품 복사 중 오류가 발생했습니다.')
    } finally {
      setIsCopying(false)
    }
  }

  const handleRibbonSelect = async (selection: ProductListingRibbonSelection) => {
    if (isTogglingRibbon) return

    const nextTags = applyProductListingRibbonSelection(localTags, selection)

    try {
      setIsTogglingRibbon(true)
      setLocalTags(nextTags)

      const { error } = await supabase.from('products').update({ tags: nextTags }).eq('id', product.id)

      if (error) {
        console.error('리본 상태 업데이트 오류:', error)
        setLocalTags(product.tags ?? [])
        return
      }

      onRibbonToggle?.(product.id, nextTags)
    } catch (error) {
      console.error('리본 상태 업데이트 중 예상치 못한 오류:', error)
      setLocalTags(product.tags ?? [])
    } finally {
      setIsTogglingRibbon(false)
    }
  }

  const statusLabel =
    localStatus === 'active'
      ? t('status.active')
      : localStatus === 'draft'
        ? t('status.draft')
        : t('status.inactive')

  const adminSelloutBadge = (
    <ProductListingRibbonPicker
      maxParticipants={localProduct.max_participants}
      tags={localTags}
      disabled={isTogglingRibbon}
      previewLocale={cardLocale}
      onSelect={handleRibbonSelect}
    />
  )

  const adminImageActions = (
    <div
      className="admin-product-gyg-card__toolbar"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openEditSection('tags')
        }}
        className="rounded p-1 text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-800"
        title={tCardEdit('editTags')}
        aria-label={tCardEdit('editTags')}
      >
        <Tags className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleFavoriteToggle}
        disabled={isTogglingFavorite}
        className={`rounded p-1 transition-colors ${
          isTogglingFavorite
            ? 'cursor-not-allowed text-gray-400'
            : isFavorite
              ? 'text-yellow-500 hover:bg-yellow-50 hover:text-yellow-600'
              : 'text-gray-400 hover:bg-yellow-50 hover:text-yellow-500'
        }`}
        title={isFavorite ? t('removeFavorite') : t('addFavorite')}
      >
        <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
      </button>

      <button
        type="button"
        onClick={handleCopyProduct}
        disabled={isCopying}
        className={`rounded p-1 transition-colors ${
          isCopying
            ? 'cursor-not-allowed text-gray-400'
            : 'text-green-600 hover:bg-green-50 hover:text-green-900'
        }`}
        title={t('copyProduct')}
      >
        <Copy className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleStatusToggle}
        disabled={isUpdating}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          localStatus === 'active' ? 'bg-blue-600' : 'bg-gray-200'
        } ${isUpdating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        title={statusLabel}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            localStatus === 'active' ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>

      <button
        type="button"
        onClick={handlePublishToggle}
        disabled={isUpdatingPublish}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
          localPublished ? 'bg-emerald-600' : 'bg-gray-200'
        } ${isUpdatingPublish ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        title={localPublished ? t('unpublish') : t('publish')}
        aria-label={t('publishToggle')}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            localPublished ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )

  const openCustomerPageEdit = () => {
    if (editSection) return
    router.push(buildAdminProductCustomerEditPath(locale, localProduct.id))
  }

  return (
    <>
      <div
        className="admin-product-gyg-card admin-product-gyg-card--open-editor"
        onClick={openCustomerPageEdit}
        onKeyDown={(event) => {
          if (editSection) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openCustomerPageEdit()
          }
        }}
        role="link"
        tabIndex={0}
        title={t('openCustomerPageEdit')}
      >
        <ProductsGygCard
          locale={cardLocale}
          href={`/${cardLocale}/products/${localProduct.id}`}
          product={{
            id: localProduct.id,
            primary_image: primaryImage,
            duration: localProduct.duration,
            max_participants: localProduct.max_participants,
            departure_city: localProduct.departure_city,
            tags: localTags,
          }}
          title={getCustomerDisplayName(localProduct, cardLocale)}
          locationLine={formatProductDepartureLine(localProduct, cardLocale) || null}
          price={getListingPrice(localProduct)}
          priceLabel={previewLabels.listingFromPrice}
          imageError={imageError}
          onImageError={() => setImageError(true)}
          likelyToSellOutLabel={previewLabels.likelyToSellOut}
          imagePreparingLabel={previewLabels.imagePreparing}
          priority={priority}
          showWishlistButton={false}
          imageOverlay={adminImageActions}
          selloutBadgeSlot={adminSelloutBadge}
          adminCardEdits={{
            editLocationLabel: tCardEdit('editLocation'),
            editTitleLabel: tCardEdit('editBasic'),
            editDurationLabel: tCardEdit('editTourDetails'),
            editPriceLabel: tCardEdit('editPricing'),
            editMediaLabel: tCardEdit('editMedia'),
            onEditLocation: () => openEditSection('location'),
            onEditBasic: () => openEditSection('basic'),
            onEditTourDetails: () => openEditSection('tour-details'),
            onEditPricing: () => openEditSection('pricing'),
            onEditMedia: () => openEditSection('media'),
          }}
        />
      </div>

      <AdminProductCardEditModals
        product={localProduct}
        section={editSection}
        onClose={() => setEditSection(null)}
        onSaved={handleProductSaved}
      />
    </>
  )
}
