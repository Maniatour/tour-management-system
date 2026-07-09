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
import { getHomeSectionEntryLabel } from '@/lib/customerPageHomeLayout'
import CustomerPageHomeSectionFrame from '@/components/product/CustomerPageHomeSectionFrame'
import CustomerPageHomeLayoutGuideBar from '@/components/product/CustomerPageHomeLayoutGuideBar'

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
    { number: '10,000+', label: t('satisfiedCustomers') },
    { number: '500+', label: t('successfulTours') },
    { number: '50+', label: t('professionalGuides') },
    { number: '4.8', label: t('averageRating') }
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

  const categoryTags = [
    {
      labelKey: 'antelopeCanyon',
      tagQuery: '앤텔롭',
      emoji: '🏜️',
      gradient: 'from-yellow-50 to-orange-50',
      hoverGradient: 'hover:from-yellow-100 hover:to-orange-100'
    },
    {
      labelKey: 'grandCanyon',
      tagQuery: '그랜드캐년',
      emoji: '🏔️',
      gradient: 'from-orange-50 to-red-50',
      hoverGradient: 'hover:from-orange-100 hover:to-red-100'
    },
    {
      labelKey: 'suburbanTour',
      tagQuery: '근교',
      emoji: '🗺️',
      gradient: 'from-green-50 to-emerald-50',
      hoverGradient: 'hover:from-green-100 hover:to-emerald-100'
    },
    {
      labelKey: 'dayTour',
      tagQuery: '당일',
      emoji: '🛣️',
      gradient: 'from-blue-50 to-cyan-50',
      hoverGradient: 'hover:from-blue-100 hover:to-cyan-100'
    },
    {
      labelKey: 'accommodationTour',
      tagQuery: '숙박',
      emoji: '🏕️',
      gradient: 'from-purple-50 to-pink-50',
      hoverGradient: 'hover:from-purple-100 hover:to-pink-100'
    },
    {
      labelKey: 'cityTour',
      tagQuery: '시티',
      emoji: '🏙️',
      gradient: 'from-indigo-50 to-blue-50',
      hoverGradient: 'hover:from-indigo-100 hover:to-blue-100'
    },
    {
      labelKey: 'helicopterTour',
      tagQuery: '헬기',
      emoji: '🚁',
      gradient: 'from-red-50 to-pink-50',
      hoverGradient: 'hover:from-red-100 hover:to-pink-100'
    },
    {
      labelKey: 'lightAircraftTour',
      tagQuery: '경비행기',
      emoji: '✈️',
      gradient: 'from-sky-50 to-blue-50',
      hoverGradient: 'hover:from-sky-100 hover:to-blue-100'
    },
    {
      labelKey: 'busTour',
      tagQuery: '버스',
      emoji: '🚌',
      gradient: 'from-yellow-50 to-orange-50',
      hoverGradient: 'hover:from-yellow-100 hover:to-orange-100'
    },
    {
      labelKey: 'premiumTour',
      tagQuery: '프리미엄',
      emoji: '⭐',
      gradient: 'from-amber-50 to-yellow-50',
      hoverGradient: 'hover:from-amber-100 hover:to-yellow-100'
    },
    {
      labelKey: 'performanceTicket',
      tagQuery: '공연',
      emoji: '🎫',
      gradient: 'from-orange-50 to-red-50',
      hoverGradient: 'hover:from-orange-100 hover:to-red-100'
    },
    {
      labelKey: 'attraction',
      tagQuery: '어트랙션',
      emoji: '🎪',
      gradient: 'from-purple-50 to-pink-50',
      hoverGradient: 'hover:from-purple-100 hover:to-pink-100'
    }
  ]

  const orderedHomeSections = useCustomerPageHomeLayoutSections(isPreview && isEditMode)
  const layoutEditMode = isPreview && isEditMode
  const showCardEditZones = isPreview && isEditMode

  return (
    <div className="min-h-screen">
      <CustomerPagePreviewHighlightEffect />
      {layoutEditMode && <CustomerPageHomeLayoutGuideBar />}
      {orderedHomeSections.map(({ section, orderIndex, visible }) => (
        <CustomerPageHomeSectionFrame
          key={section.instanceId}
          instanceId={section.instanceId}
          sectionLabel={getHomeSectionEntryLabel(section)}
          orderIndex={orderIndex}
          totalSections={orderedHomeSections.length}
          visible={visible}
          layoutEditMode={layoutEditMode}
        >
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
        </CustomerPageHomeSectionFrame>
      ))}
    </div>
  )
}
