'use client'

import React, { useEffect, useState } from 'react'
import { ArrowRight, Play, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'

interface PopularProduct {
  id: string
  name: string
  name_en: string | null
  description: string | null
  category: string | null
  base_price: number | null
  primary_image: string | null
}

export default function HomePage() {
  const t = useTranslations('common')
  const locale = useLocale()
  const [popularTours, setPopularTours] = useState<PopularProduct[]>([])
  const [popularLoading, setPopularLoading] = useState(true)
  const [popularError, setPopularError] = useState<string | null>(null)

  const getProductName = (product: PopularProduct) => {
    if (locale === 'en') {
      const englishName = product.name_en?.trim()
      if (englishName && englishName.length > 0) {
        return englishName
      }
    }

    const baseName = product.name?.trim()
    if (baseName && baseName.length > 0) {
      return baseName
    }

    const fallbackName = locale === 'en' ? 'Untitled Tour' : '이름 없는 투어'
    return fallbackName
  }

  const getProductDescription = (product: PopularProduct) => {
    if (product.description && product.description.trim().length > 0) {
      return product.description
    }

    return locale === 'en' ? 'Detailed information is being prepared.' : '상세 정보가 준비 중입니다.'
  }

  const getPriceLabel = (price: number | null) => {
    if (price == null) {
      return locale === 'en' ? 'Pricing to be announced' : '가격 정보 준비 중'
    }

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price)

    return locale === 'en' ? `${t('startingFrom')} ${formatted}` : `${formatted}${t('startingFrom')}`
  }

  useEffect(() => {
    const fetchPopularTours = async () => {
      setPopularLoading(true)
      setPopularError(null)

      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, name_en, description, base_price, category')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(3)

        if (error) {
          console.error('Failed to load popular tours:', error)
          setPopularError(locale === 'en' ? 'Failed to load popular tours.' : '인기 투어를 불러오지 못했습니다.')
          setPopularTours([])
          return
        }

        const rows = (data ?? []).map((product) => ({
          id: product.id,
          name: product.name,
          name_en: product.name_en,
          description: product.description,
          base_price: product.base_price,
          category: product.category
        }))

        const productsWithImages = await Promise.all(
          rows.map(async (product) => {
            let primaryImage: string | null = null

            const { data: primaryMedia, error: primaryError } = await supabase
              .from('product_media')
              .select('file_url')
              .eq('product_id', product.id)
              .eq('file_type', 'image')
              .eq('is_active', true)
              .eq('is_primary', true)
              .single()

            if (!primaryError && primaryMedia && 'file_url' in primaryMedia) {
              primaryImage = (primaryMedia as { file_url: string }).file_url
            } else {
              const { data: firstMedia, error: firstError } = await supabase
                .from('product_media')
                .select('file_url')
                .eq('product_id', product.id)
                .eq('file_type', 'image')
                .eq('is_active', true)
                .order('order_index', { ascending: true })
                .limit(1)
                .single()

              if (!firstError && firstMedia && 'file_url' in firstMedia) {
                primaryImage = (firstMedia as { file_url: string }).file_url
              }
            }

            return {
              ...product,
              primary_image: primaryImage
            }
          })
        )

        setPopularTours(productsWithImages)
      } catch (error) {
        console.error('Failed to load popular tours:', error)
        setPopularError(locale === 'en' ? 'Failed to load popular tours.' : '인기 투어를 불러오지 못했습니다.')
        setPopularTours([])
      } finally {
        setPopularLoading(false)
      }
    }

    fetchPopularTours()
  }, [locale])

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

  return (
    <div className="min-h-screen">
      {/* 히어로 섹션 - 모바일 최적화 */}
      <section className="relative bg-gradient-to-r from-blue-900 to-purple-900 text-white">
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6">
              {t('unforgettable')}
              <br />
              {t('specialTravelExperience')}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl mb-6 sm:mb-8 text-blue-100">
              {t('heroSubtitle1')}
              <br />
              {t('heroSubtitle2')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href={`/${locale}/products`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center"
              >
                {t('browseTours')}
                <ArrowRight className="ml-2" size={20} />
              </Link>
              <button className="bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center">
                <Play className="mr-2" size={20} />
                {t('watchIntroVideo')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 태그 아이콘 섹션 - 모바일 최적화 */}
      <section className="py-8 sm:py-12 lg:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              {t('findToursByCategory')}
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              {t('findToursByCategoryDesc')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
            {categoryTags.map((category) => (
              <Link
                key={category.labelKey}
                href={`/${locale}/products?tag=${encodeURIComponent(category.tagQuery)}`}
                className={`group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br ${category.gradient} rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg ${category.hoverGradient}`}
              >
                <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                  {category.emoji}
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                  {t(category.labelKey)}
                </h3>
              </Link>
            ))}
          </div>

          {/* 더 많은 태그 보기 링크 */}
          <div className="text-center mt-8 sm:mt-12">
            <Link
              href={`/${locale}/products/tags`}
              className="inline-flex items-center px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors font-medium"
            >
              🏷️ {t('viewAllTags')}
              <ArrowRight className="ml-2" size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* 통계 섹션 - 모바일 최적화 */}
      <section className="py-8 sm:py-12 lg:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-600 mb-1 sm:mb-2">
                  {stat.number}
                </div>
                <div className="text-sm sm:text-base text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 인기 투어 섹션 - 모바일 최적화 */}
      <section className="py-8 sm:py-12 lg:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              {t('popularTours')}
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              {t('popularToursDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {popularLoading && (
              <div className="col-span-full flex justify-center py-10 text-gray-500">
                {t('loading')}
              </div>
            )}

            {!popularLoading && popularError && (
              <div className="col-span-full flex justify-center py-10 text-center text-gray-500">
                {popularError}
              </div>
            )}

            {!popularLoading && !popularError && popularTours.length === 0 && (
              <div className="col-span-full flex justify-center py-10 text-center text-gray-500">
                {locale === 'en' ? 'No popular tours are available yet.' : '등록된 인기 투어가 없습니다.'}
              </div>
            )}

            {!popularLoading && !popularError &&
              popularTours.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative h-40 sm:h-48 bg-gray-200">
                    <img
                      src={product.primary_image ?? '/placeholder-tour.svg'}
                      alt={getProductName(product)}
                      className="w-full h-full object-cover"
                    />
                    {product.category && (
                      <div className="absolute top-2 sm:top-3 left-2 sm:left-3">
                        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {product.category}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                      <Link href={`/${locale}/products/${product.id}`} className="hover:text-blue-600">
                        {getProductName(product)}
                      </Link>
                    </h3>
                    <p className="text-gray-600 text-sm mb-3 sm:mb-4 line-clamp-2">
                      {getProductDescription(product)}
                    </p>
                    <div className="mb-3 sm:mb-4">
                      <span className="text-base sm:text-lg font-bold text-blue-600">
                        {getPriceLabel(product.base_price)}
                      </span>
                    </div>
                    <Link
                      href={`/${locale}/products/${product.id}`}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center block text-sm sm:text-base"
                    >
                      {t('viewDetails')}
                    </Link>
                  </div>
                </div>
              ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href={`/${locale}/products`}
              className="inline-flex items-center px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors font-medium"
            >
              {t('viewAllTours')}
              <ArrowRight className="ml-2" size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* 특징 섹션 - 모바일 최적화 */}
      <section className="py-8 sm:py-12 lg:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              {t('whyChooseUs')}
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              {t('whyChooseUsDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="flex items-start">
                  <div className="flex-shrink-0">
                    <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
                  </div>
                  <div className="ml-3 sm:ml-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600">
                      {feature.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA 섹션 - 모바일 최적화 */}
      <section className="py-8 sm:py-12 lg:py-16 bg-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            {t('startYourJourney')}
          </h2>
          <p className="text-lg sm:text-xl text-blue-100 mb-6 sm:mb-8">
            {t('contactUs')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              href="/ko/products"
              className="bg-white text-blue-900 hover:bg-gray-100 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-colors"
            >
              {t('browseTours')}
            </Link>
            <button className="border-2 border-white text-white hover:bg-white hover:text-blue-900 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-colors">
              {t('contact')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
