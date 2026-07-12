'use client'

import { Suspense, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCustomerPageDisplayBindings } from '@/hooks/useCustomerPageDisplayBindings'
import HomeSectionRenderer from '@/components/home/HomeSectionRenderer'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import CustomerPagePreviewHighlightEffect from '@/components/product/CustomerPagePreviewHighlightEffect'
import { useCustomerPageHomeLayoutSections } from '@/hooks/useCustomerPageHomeLayout'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import { useCustomerPageFieldBindings } from '@/components/product/CustomerPageFieldBindingsProvider'
import { HOME_CATEGORY_GRID_ITEMS } from '@/lib/homeCategoryGridData'

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">…</div>}>
      <HomePageInner />
    </Suspense>
  )
}

function HomePageInner() {
  const t = useTranslations('common')
  const locale = useLocale()
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const { ready: customerPageConfigReady } = useCustomerPageFieldBindings()
  const { active: bindingsActive, revision: bindingRevision } = useCustomerPageDisplayBindings()
  const { userRole } = useAuth()
  const [isChangingOrder, setIsChangingOrder] = useState(false)
  
  const isAdmin = userRole === 'admin' || userRole === 'manager'

  const getPriceLabel = (price: number | null) => {
    if (price == null) {
      return locale === 'en' ? 'Pricing to be announced' : '가격 정보 준비 중'
    }

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price)

    return locale === 'en' ? `${t('startingFrom')} ${formatted}` : `${formatted}${t('startingFrom')}`
  }

  const handleChangeFavoriteOrder = async (productId: string, direction: 'up' | 'down') => {
    if (!isAdmin) return

    try {
      setIsChangingOrder(true)

      const { data: favoriteProducts, error: loadError } = await supabase
        .from('products')
        .select('id, favorite_order')
        .eq('status', 'active')
        .eq('is_favorite', true)
        .order('favorite_order', { ascending: true })

      if (loadError || !favoriteProducts?.length) return

      const currentIndex = favoriteProducts.findIndex((p) => p.id === productId)
      if (currentIndex === -1) return

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= favoriteProducts.length) return

      const reordered = [...favoriteProducts]
      const [moved] = reordered.splice(currentIndex, 1)
      reordered.splice(targetIndex, 0, moved)

      const results = await Promise.all(
        reordered.map((product, index) =>
          supabase.from('products').update({ favorite_order: index }).eq('id', product.id)
        )
      )

      if (results.some((result) => result.error)) {
        alert(locale === 'en' ? 'Failed to update order.' : '순서 변경 중 오류가 발생했습니다.')
        return
      }

      emitCustomerPageBindingsUpdate()
    } catch (error) {
      console.error('Error changing favorite order:', error)
      alert(locale === 'en' ? 'Failed to update order.' : '순서 변경 중 오류가 발생했습니다.')
    } finally {
      setIsChangingOrder(false)
    }
  }

  const stats = [
    { number: t('statsSatisfiedCustomersNumber'), label: t('satisfiedCustomers') },
    { number: t('statsSuccessfulToursNumber'), label: t('successfulTours') },
    { number: t('statsProfessionalGuidesNumber'), label: t('professionalGuides') },
    { number: t('statsAverageRatingNumber'), label: t('averageRating') },
  ]

  const features = [
    {
      icon: CheckCircle,
      title: t('professionalGuide'),
      description: t('professionalGuideDesc')
    },
    {
      icon: CheckCircle,
      title: t('customizedService'),
      description: t('customizedServiceDesc')
    },
    {
      icon: CheckCircle,
      title: t('safetyGuaranteed'),
      description: t('safetyGuaranteedDesc')
    },
    {
      icon: CheckCircle,
      title: t('support24_7'),
      description: t('support24_7Desc')
    }
  ]

  const categoryTags = HOME_CATEGORY_GRID_ITEMS

  const orderedHomeSections = useCustomerPageHomeLayoutSections(false)
  const layoutEditMode = isPreview && isEditMode
  const showCardEditZones = isPreview && isEditMode
  const showHomeContent = customerPageConfigReady || layoutEditMode

  const renderSection = (section: (typeof orderedHomeSections)[number]['section']) => (
    <HomeSectionRenderer
      section={section}
      locale={locale}
      t={t}
      categoryTags={categoryTags}
      stats={stats}
      features={features}
      bindingsActive={bindingsActive}
      bindingRevision={bindingRevision}
      isAdmin={isAdmin}
      isChangingOrder={isChangingOrder}
      showCardEditZones={showCardEditZones}
      isPreview={isPreview}
      isEditMode={isEditMode}
      onChangeFavoriteOrder={handleChangeFavoriteOrder}
      getPriceLabel={getPriceLabel}
    />
  )

  return (
    <CustomerPageShell locale={locale}>
      <div className="maniatour-home min-h-screen bg-white">
        {!showHomeContent ? (
          <div className="kv-hero min-h-[28rem] bg-[#1a1a1a]" aria-busy="true" aria-live="polite" />
        ) : (
          <>
            <CustomerPagePreviewHighlightEffect />
            {orderedHomeSections.map(({ section }) => (
              <div key={section.instanceId}>{renderSection(section)}</div>
            ))}
          </>
        )}
      </div>
    </CustomerPageShell>
  )
}
