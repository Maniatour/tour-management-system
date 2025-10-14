'use client'

import React, { useEffect } from 'react'
import { Star, MapPin, Users, Calendar, ArrowRight, Play, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

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
  const { user, userRole, loading, getRedirectPath } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    const handleRedirect = async () => {
      const { locale } = await params
      
      // 로그인하지 않은 사용자는 홈페이지를 보여줌 (리다이렉트하지 않음)
      if (!loading && !user) {
        console.log('HomePage: No user logged in, showing home page')
        return
      }
      
      // 로그인한 사용자만 역할에 따라 리다이렉트
      if (!loading && user && userRole) {
        console.log('HomePage: User logged in, role:', userRole, 'redirecting...')
        
        const redirectPath = getRedirectPath(locale)
        console.log('HomePage: Redirecting to:', redirectPath)
        
        // 현재 페이지가 리다이렉트 대상과 다른 경우에만 리다이렉트
        if (redirectPath !== `/${locale}`) {
          router.replace(redirectPath)
        }
      }
    }
    
    handleRedirect()
  }, [user, userRole, loading, router, params, getRedirectPath])
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
    { number: '10,000+', label: '만족한 고객' },
    { number: '500+', label: '성공한 투어' },
    { number: '50+', label: '전문 가이드' },
    { number: '4.8', label: '평균 평점' }
  ]

  const features = [
    {
      icon: CheckCircle,
      title: '전문 가이드',
      description: '경험 많은 전문 가이드가 안전하고 재미있는 여행을 도와드립니다'
    },
    {
      icon: CheckCircle,
      title: '맞춤형 서비스',
      description: '고객의 요구사항에 맞춘 개인화된 투어 경험을 제공합니다'
    },
    {
      icon: CheckCircle,
      title: '안전 보장',
      description: '모든 투어에 보험이 포함되어 안전하게 여행할 수 있습니다'
    },
    {
      icon: CheckCircle,
      title: '24/7 지원',
      description: '언제든지 문의할 수 있는 고객 지원 서비스를 제공합니다'
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
              잊을 수 없는
              <br />
              특별한 여행 경험
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl mb-6 sm:mb-8 text-blue-100">
              전문 가이드와 함께하는 프리미엄 투어로
              <br />
              평생 기억에 남을 추억을 만들어보세요
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/ko/products"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center"
              >
                투어 둘러보기
                <ArrowRight className="ml-2" size={20} />
              </Link>
              <button className="bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center">
                <Play className="mr-2" size={20} />
                소개 영상 보기
              </button>
            </div>
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
              인기 투어 상품
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              고객들이 가장 많이 선택하는 베스트 투어를 만나보세요
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
                    href={`/ko/products/${product.id}`}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center block text-sm sm:text-base"
                  >
                    자세히 보기
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
              모든 투어 보기
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
              왜 투어투어를 선택해야 할까요?
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              우리만의 특별한 서비스로 최고의 여행 경험을 제공합니다
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
            지금 바로 특별한 여행을 시작하세요
          </h2>
          <p className="text-lg sm:text-xl text-blue-100 mb-6 sm:mb-8">
            궁금한 점이 있으시다면 언제든 문의해주세요
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              href="/ko/products"
              className="bg-white text-blue-900 hover:bg-gray-100 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-colors"
            >
              투어 둘러보기
            </Link>
            <button className="border-2 border-white text-white hover:bg-white hover:text-blue-900 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-colors">
              문의하기
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
