'use client'

import React from 'react'
import { Star, MapPin, Users, Calendar, ArrowRight, Play, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

interface FeaturedProduct {
  id: string
  name: string
  description: string
  price: number
  rating: number
  reviewCount: number
  image: string
  category: string
}

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslations('common')
  const locale = useLocale()
  // 자동 리다이렉트 기능 제거 - 사용자가 직접 메뉴에서 선택하도록 함
  const featuredProducts: FeaturedProduct[] = [
    {
      id: '1',
      name: '그랜드서클 1박2일 투어',
      description: '그랜드 캐년, 브라이스 캐년, 자이온 국립공원을 포함한 1박2일 투어',
      price: 299,
      rating: 4.8,
      reviewCount: 127,
      image: '/placeholder-tour.svg',
      category: '자연'
    },
    {
      id: '2',
      name: '모뉴먼트 밸리 일일 투어',
      description: '모뉴먼트 밸리와 앤텔롭 캐년을 방문하는 일일 투어',
      price: 199,
      rating: 4.6,
      reviewCount: 89,
      image: '/images/monument-valley-1.jpg',
      category: '자연'
    },
    {
      id: '3',
      name: '라스베가스 시티 투어',
      description: '라스베가스의 화려한 밤거리와 명소를 둘러보는 시티 투어',
      price: 99,
      rating: 4.4,
      reviewCount: 156,
      image: '/placeholder-tour.svg',
      category: '도시'
    }
  ]

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
            {/* 앤텔롭 캐년 */}
            <Link
              href="/ko/products?tag=앤텔롭"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl hover:from-yellow-100 hover:to-orange-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🏜️
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                앤텔롭 캐년
              </h3>
            </Link>

            {/* 그랜드캐년 */}
            <Link
              href="/ko/products?tag=그랜드캐년"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl hover:from-orange-100 hover:to-red-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🏔️
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                그랜드캐년
              </h3>
            </Link>

            {/* 근교투어 */}
            <Link
              href="/ko/products?tag=근교"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🗺️
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                근교투어
              </h3>
            </Link>

            {/* 당일투어 */}
            <Link
              href="/ko/products?tag=당일"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl hover:from-blue-100 hover:to-cyan-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🛣️
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                당일투어
              </h3>
            </Link>

            {/* 숙박투어 */}
            <Link
              href="/ko/products?tag=숙박"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🏕️
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                숙박투어
              </h3>
            </Link>

            {/* 시티투어 */}
            <Link
              href="/ko/products?tag=시티"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl hover:from-indigo-100 hover:to-blue-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🏙️
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                시티투어
              </h3>
            </Link>

            {/* 헬기 투어 */}
            <Link
              href="/ko/products?tag=헬기"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl hover:from-red-100 hover:to-pink-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🚁
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                헬기 투어
              </h3>
            </Link>

            {/* 경비행기 투어 */}
            <Link
              href="/ko/products?tag=경비행기"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl hover:from-sky-100 hover:to-blue-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                ✈️
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                경비행기 투어
              </h3>
            </Link>

            {/* 버스투어 */}
            <Link
              href="/ko/products?tag=버스"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl hover:from-yellow-100 hover:to-orange-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🚌
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                버스투어
              </h3>
            </Link>

            {/* 프리미엄 투어 */}
            <Link
              href="/ko/products?tag=프리미엄"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl hover:from-amber-100 hover:to-yellow-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                ⭐
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                프리미엄 투어
              </h3>
            </Link>

            {/* 공연티켓 */}
            <Link
              href="/ko/products?tag=공연"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl hover:from-orange-100 hover:to-red-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🎫
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                공연티켓
              </h3>
            </Link>

            {/* 어트랙션 */}
            <Link
              href="/ko/products?tag=어트랙션"
              className="group flex flex-col items-center p-4 sm:p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">
                🎪
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-800 text-center">
                어트랙션
              </h3>
            </Link>
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
            {featuredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative h-40 sm:h-48 bg-gray-200">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 sm:top-3 left-2 sm:left-3">
                    <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {product.category}
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                    <Link href={`/ko/products/${product.id}`} className="hover:text-blue-600">
                      {product.name}
                    </Link>
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 sm:mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 space-y-2 sm:space-y-0">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-400 mr-1" />
                      <span className="font-medium text-sm sm:text-base">{product.rating}</span>
                      <span className="text-gray-500 text-xs sm:text-sm ml-1">
                        ({product.reviewCount})
                      </span>
                    </div>
                    <div className="text-base sm:text-lg font-bold text-blue-600">
                      ${product.price}부터
                    </div>
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
              href="/ko/products"
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
