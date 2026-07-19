'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Copy, Star, Tags, Trash2, RotateCcw } from 'lucide-react'
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
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId, withOperatorId } from '@/lib/operators/scopeQuery'
import { cloneAdminProduct } from '@/lib/adminProductClone'
import {
  isAdminProductSoftDeleted,
  restoreAdminProduct,
  softDeleteAdminProduct,
} from '@/lib/adminProductDelete'
import { getProductLocalizedField } from '@/lib/productFieldTranslations'
import { normalizeSiteLocale } from '@/lib/siteLocales'

type Product = Database['public']['Tables']['products']['Row']

interface ProductCardProps {
  product: Product
  locale: string
  displayLocale?: AdminProductCardPreviewLocale
  priority?: boolean
  canSoftDelete?: boolean
  onSoftDeleted?: (productId: string) => void
  onRestored?: (productId: string) => void
  onStatusChange?: (productId: string, newStatus: string) => void
  onPublishChange?: (productId: string, isPublished: boolean) => void
  onProductCopied?: (newProductId: string) => void
  onFavoriteToggle?: (productId: string, isFavorite: boolean) => void
  onRibbonToggle?: (productId: string, tags: string[]) => void
  onProductUpdated?: (productId: string, updates: Partial<Product>) => void
}

function getCustomerDisplayName(product: Product, locale: string) {
  const localized = getProductLocalizedField(
    product,
    'customer_name',
    normalizeSiteLocale(locale)
  )
  if (localized) return localized
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
  canSoftDelete = false,
  onSoftDeleted,
  onRestored,
  onStatusChange,
  onPublishChange,
  onProductCopied,
  onFavoriteToggle,
  onRibbonToggle,
  onProductUpdated,
}: ProductCardProps) {
  const t = useTranslations('products')
  const tCardEdit = useTranslations('products.cardEditModal')
  const tEdit = useTranslations('products.edit')
  const router = useRouter()
  const { operatorId } = useOperatorOptional()
  const cardLocale: AdminProductCardPreviewLocale =
    displayLocale ?? (locale === 'en' ? 'en' : 'ko')
  const previewLabels = getProductCardPreviewLabels(cardLocale)
  const [isUpdating, setIsUpdating] = useState(false)
  const [localStatus, setLocalStatus] = useState(product.status || 'inactive')
  const [localPublished, setLocalPublished] = useState(product.is_published !== false)
  const [isUpdatingPublish, setIsUpdatingPublish] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isSoftDeleting, setIsSoftDeleting] = useState(false)
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
    setLocalStatus(product.status || 'inactive')
    setIsFavorite(Boolean(product.is_favorite))
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

    if (isUpdating || isAdminProductSoftDeleted(localStatus)) return

    const newStatus = localStatus === 'active' ? 'inactive' : 'active'

    try {
      setIsUpdating(true)
      setLocalStatus(newStatus)

      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', localProduct.id)
        .eq('operator_id', resolveOperatorId(operatorId))

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
        .eq('operator_id', resolveOperatorId(operatorId))

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
        const { data: favorites } = await withOperatorId(
          supabase
            .from('products')
            .select('favorite_order')
            .eq('is_favorite', true)
            .not('favorite_order', 'is', null)
            .order('favorite_order', { ascending: false })
            .limit(1),
          operatorId
        )

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
        .eq('operator_id', resolveOperatorId(operatorId))

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

      const result = await cloneAdminProduct(
        supabase,
        product.id,
        operatorId,
        locale === 'en' ? 'en' : 'ko'
      )

      alert(
        locale === 'en'
          ? `Product copied. New id: ${result.newProductId}`
          : `상품이 복사되었습니다. (초이스 ${result.counts.choices}, 가격 ${result.counts.pricing}건)\n새 ID: ${result.newProductId}`
      )
      onProductCopied?.(result.newProductId)
      window.location.href = `/${locale}/admin/products/${result.newProductId}`
    } catch (error) {
      console.error('상품 복사 중 예상치 못한 오류:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert(locale === 'en' ? `Copy failed: ${msg}` : `상품 복사 중 오류: ${msg}`)
    } finally {
      setIsCopying(false)
    }
  }

  const handleSoftDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canSoftDelete || isSoftDeleting || isAdminProductSoftDeleted(localStatus)) return

    const name = getCustomerDisplayName(localProduct, locale)
    if (!window.confirm(t('softDeleteConfirm', { name }))) return

    try {
      setIsSoftDeleting(true)
      await softDeleteAdminProduct(supabase, product.id, operatorId)
      setLocalStatus('deleted')
      setLocalPublished(false)
      setIsFavorite(false)
      setLocalProduct((prev) => ({
        ...prev,
        status: 'deleted',
        is_published: false,
        is_favorite: false,
      }))
      onSoftDeleted?.(product.id)
      alert(tEdit('softDeleteSuccess'))
    } catch (error) {
      console.error('상품 soft delete 오류:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert(`${tEdit('softDeleteError')}\n\n${msg}`)
    } finally {
      setIsSoftDeleting(false)
    }
  }

  const handleRestore = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canSoftDelete || isSoftDeleting || !isAdminProductSoftDeleted(localStatus)) return

    try {
      setIsSoftDeleting(true)
      await restoreAdminProduct(supabase, product.id, operatorId)
      setLocalStatus('inactive')
      setLocalPublished(false)
      setLocalProduct((prev) => ({
        ...prev,
        status: 'inactive',
        is_published: false,
      }))
      onRestored?.(product.id)
      alert(tEdit('restoreSuccess'))
    } catch (error) {
      console.error('상품 복구 오류:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert(`${tEdit('restoreError')}\n\n${msg}`)
    } finally {
      setIsSoftDeleting(false)
    }
  }

  const handleRibbonSelect = async (selection: ProductListingRibbonSelection) => {
    if (isTogglingRibbon) return

    const nextTags = applyProductListingRibbonSelection(localTags, selection)

    try {
      setIsTogglingRibbon(true)
      setLocalTags(nextTags)

      const { error } = await supabase
        .from('products')
        .update({ tags: nextTags })
        .eq('id', product.id)
        .eq('operator_id', resolveOperatorId(operatorId))

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
        : localStatus === 'deleted'
          ? t('status.deleted')
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
        disabled={isTogglingFavorite || isAdminProductSoftDeleted(localStatus)}
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

      {canSoftDelete ? (
        isAdminProductSoftDeleted(localStatus) ? (
          <button
            type="button"
            onClick={handleRestore}
            disabled={isSoftDeleting}
            className={`rounded p-1 transition-colors ${
              isSoftDeleting
                ? 'cursor-not-allowed text-gray-400'
                : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
            title={tEdit('restore')}
            aria-label={tEdit('restore')}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSoftDelete}
            disabled={isSoftDeleting}
            className={`rounded p-1 transition-colors ${
              isSoftDeleting
                ? 'cursor-not-allowed text-gray-400'
                : 'text-red-600 hover:bg-red-50 hover:text-red-800'
            }`}
            title={tEdit('delete')}
            aria-label={tEdit('delete')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )
      ) : null}

      <button
        type="button"
        onClick={handleStatusToggle}
        disabled={isUpdating || isAdminProductSoftDeleted(localStatus)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          localStatus === 'active' ? 'bg-blue-600' : 'bg-gray-200'
        } ${isUpdating || isAdminProductSoftDeleted(localStatus) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
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
        disabled={isUpdatingPublish || isAdminProductSoftDeleted(localStatus)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
          localPublished ? 'bg-emerald-600' : 'bg-gray-200'
        } ${isUpdatingPublish || isAdminProductSoftDeleted(localStatus) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
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
