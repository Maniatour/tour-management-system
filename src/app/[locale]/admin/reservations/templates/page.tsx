'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { renderTemplateString } from '@/lib/template'
import { generateTemplateContext } from '@/lib/templateContext'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type DocTemplate = {
  id: string
  template_key: string
  language: string
  name: string
  subject: string
  content: string
  product_id?: string
  channel_id?: string
}

export default function ReservationTemplatesPage() {
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [saving, setSaving] = useState(false)
  const [editors] = useState<Record<string, unknown>>({})
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string; name_ko: string; category: string; sub_category: string }>>([])
  const availableLanguages = ['ko', 'en', 'ja', 'zh']
  const [activeKey, setActiveKey] = useState<'reservation_confirmation' | 'pickup_notification' | 'reservation_receipt'>('reservation_confirmation')
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('all')
  const [selectedProductSubCategory, setSelectedProductSubCategory] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<string>('all')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedProductChannel, setSelectedProductChannel] = useState<string>('all')
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [selectedChannelType, setSelectedChannelType] = useState<string>('all')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('ko')
  const [showVarModal, setShowVarModal] = useState<{ open: boolean; tplId?: string; relation?: string }>({ open: false })
  const [showTourScheduleModal, setShowTourScheduleModal] = useState<{ open: boolean; tplId?: string }>({ open: false })
  const [showCopyModal, setShowCopyModal] = useState<{ open: boolean; sourceTemplate?: DocTemplate }>({ open: false })
  const [showPreviewModal, setShowPreviewModal] = useState<{ open: boolean; template?: DocTemplate }>({ open: false })
  const [livePreviewContext, setLivePreviewContext] = useState<Record<string, unknown> | null>(null)
  
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesKey = t.template_key === activeKey
      
      // 상품 필터링 (다중 선택 지원)
      let matchesProduct = true
      if (selectedProducts.length > 0) {
        matchesProduct = selectedProducts.includes(t.product_id || '')
      } else if (selectedProduct !== 'all') {
        matchesProduct = t.product_id === selectedProduct
      } else if (selectedProductSubCategory !== 'all') {
        const product = products.find(p => p.id === t.product_id)
        matchesProduct = product?.sub_category === selectedProductSubCategory
        } else if (selectedProductCategory !== 'all') {
        const product = products.find(p => p.id === t.product_id)
        matchesProduct = product?.category === selectedProductCategory
      }
      
      // 채널 필터링 (다중 선택 지원)
      let matchesChannel = true
      if (selectedChannels.length > 0) {
        matchesChannel = selectedChannels.includes(t.channel_id || '')
      } else if (selectedProductChannel !== 'all') {
        matchesChannel = t.channel_id === selectedProductChannel
      } else if (selectedChannelType !== 'all') {
        const channel = channels.find(c => c.id === t.channel_id)
        matchesChannel = channel?.type?.toLowerCase() === selectedChannelType
      }
      
      return matchesKey && matchesProduct && matchesChannel
    })
  }, [templates, activeKey, selectedProduct, selectedProducts, selectedProductCategory, selectedProductSubCategory, selectedProductChannel, selectedChannels, selectedChannelType, products, channels])


  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    console.log('ReservationTemplatesPage 컴포넌트 마운트됨')
    loadData()
    loadSampleReservationData()
  }, [])

  const loadData = async () => {
    try {
      // 채널 데이터 로드
      const { data: channelsData } = await supabase
        .from('channels')
        .select('id, name, type')
      
      if (channelsData) {
        setChannels(channelsData)
      }

      // 상품 데이터 로드
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, name_ko, category, sub_category')
      
      if (productsData) {
        setProducts(productsData)
      }

      // 템플릿 데이터 로드
      const response = await fetch('/api/document-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error)
    }
  }

  const loadSampleReservationData = async () => {
    console.log('=== loadSampleReservationData 함수 시작 ===')
    try {
      console.log('샘플 예약 데이터 로딩 시작...')
      
      // 최근 예약 데이터 가져오기
      const { data: reservations, error: reservationError } = await supabase
        .from('reservations')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (reservationError) {
        console.error('예약 데이터 조회 오류:', reservationError)
        // fallback 데이터 설정
        setLivePreviewContext({
          reservation: { id: 'R-FALLBACK', tour_date: '2025-01-01', tour_time: '09:00', pickup_time: '08:30', adults: 2, child: 1, infant: 0 },
          customer: { name: '홍길동', email: 'hong@example.com', phone: '010-1234-5678', language: 'ko' },
          product: { name_ko: '그랜드캐니언 데이투어', name_en: 'Grand Canyon Day Tour', category: '투어', sub_category: '데이투어' },
          channel: { name: 'Direct', type: 'self' },
          pickup: { display: 'Bellagio - Main Lobby' },
          pricing: { total: 123000, total_locale: '123,000' },
          tour_schedule_html: {
            customer_visible_html: '<div class="p-4 bg-blue-50 rounded"><h3 class="font-bold">투어 스케줄</h3><p>09:00 - 그랜드캐니언 출발</p><p>12:00 - 점심 식사</p><p>15:00 - 투어 종료</p></div>'
          },
          product_details_multilingual: {
            slogan1: '세계 7대 자연경관',
            description: '그랜드캐니언의 장관을 감상하는 특별한 투어',
            included: '교통편, 가이드, 점심',
            not_included: '개인 경비, 팁'
          }
        })
        return
      }

      if (!reservations || reservations.length === 0) {
        console.log('예약 데이터가 없습니다. fallback 데이터 사용')
        // fallback 데이터 설정
        setLivePreviewContext({
          reservation: { id: 'R-FALLBACK', tour_date: '2025-01-01', tour_time: '09:00', pickup_time: '08:30', adults: 2, child: 1, infant: 0 },
          customer: { name: '홍길동', email: 'hong@example.com', phone: '010-1234-5678', language: 'ko' },
          product: { name_ko: '그랜드캐니언 데이투어', name_en: 'Grand Canyon Day Tour', category: '투어', sub_category: '데이투어' },
          channel: { name: 'Direct', type: 'self' },
          pickup: { display: 'Bellagio - Main Lobby' },
          pricing: { total: 123000, total_locale: '123,000' },
          tour_schedule_html: {
            customer_visible_html: '<div class="p-4 bg-blue-50 rounded"><h3 class="font-bold">투어 스케줄</h3><p>09:00 - 그랜드캐니언 출발</p><p>12:00 - 점심 식사</p><p>15:00 - 투어 종료</p></div>'
          },
          product_details_multilingual: {
            slogan1: '세계 7대 자연경관',
            description: '그랜드캐니언의 장관을 감상하는 특별한 투어',
            included: '교통편, 가이드, 점심',
            not_included: '개인 경비, 팁'
          }
        })
        return
      }

      console.log('예약 데이터 발견:', reservations[0])
      const reservationId = reservations[0].id
      
      console.log('템플릿 컨텍스트 생성 시작...')
      const context = await generateTemplateContext(reservationId, 'ko')
      
      if (!context) {
        console.error('템플릿 컨텍스트 생성 실패, fallback 데이터 사용')
        // fallback 데이터 설정
        setLivePreviewContext({
          reservation: { id: 'R-CONTEXT-ERROR', tour_date: '2025-01-01', tour_time: '09:00', pickup_time: '08:30', adults: 2, child: 1, infant: 0 },
          customer: { name: '홍길동', email: 'hong@example.com', phone: '010-1234-5678', language: 'ko' },
          product: { name_ko: '그랜드캐니언 데이투어', name_en: 'Grand Canyon Day Tour', category: '투어', sub_category: '데이투어' },
          channel: { name: 'Direct', type: 'self' },
          pickup: { display: 'Bellagio - Main Lobby' },
          pricing: { total: 123000, total_locale: '123,000' },
          tour_schedule_html: {
            customer_visible_html: '<div class="p-4 bg-yellow-50 rounded"><h3 class="font-bold text-yellow-600">컨텍스트 생성 실패</h3><p>템플릿 컨텍스트를 생성할 수 없습니다.</p></div>'
          },
          product_details_multilingual: {
            slogan1: '컨텍스트 생성 실패',
            description: '템플릿 컨텍스트를 생성할 수 없습니다.',
            included: '오류 발생',
            not_included: '오류 발생'
          }
        })
        return
      }
      
      console.log('템플릿 컨텍스트 생성 완료:', context)
      setLivePreviewContext(context)
      console.log('라이브 미리보기 컨텍스트 설정 완료')
    } catch (error) {
      console.error('샘플 데이터 로드 오류:', error)
      // 오류 발생 시에도 fallback 데이터 설정
      setLivePreviewContext({
        reservation: { id: 'R-ERROR', tour_date: '2025-01-01', tour_time: '09:00', pickup_time: '08:30', adults: 2, child: 1, infant: 0 },
        customer: { name: '홍길동', email: 'hong@example.com', phone: '010-1234-5678', language: 'ko' },
        product: { name_ko: '그랜드캐니언 데이투어', name_en: 'Grand Canyon Day Tour', category: '투어', sub_category: '데이투어' },
        channel: { name: 'Direct', type: 'self' },
        pickup: { display: 'Bellagio - Main Lobby' },
        pricing: { total: 123000, total_locale: '123,000' },
        tour_schedule_html: {
          customer_visible_html: '<div class="p-4 bg-red-50 rounded"><h3 class="font-bold text-red-600">데이터 로드 오류</h3><p>실제 데이터를 불러올 수 없습니다.</p></div>'
        },
        product_details_multilingual: {
          slogan1: '데이터 로드 오류',
          description: '실제 데이터를 불러올 수 없습니다.',
          included: '오류 발생',
          not_included: '오류 발생'
        }
      })
    }
    console.log('=== loadSampleReservationData 함수 완료 ===')
  }

  const updateField = (id: string, field: string, value: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const save = async () => {
    setSaving(true)
    try {
      console.log('템플릿 저장 시작, 총 템플릿 수:', templates.length)
      
      for (const template of templates) {
        console.log('저장 중인 템플릿:', {
          template_key: template.template_key,
          language: template.language,
          name: template.name,
          subject: template.subject,
          content_length: template.content?.length || 0
        })
        
        const response = await fetch('/api/document-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_key: template.template_key,
            language: template.language,
            name: template.name,
            subject: template.subject,
            content: template.content
          })
        })
        
        console.log('API 응답 상태:', response.status, response.statusText)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('템플릿 저장 오류 - 상태:', response.status)
          console.error('템플릿 저장 오류 - 응답:', errorText)
          
          try {
            const errorJson = JSON.parse(errorText)
            console.error('템플릿 저장 오류 - JSON:', errorJson)
          } catch {
            console.error('템플릿 저장 오류 - 텍스트:', errorText)
          }
          
          throw new Error(`템플릿 저장 실패: ${response.status} ${response.statusText}`)
        } else {
          const result = await response.json()
          console.log('템플릿 저장 성공:', result)
        }
      }
      
      console.log('모든 템플릿 저장 완료')
      // 저장 후 데이터 다시 로드
      await loadData()
    } catch (error) {
      console.error('저장 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      alert(`템플릿 저장 중 오류가 발생했습니다: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const insertVarToEditor = (tplId: string, variable: string) => {
    const editor = editors[tplId] as { insertContent?: (content: string) => void; execCommand?: (command: string, ui: boolean, value: string) => void }
    if (editor?.insertContent) {
      editor.insertContent(variable)
    } else if (editor?.execCommand) {
      editor.execCommand('mceInsertContent', false, variable)
    } else {
      // 폴백: 텍스트에어리어에 직접 삽입
      const textarea = document.querySelector(`textarea[data-template-id="${tplId}"]`) as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = textarea.value
        const before = text.substring(0, start)
        const after = text.substring(end)
        textarea.value = before + variable + after
        textarea.focus()
        textarea.setSelectionRange(start + variable.length, start + variable.length)
        
        // React 상태 업데이트
        updateField(tplId, 'content', textarea.value)
      }
    }
  }

  const insertTourScheduleWithOption = (tplId: string, option: string) => {
    const scheduleHtml = {
      full: '{{tour_schedule_html.customer_visible_html}}',
      day1: '{{tour_schedule_html.customer_day_1_html}}',
      day2: '{{tour_schedule_html.customer_day_2_html}}',
      day3: '{{tour_schedule_html.customer_day_3_html}}',
      tours_only: '{{tour_schedule_html.customer_tour_items_html}}',
      transport_only: '{{tour_schedule_html.customer_transport_items_html}}',
      meals_only: '{{tour_schedule_html.customer_meal_items_html}}'
    }

    const htmlToInsert = scheduleHtml[option as keyof typeof scheduleHtml] || scheduleHtml.full
    insertVarToEditor(tplId, htmlToInsert)
  }

  return (
    <div className="h-screen flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <h1 className="text-2xl font-bold">예약 문서 템플릿</h1>
        <div className="flex items-center space-x-3">
          <button onClick={save} disabled={saving} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{saving ? '저장 중...' : '저장'}</button>
        </div>
      </div>

      {/* 3열 그리드 레이아웃 */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-hidden">
        {/* 1열: 상품-채널 트리 */}
        <div className="bg-white rounded-lg border overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold">🌳 상품-채널 트리</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
      {/* Tabs */}
            <div className="flex items-center gap-2 border-b mb-4">
        {[
          { key: 'reservation_confirmation', label: 'Reservation Confirmation' },
          { key: 'pickup_notification', label: 'Pick up Notification' },
          { key: 'reservation_receipt', label: 'Reservation Receipt' }
        ].map(tab => (
          <button
            key={tab.key}
                  onClick={() => setActiveKey(tab.key as 'reservation_confirmation' | 'pickup_notification' | 'reservation_receipt')}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${activeKey === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
            {/* 상품-채널 통합 필터 */}
            <div className="space-y-2 p-2 bg-gray-50 rounded">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">📊 상품-채널 필터</h3>
            <button
              onClick={() => {
                    setSelectedProductCategory('all')
                    setSelectedProductSubCategory('all')
                    setSelectedProduct('all')
                    setSelectedProducts([])
                    setSelectedProductChannel('all')
                    setSelectedChannels([])
                setSelectedChannelType('all')
                    setSelectedLanguage('ko')
                  }}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  전체 초기화
            </button>
          </div>
          
              {/* 상품 트리 필터 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">🏷️ 상품</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const allProductIds = products.map(p => p.id)
                        setSelectedProducts(allProductIds)
                        setSelectedChannels([])
                      }}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      전체 선택
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProducts([])
                        setSelectedChannels([])
                      }}
                      className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      전체 해제
                    </button>
                  </div>
                </div>
                
                {/* 상품 카테고리 트리 */}
                <div className="ml-2 space-y-1">
            {(() => {
                    const categoryMap = new Map<string, { count: number; subCategories: Map<string, { count: number; products: Array<{ id: string; name: string; name_ko: string; category: string; sub_category: string }> }> }>()
                    
                    products.forEach(product => {
                      if (product.category) {
                        if (!categoryMap.has(product.category)) {
                          categoryMap.set(product.category, { count: 0, subCategories: new Map() })
                        }
                        const category = categoryMap.get(product.category)!
                        category.count++
                        
                        if (product.sub_category) {
                          if (!category.subCategories.has(product.sub_category)) {
                            category.subCategories.set(product.sub_category, { count: 0, products: [] })
                          }
                          const subCategory = category.subCategories.get(product.sub_category)!
                          subCategory.count++
                          subCategory.products.push(product)
                        }
                      }
                    })
                    
                    return Array.from(categoryMap.entries()).map(([category, { count, subCategories }]) => {
                      const isCategorySelected = selectedProductCategory === category
                      const templateCount = filteredTemplates.filter(t => {
                        return products.find(p => p.id === t.product_id)?.category === category
                }).length
                
                return (
                        <div key={category} className="border rounded p-2 bg-white">
                  <button
                    onClick={() => {
                              if (isCategorySelected) {
                                setSelectedProductCategory('all')
                                setSelectedProductSubCategory('all')
                                setSelectedProduct('all')
                                setSelectedProductChannel('all')
                              } else {
                                setSelectedProductCategory(category)
                                setSelectedProductSubCategory('all')
                                setSelectedProduct('all')
                                setSelectedProductChannel('all')
                              }
                            }}
                            className={`w-full text-left p-1 rounded flex items-center justify-between ${
                              isCategorySelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium">{category}</span>
                              <span className="text-xs text-gray-500">({count})</span>
          </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                                {templateCount}
                              </span>
                              <div className="flex gap-1">
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const categoryProductIds = Array.from(subCategories.values()).flatMap(sc => sc.products.map(p => p.id))
                                    setSelectedProducts(prev => [...new Set([...prev, ...categoryProductIds])])
                                    setSelectedChannels([])
                                  }}
                                  className="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 cursor-pointer"
                                >
                                  전체
                                </div>
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const categoryProductIds = Array.from(subCategories.values()).flatMap(sc => sc.products.map(p => p.id))
                                    setSelectedProducts(prev => prev.filter(id => !categoryProductIds.includes(id)))
                                    setSelectedChannels([])
                                  }}
                                  className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 cursor-pointer"
                                >
                                  해제
                                </div>
                              </div>
                              <span className={`text-xs ${isCategorySelected ? 'text-blue-600' : 'text-gray-400'}`}>
                                {isCategorySelected ? '▼' : '▶'}
                              </span>
                            </div>
                </button>
                          
                          {/* 서브카테고리 트리 */}
                          {isCategorySelected && (
                            <div className="mt-1 ml-2 space-y-1">
                              {Array.from(subCategories.entries()).map(([subCategory, { count, products }]) => {
                                const isSubCategorySelected = selectedProductSubCategory === subCategory
                                const subTemplateCount = filteredTemplates.filter(t => {
                                  return products.find(p => p.id === t.product_id)?.sub_category === subCategory
                    }).length
                    
                    return (
                                  <div key={subCategory} className="border rounded p-1 bg-gray-50">
            <button
              onClick={() => {
                                        if (isSubCategorySelected) {
                setSelectedProductSubCategory('all')
                setSelectedProduct('all')
                                          setSelectedProductChannel('all')
                                        } else {
                                          setSelectedProductSubCategory(subCategory)
                                          setSelectedProduct('all')
                                          setSelectedProductChannel('all')
                                        }
                                      }}
                                      className={`w-full text-left p-1 rounded flex items-center justify-between ${
                                        isSubCategorySelected ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-100'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs">{subCategory}</span>
                                        <span className="text-xs text-gray-500">({count})</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                                          {subTemplateCount}
                                        </span>
                                        <div className="flex gap-1">
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const subCategoryProductIds = products.map(p => p.id)
                                              setSelectedProducts(prev => [...new Set([...prev, ...subCategoryProductIds])])
                                              setSelectedChannels([])
                                            }}
                                            className="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 cursor-pointer"
                                          >
                                            전체
          </div>
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const subCategoryProductIds = products.map(p => p.id)
                                              setSelectedProducts(prev => prev.filter(id => !subCategoryProductIds.includes(id)))
                                              setSelectedChannels([])
                                            }}
                                            className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 cursor-pointer"
                                          >
                                            해제
                                          </div>
                                        </div>
                                        <span className={`text-xs ${isSubCategorySelected ? 'text-purple-600' : 'text-gray-400'}`}>
                                          {isSubCategorySelected ? '▼' : '▶'}
                                        </span>
                                      </div>
                                    </button>
                                    
                                    {/* 개별 상품 트리 */}
                                    {isSubCategorySelected && (
                                      <div className="mt-1 ml-2 space-y-1">
                                        {products.map(product => {
                                          const isProductSelected = selectedProducts.includes(product.id)
                                          const productTemplateCount = filteredTemplates.filter(t => {
                                            return t.product_id === product.id
                }).length
                
                return (
                                            <div key={product.id} className="border rounded p-1 bg-white">
                  <button
                    onClick={() => {
                                                  if (isProductSelected) {
                                                    setSelectedProducts(prev => prev.filter(id => id !== product.id))
                                                    setSelectedChannels([])
                                                  } else {
                                                    setSelectedProducts(prev => [...prev, product.id])
                                                    setSelectedChannels([])
                                                  }
                                                }}
                                                className={`w-full text-left p-1 rounded flex items-center justify-between ${
                                                  isProductSelected ? 'bg-green-50 text-green-700' : 'hover:bg-gray-100'
                                                }`}
                                              >
                                                <div className="flex items-center gap-1">
                                                  <span className="text-xs">{product.name_ko || product.name}</span>
                                                </div>
                                                <span className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                                                  {productTemplateCount}
                                                </span>
                  </button>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                )
              })
            })()}
                </div>
          </div>
          
              {/* 채널 트리 필터 (상품 선택 시에만 표시) */}
              {(selectedProducts.length > 0 || selectedProduct !== 'all') && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-gray-700">📺 채널</span>
                      <span className="text-xs text-gray-500">(선택된 상품의 채널)</span>
                    </div>
                    <div className="flex gap-1">
                <button
                  onClick={() => {
                          const allChannelIds = channels.map(c => c.id)
                          setSelectedChannels(allChannelIds)
                        }}
                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        전체 선택
                </button>
                      <button
                        onClick={() => {
                          setSelectedChannels([])
                        }}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        전체 해제
                      </button>
                    </div>
                  </div>
                  
                  <div className="ml-2 space-y-1">
                    {(() => {
                      // 채널 타입별로 그룹화
                      const channelTypeMap = new Map<string, Array<{ id: string; name: string; type: string }>>()
                      channels.forEach(channel => {
                        if (channel.type) {
                          const normalizedType = channel.type.toLowerCase()
                          if (!channelTypeMap.has(normalizedType)) {
                            channelTypeMap.set(normalizedType, [])
                          }
                          channelTypeMap.get(normalizedType)!.push(channel)
                        }
                      })
                      
                      return Array.from(channelTypeMap.entries()).map(([channelType, channelsOfType]) => {
                        const channelTypeTemplateCount = filteredTemplates.filter(t => {
                          const productMatches = selectedProducts.length > 0 
                            ? selectedProducts.includes(t.product_id || '')
                            : t.product_id === selectedProduct
                          return productMatches && 
                                 channelsOfType.some(c => c.id === t.channel_id)
                    }).length
                        
                        const isChannelTypeSelected = selectedChannelType === channelType
                    
                    return (
                          <div key={channelType} className="border rounded p-1 bg-white">
                      <button
                        onClick={() => {
                                if (isChannelTypeSelected) {
                                  setSelectedChannelType('all')
                                  setSelectedProductChannel('all')
                                } else {
                                  setSelectedChannelType(channelType)
                                  setSelectedProductChannel('all')
                                }
                              }}
                              className={`w-full text-left p-1 rounded flex items-center justify-between ${
                                isChannelTypeSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-medium">{channelType}</span>
                                <span className="text-xs text-gray-500">({channelsOfType.length})</span>
              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                                  {channelTypeTemplateCount}
                                </span>
                                <div className="flex gap-1">
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const channelTypeIds = channelsOfType.map(c => c.id)
                                      setSelectedChannels(prev => [...new Set([...prev, ...channelTypeIds])])
                                    }}
                                    className="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 cursor-pointer"
                                  >
                                    전체
                                  </div>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const channelTypeIds = channelsOfType.map(c => c.id)
                                      setSelectedChannels(prev => prev.filter(id => !channelTypeIds.includes(id)))
                                    }}
                                    className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 cursor-pointer"
                                  >
                                    해제
                                  </div>
                                </div>
                                <span className={`text-xs ${isChannelTypeSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                                  {isChannelTypeSelected ? '▼' : '▶'}
                                </span>
                              </div>
                </button>
                            
                            {/* 개별 채널 트리 */}
                            {isChannelTypeSelected && (
                              <div className="mt-1 ml-2 space-y-1">
                                {channelsOfType.map(channel => {
                                  const isChannelSelected = selectedChannels.includes(channel.id)
                                  const channelTemplateCount = filteredTemplates.filter(t => {
                                    const productMatches = selectedProducts.length > 0 
                                      ? selectedProducts.includes(t.product_id || '')
                                      : t.product_id === selectedProduct
                                    return productMatches && t.channel_id === channel.id
                    }).length
                    
                    return (
                      <button
                                      key={channel.id}
                                      onClick={() => {
                                        if (isChannelSelected) {
                                          setSelectedChannels(prev => prev.filter(id => id !== channel.id))
                                        } else {
                                          setSelectedChannels(prev => [...prev, channel.id])
                                        }
                                      }}
                                      className={`w-full text-left p-1 rounded flex items-center justify-between ${
                                        isChannelSelected ? 'bg-green-50 text-green-700' : 'hover:bg-gray-100'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs">{channel.name}</span>
                                      </div>
                                      <span className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                                        {channelTemplateCount}
                                      </span>
                      </button>
                    )
                  })}
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
        
        {/* 2열: 입력 섹션 */}
        <div className="bg-white rounded-lg border overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold">📝 템플릿 입력</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {/* 새 템플릿 생성 섹션 */}
            {(selectedProducts.length > 0 || selectedProduct !== 'all') ? (
              <div className="space-y-2 p-2 bg-blue-50 rounded border border-blue-200 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-blue-800">➕ 새 템플릿 생성</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-600">
                      상품: {selectedProducts.length > 0 
                        ? selectedProducts.map(id => products.find(p => p.id === id)?.name_ko || id).join(', ')
                        : products.find(p => p.id === selectedProduct)?.name_ko || selectedProduct}
                    </span>
                    {selectedChannelType !== 'all' && (
                      <span className="text-xs text-blue-600">
                        채널 타입: {selectedChannelType}
                      </span>
                    )}
                    {selectedChannels.length > 0 && (
                      <span className="text-xs text-blue-600">
                        채널: {selectedChannels.map(id => channels.find(c => c.id === id)?.name || id).join(', ')}
                      </span>
                    )}
                    {selectedProductChannel !== 'all' && selectedChannels.length === 0 && (
                      <span className="text-xs text-blue-600">
                        채널: {channels.find(c => c.id === selectedProductChannel)?.name || selectedProductChannel}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs border rounded px-2 py-1"
                      value={activeKey}
                      onChange={(e) => setActiveKey(e.target.value as 'reservation_confirmation' | 'pickup_notification' | 'reservation_receipt')}
                    >
                      <option value="reservation_confirmation">Reservation Confirmation</option>
                      <option value="pickup_notification">Pick up Notification</option>
                      <option value="reservation_receipt">Reservation Receipt</option>
                    </select>
                    <select
                      className="text-xs border rounded px-2 py-1"
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                    >
                      <option value="ko">KO</option>
                      <option value="en">EN</option>
                      <option value="ja">JA</option>
                      <option value="zh">ZH</option>
                    </select>
        <button
          onClick={() => {
                        const productId = selectedProducts.length > 0 ? selectedProducts[0] : selectedProduct
                        const channelId = selectedChannels.length > 0 ? selectedChannels[0] : (selectedProductChannel !== 'all' ? selectedProductChannel : undefined)
                        
            const newTemplate: DocTemplate = {
                          id: `new-${Date.now()}`,
              template_key: activeKey,
                          language: selectedLanguage,
                          name: `${activeKey}_${productId}_${channelId || selectedChannelType}_${selectedLanguage}`,
                          subject: '',
                          content: '',
              product_id: productId,
                          channel_id: channelId
            }
            setTemplates(prev => [...prev, newTemplate])
          }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          새 템플릿 추가
        </button>
      </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-4 bg-yellow-50 rounded border border-yellow-200 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600">⚠️</span>
                  <h3 className="text-sm font-semibold text-yellow-800">상품을 선택해주세요</h3>
                </div>
                <p className="text-xs text-yellow-700">
                  템플릿을 생성하려면 왼쪽에서 상품을 선택해주세요.
                </p>
              </div>
            )}

            {/* 템플릿 편집 섹션 */}
            <div className="space-y-2">
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map(t => (
                  <div key={t.id} className="border rounded p-2 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={t.name}
                          onChange={e => updateField(t.id, 'name', e.target.value)}
                          className="text-xs font-medium border rounded px-1 py-0.5"
                          placeholder="템플릿 이름"
                        />
                        <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                          {t.language.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                  {t.channel_id && (
                          <span className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                            {channels.find(c => c.id === t.channel_id)?.name || t.channel_id}
                    </span>
                  )}
                  {t.product_id && (
                          <span className="px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                            {products.find(p => p.id === t.product_id)?.name_ko || t.product_id}
                    </span>
                  )}
                  <select
                          className="text-xs border rounded px-1 py-0.5"
                    value={t.language}
                    onChange={(e) => updateField(t.id, 'language', e.target.value)}
                  >
                    {availableLanguages.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                          className="text-xs px-1 py-0.5 border rounded hover:bg-gray-50"
                    onClick={() => {
                      const lang = prompt('추가할 언어 코드(예: en, ja, zh, ko)를 입력하세요', 'en') || ''
                      if (!lang) return
                      if (!availableLanguages.includes(lang)) {
                        alert('지원하지 않는 언어 코드입니다.')
                        return
                      }
                      const exists = templates.find(x => x.template_key === t.template_key && x.language === lang)
                      if (exists) {
                        alert('해당 언어 템플릿이 이미 존재합니다.')
                        return
                      }
                            const newTemplate: DocTemplate = {
                              id: `new-${Date.now()}`,
                        template_key: t.template_key,
                        language: lang,
                              name: `${t.name}_${lang}`,
                        subject: t.subject,
                              content: t.content,
                              product_id: t.product_id,
                              channel_id: t.channel_id
                            }
                            setTemplates(prev => [...prev, newTemplate])
                    }}
                  >언어 추가</button>
                  <button
                    type="button"
                          onClick={() => setShowCopyModal({ open: true, sourceTemplate: t })}
                          className="text-xs px-1 py-0.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >복사</button>
                      <button
                        type="button"
                          onClick={() => deleteTemplate(t.id)}
                          className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >삭제</button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        value={t.subject || ''}
                        onChange={e => updateField(t.id, 'subject', e.target.value)}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="제목"
                      />
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                          onClick={() => setShowVarModal({ open: true, tplId: t.id, relation: 'reservation' })}
                        >
                          변수 삽입
                      </button>
                      <button
                        type="button"
                          className="px-3 py-1 text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 font-medium shadow-sm"
                          onClick={() => setShowTourScheduleModal({ open: true, tplId: t.id })}
                          title="고객 뷰 투어 스케줄을 자동으로 삽입합니다"
                        >
                          📅 투어 스케줄 삽입
                      </button>
                  <button
                    type="button"
                          className="px-3 py-1 text-xs bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-lg hover:from-yellow-600 hover:to-orange-700 font-medium shadow-sm"
                          onClick={() => setShowVarModal({ open: true, tplId: t.id, relation: 'product_details_multilingual' })}
                          title="상품 세부정보를 삽입합니다"
                  >
                          ℹ️ 상품 세부정보
                  </button>
                        <button
                          type="button"
                          className="px-3 py-1 text-xs bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg hover:from-green-600 hover:to-teal-700 font-medium shadow-sm"
                          onClick={() => setShowPreviewModal({ open: true, template: t })}
                          title="템플릿 미리보기를 확인합니다"
                        >
                          👁️ 미리보기
                        </button>
                    </div>

                  <textarea
                    value={t.content}
                    onChange={e => updateField(t.id, 'content', e.target.value)}
                        className="w-full p-2 border rounded-md font-mono text-sm"
                        rows={10}
                        data-template-id={t.id}
                      ></textarea>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>선택한 조건에 맞는 템플릿이 없습니다.</p>
                  <p className="text-sm mt-2">상품을 선택하고 새 템플릿을 추가해보세요.</p>
                </div>
                )}
              </div>
          </div>
              </div>

        {/* 3열: 저장된 템플릿 */}
        <div className="bg-white rounded-lg border overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold">💾 저장된 템플릿</h2>
                </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 gap-4">
              {templates.map(template => (
                <div key={template.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {template.language.toUpperCase()}
                    </span>
                </div>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>키:</strong> {template.template_key}
                  </p>
                  {template.subject && (
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>제목:</strong> {template.subject}
                    </p>
                  )}
                  <div className="text-xs text-gray-500">
                    <strong>내용 미리보기:</strong>
                    <div className="mt-1 p-2 bg-gray-50 rounded text-xs max-h-20 overflow-hidden">
                      {template.content.replace(/<[^>]*>/g, '').substring(0, 100)}
                      {template.content.length > 100 && '...'}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setShowPreviewModal({ open: true, template })}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      미리보기
                    </button>
                    <button
                      onClick={() => setShowCopyModal({ open: true, sourceTemplate: template })}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      복사
                    </button>
              </div>
            </div>
          ))}
            </div>
            {templates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                저장된 템플릿이 없습니다. 템플릿을 작성하고 저장해주세요.
        </div>
      )}
          </div>
        </div>
      </div>

      {/* 변수 선택 모달 */}
      <VarPickerModal
        open={showVarModal.open}
        onClose={() => setShowVarModal({ open: false })}
        onPick={(variable) => {
          const tplId = showVarModal.tplId
          if (!tplId) return
          insertVarToEditor(tplId, variable)
        }}
        relation={showVarModal.relation}
      />

      {/* 복사 모달 */}
      <CopyTemplateModal
        isOpen={showCopyModal.open}
        onClose={() => setShowCopyModal({ open: false })}
        sourceTemplate={showCopyModal.sourceTemplate}
        onCopy={(sourceTemplate, targetLanguage) => {
          const newTemplate: DocTemplate = {
            id: `new-${Date.now()}`,
            template_key: sourceTemplate.template_key,
            language: targetLanguage,
            name: `${sourceTemplate.name}_${targetLanguage}`,
            subject: sourceTemplate.subject,
            content: sourceTemplate.content,
            product_id: sourceTemplate.product_id,
            channel_id: sourceTemplate.channel_id
          }
          setTemplates(prev => [...prev, newTemplate])
        }}
      />

      {/* 투어 스케줄 삽입 모달 */}
      <TourScheduleInsertModal
        isOpen={showTourScheduleModal.open}
        onClose={() => setShowTourScheduleModal({ open: false })}
        onInsert={(option) => {
          const tplId = showTourScheduleModal.tplId
          if (!tplId) return
          insertTourScheduleWithOption(tplId, option)
        }}
      />

      {/* 미리보기 모달 */}
      <PreviewModal
        isOpen={showPreviewModal.open}
        onClose={() => setShowPreviewModal({ open: false })}
        template={showPreviewModal.template}
        livePreviewContext={livePreviewContext}
        onRefreshData={loadSampleReservationData}
      />
    </div>
  )
}

// Variable picker modal
function VarPickerModal({ open, onClose, onPick, relation }: { open: boolean; onClose: () => void; onPick: (variable: string) => void; relation?: string }) {
  if (!open) return null

  const commonVariables = [
    { label: '예약 ID', value: '{{reservation.id}}' },
    { label: '투어 날짜', value: '{{reservation.tour_date}}' },
    { label: '투어 시간', value: '{{reservation.tour_time}}' },
    { label: '픽업 시간', value: '{{reservation.pickup_time}}' },
    { label: '성인 인원', value: '{{reservation.adults}}' },
    { label: '아동 인원', value: '{{reservation.child}}' },
    { label: '유아 인원', value: '{{reservation.infant}}' },
    { label: '선택 옵션', value: '{{reservation.selected_options}}' },
    { label: '선택 옵션 가격', value: '{{reservation.selected_option_prices}}' },
    { label: '고객 이름', value: '{{customer.name}}' },
    { label: '고객 이메일', value: '{{customer.email}}' },
    { label: '고객 전화번호', value: '{{customer.phone}}' },
    { label: '고객 언어', value: '{{customer.language}}' },
    { label: '상품 이름 (KO)', value: '{{product.name_ko}}' },
    { label: '상품 이름 (EN)', value: '{{product.name_en}}' },
    { label: '상품 표시 이름 (KO)', value: '{{product.display_name.ko}}' },
    { label: '상품 카테고리', value: '{{product.category}}' },
    { label: '상품 서브 카테고리', value: '{{product.sub_category}}' },
    { label: '상품 설명', value: '{{product.description}}' },
    { label: '상품 기간', value: '{{product.duration}}' },
    { label: '상품 기본 가격', value: '{{product.base_price}}' },
    { label: '채널 이름', value: '{{channel.name}}' },
    { label: '채널 타입', value: '{{channel.type}}' },
    { label: '총 가격', value: '{{pricing.total}}' },
    { label: '총 가격 (지역화)', value: '{{pricing.total_locale}}' },
    { label: '픽업 장소', value: '{{pickup.display}}' },
    { label: '투어 스케줄 (JSON)', value: '{{tour_schedule.all_days}}' },
    { label: '투어 스케줄 (고객 뷰 JSON)', value: '{{tour_schedule.customer_visible}}' },
    { label: '투어 스케줄 (고객 뷰 HTML)', value: '{{tour_schedule_html.customer_visible_html}}' },
    { label: '픽업 스케줄 (JSON)', value: '{{pickup_schedule.all_days}}' },
    { label: '픽업 스케줄 (HTML)', value: '{{pickup_schedule.html}}' },
  ]

  const productDetailsVariables = [
    { label: '슬로건 1', value: '{{product_details_multilingual.slogan1}}' },
    { label: '슬로건 2', value: '{{product_details_multilingual.slogan2}}' },
    { label: '슬로건 3', value: '{{product_details_multilingual.slogan3}}' },
    { label: '상품 설명', value: '{{product_details_multilingual.description}}' },
    { label: '포함 사항', value: '{{product_details_multilingual.included}}' },
    { label: '불포함 사항', value: '{{product_details_multilingual.not_included}}' },
    { label: '픽업/드롭 정보', value: '{{product_details_multilingual.pickup_drop_info}}' },
    { label: '수하물 정보', value: '{{product_details_multilingual.luggage_info}}' },
    { label: '투어 운영 정보', value: '{{product_details_multilingual.tour_operation_info}}' },
    { label: '준비 사항', value: '{{product_details_multilingual.preparation_info}}' },
    { label: '소그룹 정보', value: '{{product_details_multilingual.small_group_info}}' },
    { label: '동반자 정보', value: '{{product_details_multilingual.companion_info}}' },
    { label: '독점 예약 정보', value: '{{product_details_multilingual.exclusive_booking_info}}' },
    { label: '취소 정책', value: '{{product_details_multilingual.cancellation_policy}}' },
    { label: '채팅 공지사항', value: '{{product_details_multilingual.chat_announcement}}' },
  ]

  const variables = relation === 'product_details_multilingual' ? productDetailsVariables : commonVariables

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">변수 삽입</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
          <p className="text-gray-600 mb-6">
            템플릿에 삽입할 변수를 선택하세요.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {variables.map((variable) => (
              <button
                key={variable.value}
                onClick={() => onPick(variable.value)}
                className="p-3 rounded-lg border border-gray-200 text-left hover:bg-gray-50 transition-colors"
              >
                <h3 className="font-semibold text-gray-900">{variable.label}</h3>
                <p className="text-sm text-gray-600 font-mono">{variable.value}</p>
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}

// Tour schedule insert modal
function TourScheduleInsertModal({ 
  isOpen, 
  onClose, 
  onInsert 
}: { 
  isOpen: boolean
  onClose: () => void
  onInsert: (option: string) => void
}) {
  if (!isOpen) return null

  const options = [
    { 
      value: 'full', 
      label: '전체 투어 스케줄 (고객 뷰)', 
      description: '모든 일차의 고객용 스케줄을 포함합니다',
      icon: '📅',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
    },
    { 
      value: 'day1', 
      label: '1일차 스케줄', 
      description: '1일차 고객용 스케줄만 포함합니다',
      icon: '🗓️',
      color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
    },
    { 
      value: 'day2', 
      label: '2일차 스케줄', 
      description: '2일차 고객용 스케줄만 포함합니다',
      icon: '🗓️',
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
    },
    { 
      value: 'day3', 
      label: '3일차 스케줄', 
      description: '3일차 고객용 스케줄만 포함합니다',
      icon: '🗓️',
      color: 'bg-pink-50 border-pink-200 hover:bg-pink-100'
    },
    { 
      value: 'tours_only', 
      label: '투어 활동만', 
      description: '고객에게 표시되는 투어 활동만 포함합니다',
      icon: '🎯',
      color: 'bg-green-50 border-green-200 hover:bg-green-100'
    },
    { 
      value: 'transport_only', 
      label: '교통편만', 
      description: '고객에게 표시되는 교통편 정보만 포함합니다',
      icon: '🚌',
      color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
    },
    { 
      value: 'meals_only', 
      label: '식사만', 
      description: '고객에게 표시되는 식사 정보만 포함합니다',
      icon: '🍽️',
      color: 'bg-red-50 border-red-200 hover:bg-red-100'
    },
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">투어 스케줄 삽입</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
          <p className="text-gray-600 mb-6">
            삽입할 투어 스케줄 유형을 선택하세요. 고객에게 표시되는 스케줄만 자동으로 삽입됩니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onInsert(option.value)
                  onClose()
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all duration-200 ${option.color}`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">{option.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {option.label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">💡 팁</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 선택한 스케줄은 템플릿 끝에 자동으로 추가됩니다</li>
              <li>• 삽입된 스케줄은 아름다운 HTML 형태로 렌더링됩니다</li>
              <li>• 고객에게 표시되지 않는 내부 스케줄은 제외됩니다</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// Copy template modal
function CopyTemplateModal({ isOpen, onClose, sourceTemplate, onCopy }: {
  isOpen: boolean
  onClose: () => void
  sourceTemplate?: DocTemplate
  onCopy: (sourceTemplate: DocTemplate, targetLanguage: string) => void
}) {
  if (!isOpen || !sourceTemplate) return null

  const availableLanguages = ['ko', 'en', 'ja', 'zh']

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">템플릿 복사</h2>
          <p className="mb-4">
            &apos;{sourceTemplate.name}&apos; 템플릿을 어떤 언어로 복사하시겠습니까?
          </p>
          <div className="flex flex-wrap gap-2">
            {availableLanguages.map(lang => (
              <button
                key={lang}
                onClick={() => onCopy(sourceTemplate, lang)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Preview modal
function PreviewModal({ isOpen, onClose, template, livePreviewContext, onRefreshData }: {
  isOpen: boolean
  onClose: () => void
  template?: DocTemplate
  livePreviewContext: Record<string, unknown> | null
  onRefreshData: () => void
}) {
  if (!isOpen || !template) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">템플릿 미리보기</h2>
            <div className="flex items-center gap-2">
          <button
                onClick={() => {
                  console.log('수동 데이터 로드 버튼 클릭됨')
                  onRefreshData()
                }}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                데이터 새로고침
          </button>
          <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
          >
                ×
          </button>
            </div>
          </div>
          
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">{template.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                {template.language.toUpperCase()}
              </span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                {template.template_key}
              </span>
              {template.subject && (
                <span className="text-gray-700">제목: {template.subject}</span>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-6 bg-white">
            <h4 className="font-semibold text-gray-900 mb-4">렌더링된 내용</h4>
            {livePreviewContext ? (
              <div>
                <div className="mb-2 text-xs text-green-600 bg-green-50 p-2 rounded">
                  ✅ 데이터 로드 완료: {Object.keys(livePreviewContext).length}개 항목
                </div>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: renderTemplateString(template.content, livePreviewContext) }} />
              </div>
            ) : (
              <div className="text-gray-500 italic">
                실제 데이터를 로드 중입니다...
                <div className="mt-2 text-xs">
                  데이터 로딩에 문제가 있다면 브라우저 콘솔을 확인해주세요.
                </div>
                <div className="mt-2 text-xs text-blue-600">
                  또는 위의 &quot;데이터 새로고침&quot; 버튼을 클릭해보세요.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
