'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { renderTemplateString } from '@/lib/template'

type DocTemplate = {
  id: string
  template_key: string
  language: string
  channel_id?: string
  product_id?: string
  name: string
  subject: string | null
  content: string
}

export default function ReservationTemplatesPage() {
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showHtml, setShowHtml] = useState<Record<string, boolean>>({})
  const [tinyReady, setTinyReady] = useState(false)
  const [editors, setEditors] = useState<Record<string, any>>({})
  const [channels, setChannels] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const availableLanguages = ['ko', 'en', 'ja', 'zh']
  const [activeKey, setActiveKey] = useState<'reservation_confirmation' | 'pickup_notification' | 'reservation_receipt'>('reservation_confirmation')
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<string>('all')
  const [selectedChannelType, setSelectedChannelType] = useState<string>('all')
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('all')
  const [selectedProductSubCategory, setSelectedProductSubCategory] = useState<string>('all')
  const [showVarModal, setShowVarModal] = useState<{ open: boolean; tplId?: string; relation?: string }>({ open: false })
  const [showCopyModal, setShowCopyModal] = useState<{ open: boolean; sourceTemplate?: DocTemplate }>({ open: false })
  
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesKey = t.template_key === activeKey
      
      // 채널 필터링
      let matchesChannel = true
      if (selectedChannel !== 'all') {
        matchesChannel = t.channel_id === selectedChannel
      } else if (selectedChannelType !== 'all') {
        const channel = channels.find(c => c.id === t.channel_id)
        matchesChannel = channel?.type?.toLowerCase() === selectedChannelType
      }
      
      // 상품 필터링
      let matchesProduct = true
      if (selectedProduct !== 'all') {
        matchesProduct = t.product_id === selectedProduct
      } else if (selectedProductCategory !== 'all' || selectedProductSubCategory !== 'all') {
        const product = products.find(p => p.id === t.product_id)
        if (selectedProductCategory !== 'all' && selectedProductSubCategory !== 'all') {
          matchesProduct = product?.category?.toLowerCase() === selectedProductCategory && product?.sub_category?.toLowerCase() === selectedProductSubCategory
        } else if (selectedProductCategory !== 'all') {
          matchesProduct = product?.category?.toLowerCase() === selectedProductCategory
        } else if (selectedProductSubCategory !== 'all') {
          matchesProduct = product?.sub_category?.toLowerCase() === selectedProductSubCategory
        }
      }
      
      return matchesKey && matchesChannel && matchesProduct
    })
  }, [templates, activeKey, selectedChannel, selectedProduct, selectedChannelType, selectedProductCategory, selectedProductSubCategory, channels, products])

  const loadChannelsAndProducts = async () => {
    try {
      // 채널 데이터 로딩 (type과 category 포함)
      const { data: channelsData } = await supabase
        .from('channels')
        .select('id, name, type, category')
        .order('name', { ascending: true })
      setChannels(channelsData || [])

      // 상품 데이터 로딩 (category와 sub_category 포함)
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name_ko, name_en, category, sub_category')
        .order('name_ko', { ascending: true })
      setProducts(productsData || [])
    } catch (error) {
      console.warn('채널/상품 데이터 로딩 실패:', error)
    }
  }

  const load = async () => {
    setLoading(true)
    // 채널과 상품 데이터 먼저 로딩
    await loadChannelsAndProducts()
    
    // document_templates 테이블이 존재하지 않으므로 기본 템플릿 사용
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .in('template_key', ['reservation_confirmation', 'pickup_notification', 'reservation_receipt'])
        .order('template_key', { ascending: true })
      
      if (!error && data) {
        const rows = data as unknown as DocTemplate[]
        if (rows && rows.length > 0) {
          setTemplates(rows)
        } else {
          // 초기 템플릿이 없으면 편집 가능한 로컬 템플릿을 만들어줌 (저장 시 upsert)
          setTemplates([
            { id: crypto.randomUUID(), template_key: 'reservation_confirmation', language: 'ko', name: '예약 확인서', subject: '[예약 확인서] {{reservation.id}}', content: '<h1>예약 확인서</h1><p>{{customer.name}}님, 예약번호 {{reservation.id}}</p>' },
            { id: crypto.randomUUID(), template_key: 'pickup_notification', language: 'ko', name: '픽업 안내', subject: '[픽업 안내] {{reservation.id}}', content: '<h1>픽업 안내</h1><p>픽업 호텔: {{pickup.display}} / 시간: {{reservation.pickup_time}}</p>' },
            { id: crypto.randomUUID(), template_key: 'reservation_receipt', language: 'ko', name: '예약 영수증', subject: '[예약 영수증] {{reservation.id}}', content: '<h1>예약 영수증</h1><p>총액: {{pricing.total_locale}}원</p>' }
          ])
        }
      } else {
        // 오류가 발생한 경우 기본 템플릿 사용
        setTemplates([
          { id: crypto.randomUUID(), template_key: 'reservation_confirmation', language: 'ko', name: '예약 확인서', subject: '[예약 확인서] {{reservation.id}}', content: '<h1>예약 확인서</h1><p>{{customer.name}}님, 예약번호 {{reservation.id}}</p>' },
          { id: crypto.randomUUID(), template_key: 'pickup_notification', language: 'ko', name: '픽업 안내', subject: '[픽업 안내] {{reservation.id}}', content: '<h1>픽업 안내</h1><p>픽업 호텔: {{pickup.display}} / 시간: {{reservation.pickup_time}}</p>' },
          { id: crypto.randomUUID(), template_key: 'reservation_receipt', language: 'ko', name: '예약 영수증', subject: '[예약 영수증] {{reservation.id}}', content: '<h1>예약 영수증</h1><p>총액: {{pricing.total_locale}}원</p>' }
        ])
      }
    } catch (error) {
      console.warn('document_templates 테이블이 존재하지 않습니다. 기본 템플릿을 사용합니다.')
      // 오류 발생 시 기본 템플릿 사용
      setTemplates([
        { id: crypto.randomUUID(), template_key: 'reservation_confirmation', language: 'ko', name: '예약 확인서', subject: '[예약 확인서] {{reservation.id}}', content: '<h1>예약 확인서</h1><p>{{customer.name}}님, 예약번호 {{reservation.id}}</p>' },
        { id: crypto.randomUUID(), template_key: 'pickup_notification', language: 'ko', name: '픽업 안내', subject: '[픽업 안내] {{reservation.id}}', content: '<h1>픽업 안내</h1><p>픽업 호텔: {{pickup.display}} / 시간: {{reservation.pickup_time}}</p>' },
        { id: crypto.randomUUID(), template_key: 'reservation_receipt', language: 'ko', name: '예약 영수증', subject: '[예약 영수증] {{reservation.id}}', content: '<h1>예약 영수증</h1><p>총액: {{pricing.total_locale}}원</p>' }
      ])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateField = (id: string, field: keyof DocTemplate, value: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } as DocTemplate : t))
  }

  const copyTemplate = (sourceTemplate: DocTemplate) => {
    setShowCopyModal({ open: true, sourceTemplate })
  }

  const handleCopyTemplate = (sourceTemplate: DocTemplate, targetChannel?: string, targetProduct?: string) => {
    const newTemplate: DocTemplate = {
      id: crypto.randomUUID(),
      template_key: sourceTemplate.template_key,
      language: sourceTemplate.language,
      channel_id: targetChannel || sourceTemplate.channel_id,
      product_id: targetProduct || sourceTemplate.product_id,
      name: `${sourceTemplate.name} (복사본)`,
      subject: sourceTemplate.subject,
      content: sourceTemplate.content
    }
    setTemplates(prev => [...prev, newTemplate])
    setShowCopyModal({ open: false })
  }

  const save = async () => {
    setSaving(true)
    try {
      for (const tpl of templates) {
        // upsert by (template_key, language)
        const { error } = await supabase
          .from('document_templates')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .upsert({ id: tpl.id, template_key: tpl.template_key, language: tpl.language, name: tpl.name, subject: tpl.subject, content: tpl.content } as any, {
            onConflict: 'template_key,language',
            ignoreDuplicates: false
          })
        if (error) {
          console.warn('document_templates 테이블이 존재하지 않습니다. 로컬에서만 저장됩니다.')
          break
        }
      }
      alert('저장 완료 (로컬 저장)')
    } catch (error) {
      console.warn('document_templates 테이블이 존재하지 않습니다. 로컬에서만 저장됩니다.')
      alert('저장 완료 (로컬 저장)')
    }
    setSaving(false)
  }

  // Load TinyMCE from CDN once
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).tinymce) {
      setTinyReady(true)
      return
    }
    const script = document.createElement('script')
    // Use non-cloud build to avoid API key requirement and read-only mode
    script.src = 'https://cdn.jsdelivr.net/npm/tinymce@6.8.3/tinymce.min.js'
    script.async = true
    script.referrerPolicy = 'origin'
    script.onload = () => setTimeout(() => setTinyReady(true), 0)
    document.body.appendChild(script)
    return () => {
      // leave assets in place
    }
  }, [])

  // Initialize TinyMCE editors for visible templates (non-HTML mode)
  useEffect(() => {
    if (!tinyReady) return
    // 현재 탭의 템플릿만 초기화하여 성능/타이밍 이슈 완화
    filteredTemplates.forEach(t => {
      if (showHtml[t.id]) return
      if (editors[t.id]) return
      const el = document.getElementById(`tpl-editor-${t.id}`)
      if (!el) return
      try {
        const tinymce = (window as any).tinymce
        tinymce.init({
          target: el,
          inline: true,
          menubar: false,
          plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table help wordcount codesample pagebreak',
          toolbar: 'undo redo | styles fontsize | bold italic underline forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table link image media codesample | removeformat | preview fullscreen',
          toolbar_mode: 'sliding',
          branding: false,
          fixed_toolbar_container: `#tpl-toolbar-${t.id}`,
          setup: (editor: any) => {
            editor.on('init', () => {
              editor.setContent(t.content || '')
            })
            editor.on('Change KeyUp Undo Redo', () => {
              updateField(t.id, 'content', editor.getContent())
            })
            setEditors(prev => ({ ...prev, [t.id]: editor }))
          }
        })
      } catch (e) {
        // fallback ignored
      }
    })
  }, [tinyReady, filteredTemplates, showHtml, editors])

  const getTplById = (id?: string) => templates.find(t => t.id === id)
  const insertVarToEditor = (tplId: string, variable: string) => {
    const editor = editors[tplId]
    if (!editor) return
    if (editor.insertContent) {
      editor.insertContent(variable)
    } else if (editor.execCommand) {
      editor.execCommand('mceInsertContent', false, variable)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">예약 문서 템플릿</h1>
        <button onClick={save} disabled={saving} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{saving ? '저장 중...' : '저장'}</button>
      </div>
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b">
        {[
          { key: 'reservation_confirmation', label: 'Reservation Confirmation' },
          { key: 'pickup_notification', label: 'Pick up Notification' },
          { key: 'reservation_receipt', label: 'Reservation Receipt' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveKey(tab.key as any)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${activeKey === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* 필터 */}
      <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
        {/* 채널 필터 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">채널 필터:</label>
            <button
              onClick={() => {
                setSelectedChannelType('all')
                setSelectedChannel('all')
              }}
              className={`px-3 py-1 text-xs rounded-full border ${
                selectedChannelType === 'all' && selectedChannel === 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              전체
            </button>
          </div>
          
          {/* 채널 타입 버튼들 */}
          <div className="flex flex-wrap gap-2">
            {(() => {
              // 대소문자 구분 없이 채널 타입 그룹화
              const channelTypeMap = new Map<string, { displayName: string; count: number }>()
              
              channels.forEach(channel => {
                if (channel.type) {
                  const normalizedType = channel.type.toLowerCase()
                  const existing = channelTypeMap.get(normalizedType)
                  if (existing) {
                    existing.count++
                  } else {
                    channelTypeMap.set(normalizedType, {
                      displayName: channel.type, // 원본 표시명 유지
                      count: 1
                    })
                  }
                }
              })
              
              return Array.from(channelTypeMap.entries()).map(([normalizedType, { displayName, count }]) => {
                // 해당 채널 타입에 대한 템플릿 개수 계산
                const templateCount = filteredTemplates.filter(t => {
                  // 현재 선택된 상품 필터 조건 확인
                  let matchesProduct = true
                  if (selectedProduct !== 'all') {
                    matchesProduct = t.product_id === selectedProduct
                  } else if (selectedProductCategory !== 'all' || selectedProductSubCategory !== 'all') {
                    const product = products.find(p => p.id === t.product_id)
                    if (selectedProductCategory !== 'all' && selectedProductSubCategory !== 'all') {
                      matchesProduct = product?.category?.toLowerCase() === selectedProductCategory && product?.sub_category?.toLowerCase() === selectedProductSubCategory
                    } else if (selectedProductCategory !== 'all') {
                      matchesProduct = product?.category?.toLowerCase() === selectedProductCategory
                    } else if (selectedProductSubCategory !== 'all') {
                      matchesProduct = product?.sub_category?.toLowerCase() === selectedProductSubCategory
                    }
                  }
                  
                  // 해당 채널 타입과 매칭되는지 확인
                  const channel = channels.find(c => c.id === t.channel_id)
                  const matchesChannelType = channel?.type?.toLowerCase() === normalizedType
                  
                  return matchesProduct && matchesChannelType
                }).length
                
                return (
                  <button
                    key={normalizedType}
                    onClick={() => {
                      setSelectedChannelType(normalizedType)
                      setSelectedChannel('all')
                    }}
                    className={`px-3 py-1 text-xs rounded-full border ${
                      selectedChannelType === normalizedType && selectedChannel === 'all'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {displayName} ({count}) {templateCount > 0 && `[${templateCount}]`}
                  </button>
                )
              })
            })()}
          </div>
          
          {/* 특정 채널 선택 */}
          {selectedChannelType !== 'all' && (
            <div className="ml-4 space-y-2">
              <div className="text-xs text-gray-600">특정 채널 선택:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedChannel('all')}
                  className={`px-2 py-1 text-xs rounded border ${
                    selectedChannel === 'all'
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  전체
                </button>
                {channels
                  .filter(c => c.type?.toLowerCase() === selectedChannelType)
                  .map(channel => {
                    // 해당 채널에 대한 템플릿 개수 계산
                    const templateCount = filteredTemplates.filter(t => {
                      // 현재 선택된 상품 필터 조건 확인
                      let matchesProduct = true
                      if (selectedProduct !== 'all') {
                        matchesProduct = t.product_id === selectedProduct
                      } else if (selectedProductCategory !== 'all' || selectedProductSubCategory !== 'all') {
                        const product = products.find(p => p.id === t.product_id)
                        if (selectedProductCategory !== 'all' && selectedProductSubCategory !== 'all') {
                          matchesProduct = product?.category?.toLowerCase() === selectedProductCategory && product?.sub_category?.toLowerCase() === selectedProductSubCategory
                        } else if (selectedProductCategory !== 'all') {
                          matchesProduct = product?.category?.toLowerCase() === selectedProductCategory
                        } else if (selectedProductSubCategory !== 'all') {
                          matchesProduct = product?.sub_category?.toLowerCase() === selectedProductSubCategory
                        }
                      }
                      
                      // 해당 채널과 매칭되는지 확인
                      const matchesChannel = t.channel_id === channel.id
                      
                      return matchesProduct && matchesChannel
                    }).length
                    
                    return (
                      <button
                        key={channel.id}
                        onClick={() => setSelectedChannel(channel.id)}
                        className={`px-2 py-1 text-xs rounded border ${
                          selectedChannel === channel.id
                            ? 'bg-gray-600 text-white border-gray-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {channel.name} {channel.category ? `(${channel.category})` : ''} {templateCount > 0 && `[${templateCount}]`}
                      </button>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* 상품 필터 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">상품 필터:</label>
            <button
              onClick={() => {
                setSelectedProductCategory('all')
                setSelectedProductSubCategory('all')
                setSelectedProduct('all')
              }}
              className={`px-3 py-1 text-xs rounded-full border ${
                selectedProductCategory === 'all' && selectedProductSubCategory === 'all' && selectedProduct === 'all'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              전체
            </button>
          </div>
          
          {/* 상품 카테고리 버튼들 */}
          <div className="flex flex-wrap gap-2">
            {(() => {
              // 대소문자 구분 없이 상품 카테고리 그룹화
              const categoryMap = new Map<string, { displayName: string; count: number }>()
              
              products.forEach(product => {
                if (product.category) {
                  const normalizedCategory = product.category.toLowerCase()
                  const existing = categoryMap.get(normalizedCategory)
                  if (existing) {
                    existing.count++
                  } else {
                    categoryMap.set(normalizedCategory, {
                      displayName: product.category, // 원본 표시명 유지
                      count: 1
                    })
                  }
                }
              })
              
              return Array.from(categoryMap.entries()).map(([normalizedCategory, { displayName, count }]) => {
                // 해당 카테고리에 대한 템플릿 개수 계산
                const templateCount = filteredTemplates.filter(t => {
                  // 현재 선택된 채널 필터 조건 확인
                  let matchesChannel = true
                  if (selectedChannel !== 'all') {
                    matchesChannel = t.channel_id === selectedChannel
                  } else if (selectedChannelType !== 'all') {
                    const channel = channels.find(c => c.id === t.channel_id)
                    matchesChannel = channel?.type?.toLowerCase() === selectedChannelType
                  }
                  
                  // 해당 카테고리와 매칭되는지 확인
                  const product = products.find(p => p.id === t.product_id)
                  const matchesCategory = product?.category?.toLowerCase() === normalizedCategory
                  
                  return matchesChannel && matchesCategory
                }).length
                
                return (
                  <button
                    key={normalizedCategory}
                    onClick={() => {
                      setSelectedProductCategory(normalizedCategory)
                      setSelectedProductSubCategory('all')
                      setSelectedProduct('all')
                    }}
                    className={`px-3 py-1 text-xs rounded-full border ${
                      selectedProductCategory === normalizedCategory && selectedProductSubCategory === 'all' && selectedProduct === 'all'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {displayName} ({count}) {templateCount > 0 && `[${templateCount}]`}
                  </button>
                )
              })
            })()}
          </div>
          
          {/* 서브카테고리 선택 */}
          {selectedProductCategory !== 'all' && (
            <div className="ml-4 space-y-2">
              <div className="text-xs text-gray-600">서브카테고리 선택:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setSelectedProductSubCategory('all')
                    setSelectedProduct('all')
                  }}
                  className={`px-2 py-1 text-xs rounded border ${
                    selectedProductSubCategory === 'all' && selectedProduct === 'all'
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  전체
                </button>
                {(() => {
                  // 대소문자 구분 없이 서브카테고리 그룹화
                  const subCategoryMap = new Map<string, { displayName: string; count: number }>()
                  
                  products
                    .filter(p => p.category?.toLowerCase() === selectedProductCategory)
                    .forEach(product => {
                      if (product.sub_category) {
                        const normalizedSubCategory = product.sub_category.toLowerCase()
                        const existing = subCategoryMap.get(normalizedSubCategory)
                        if (existing) {
                          existing.count++
                        } else {
                          subCategoryMap.set(normalizedSubCategory, {
                            displayName: product.sub_category, // 원본 표시명 유지
                            count: 1
                          })
                        }
                      }
                    })
                  
                  return Array.from(subCategoryMap.entries()).map(([normalizedSubCategory, { displayName, count }]) => {
                    // 해당 서브카테고리에 대한 템플릿 개수 계산
                    const templateCount = filteredTemplates.filter(t => {
                      // 현재 선택된 채널 필터 조건 확인
                      let matchesChannel = true
                      if (selectedChannel !== 'all') {
                        matchesChannel = t.channel_id === selectedChannel
                      } else if (selectedChannelType !== 'all') {
                        const channel = channels.find(c => c.id === t.channel_id)
                        matchesChannel = channel?.type?.toLowerCase() === selectedChannelType
                      }
                      
                      // 해당 서브카테고리와 매칭되는지 확인
                      const product = products.find(p => p.id === t.product_id)
                      const matchesSubCategory = product?.sub_category?.toLowerCase() === normalizedSubCategory
                      
                      return matchesChannel && matchesSubCategory
                    }).length
                    
                    return (
                      <button
                        key={normalizedSubCategory}
                        onClick={() => {
                          setSelectedProductSubCategory(normalizedSubCategory)
                          setSelectedProduct('all')
                        }}
                        className={`px-2 py-1 text-xs rounded border ${
                          selectedProductSubCategory === normalizedSubCategory && selectedProduct === 'all'
                            ? 'bg-gray-600 text-white border-gray-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {displayName} ({count}) {templateCount > 0 && `[${templateCount}]`}
                      </button>
                    )
                  })
                })()}
              </div>
            </div>
          )}
          
          {/* 특정 상품 선택 */}
          {selectedProductCategory !== 'all' && selectedProductSubCategory !== 'all' && (
            <div className="ml-8 space-y-2">
              <div className="text-xs text-gray-600">특정 상품 선택:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedProduct('all')}
                  className={`px-2 py-1 text-xs rounded border ${
                    selectedProduct === 'all'
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  전체
                </button>
                {products
                  .filter(p => p.category?.toLowerCase() === selectedProductCategory && p.sub_category?.toLowerCase() === selectedProductSubCategory)
                  .map(product => {
                    // 해당 상품에 대한 템플릿 개수 계산
                    const templateCount = filteredTemplates.filter(t => {
                      // 현재 선택된 채널 필터 조건 확인
                      let matchesChannel = true
                      if (selectedChannel !== 'all') {
                        matchesChannel = t.channel_id === selectedChannel
                      } else if (selectedChannelType !== 'all') {
                        const channel = channels.find(c => c.id === t.channel_id)
                        matchesChannel = channel?.type?.toLowerCase() === selectedChannelType
                      }
                      
                      // 해당 상품과 매칭되는지 확인
                      const matchesProduct = t.product_id === product.id
                      
                      return matchesChannel && matchesProduct
                    }).length
                    
                    return (
                      <button
                        key={product.id}
                        onClick={() => setSelectedProduct(product.id)}
                        className={`px-2 py-1 text-xs rounded border ${
                          selectedProduct === product.id
                            ? 'bg-gray-600 text-white border-gray-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {product.name_ko} {templateCount > 0 && `(${templateCount})`}
                      </button>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
        
        <button
          onClick={() => {
            const channelId = selectedChannel === 'all' ? undefined : selectedChannel
            const productId = selectedProduct === 'all' ? undefined : selectedProduct
            const newTemplate: DocTemplate = {
              id: crypto.randomUUID(),
              template_key: activeKey,
              language: 'ko',
              channel_id: channelId,
              product_id: productId,
              name: `${activeKey} 템플릿`,
              subject: `[${activeKey}] {{reservation.id}}`,
              content: `<h1>${activeKey}</h1><p>기본 템플릿입니다.</p>`
            }
            setTemplates(prev => [...prev, newTemplate])
          }}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          새 템플릿 추가
        </button>
      </div>
      
      {loading ? (
        <div className="p-6">로딩 중...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredTemplates.map(t => (
            <div key={t.id} className="bg-white rounded border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <span>{t.template_key}</span>
                  {t.channel_id && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      채널: {channels.find(c => c.id === t.channel_id)?.name || t.channel_id}
                    </span>
                  )}
                  {t.product_id && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      상품: {products.find(p => p.id === t.product_id)?.name_ko || t.product_id}
                    </span>
                  )}
                  <select
                    className="text-xs border rounded px-2 py-1"
                    value={t.language}
                    onChange={(e) => updateField(t.id, 'language', e.target.value)}
                  >
                    {availableLanguages.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
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
                      setTemplates(prev => ([...prev, {
                        id: crypto.randomUUID(),
                        template_key: t.template_key,
                        language: lang,
                        name: t.name + ` (${lang})`,
                        subject: t.subject,
                        content: t.content
                      }]))
                    }}
                  >언어 추가</button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                    onClick={() => copyTemplate(t)}
                  >복사</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                  <input value={t.name} onChange={e => updateField(t.id, 'name', e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input value={t.subject || ''} onChange={e => updateField(t.id, 'subject', e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">내용 (비개발자용 편집기)</label>
                  <button
                    type="button"
                    onClick={() => setShowHtml(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                    className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                  >
                    {showHtml[t.id] ? '에디터 보기' : 'HTML 보기'}
                  </button>
                </div>

                {!showHtml[t.id] && (
                  <>
                    {/* Relation quick buttons */}
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      {[
                        { key: 'reservation', label: '예약' },
                        { key: 'customer', label: '고객' },
                        { key: 'product', label: '상품' },
                        { key: 'channel', label: '채널' },
                        { key: 'pickup', label: '픽업' },
                        { key: 'pricing', label: '가격' }
                      ].map(btn => (
                        <button
                          key={btn.key}
                          type="button"
                          className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                          onClick={() => setShowVarModal({ open: true, tplId: t.id, relation: btn.key })}
                        >{btn.label}</button>
                      ))}
                    </div>

                    {/* TinyMCE external toolbar container */}
                    <div id={`tpl-toolbar-${t.id}`} className="mb-2 sticky top-16 z-20 bg-white" />
                    {/* Editor host */}
                    <div id={`tpl-editor-${t.id}`} className="w-full min-h-56 border rounded p-3" />
                  </>
                )}

                {showHtml[t.id] && (
                  <textarea
                    value={t.content}
                    onChange={e => updateField(t.id, 'content', e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border rounded font-mono text-sm"
                  />
                )}
              </div>
              <div className="text-xs text-gray-500">
                사용가능 변수: {'{{reservation.id}}'}, {'{{reservation.tour_date}}'}, {'{{reservation.tour_time}}'}, {'{{reservation.pickup_time}}'}, {'{{customer.name}}'}, {'{{customer.email}}'}, {'{{product.name}}'}, {'{{pickup.display}}'}, {'{{pricing.total}}'}, {'{{pricing.total_locale}}'}
                <div className="mt-1">고급: {'{{channel.name}}'}, {'{{channel.type}}'}, {'{{reservation.selected_options}}'}, {'{{reservation.selected_option_prices}}'}</div>
                <div className="mt-1">JSON 경로도 지원: 예) {'{{customer.address.city}}'}, {'{{product.display_name.ko}}'}</div>
              </div>

              {/* Live preview */}
              <div className="mt-4 border-t pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">미리보기</span>
                </div>
                <div className="border rounded p-3">
                  <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: renderTemplateString(t.content, {
                    reservation: { id: 'R-EXAMPLE', tour_date: '2025-01-01', tour_time: '09:00', pickup_time: '08:30', adults: 2, child: 1, infant: 0 },
                    customer: { name: '홍길동', email: 'hong@example.com' },
                    product: { name: '그랜드캐니언 데이투어', display_name: { ko: '그랜드캐니언' } },
                    channel: { name: 'Direct', type: 'self' },
                    pickup: { display: 'Bellagio - Main Lobby' },
                    pricing: { total: 123000, total_locale: '123,000' }
                  }) }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <VarPickerModal
        open={showVarModal.open}
        relation={showVarModal.relation}
        onClose={() => setShowVarModal({ open: false })}
        onPick={(variable) => {
          const tplId = showVarModal.tplId
          if (!tplId) return
          insertVarToEditor(tplId, variable)
        }}
      />
      <CopyTemplateModal
        isOpen={showCopyModal.open}
        onClose={() => setShowCopyModal({ open: false })}
        sourceTemplate={showCopyModal.sourceTemplate}
        channels={channels}
        products={products}
        onCopy={handleCopyTemplate}
      />
    </div>
  )
}

// Variable picker modal
// Simple static columns per relation; can be extended to read DB schema if needed
function VarPickerModal({ open, onClose, onPick, relation }: { open: boolean; onClose: () => void; onPick: (variable: string) => void; relation?: string }) {
  if (!open) return null
  const columnsMap: Record<string, { key: string; label: string }[]> = {
    reservation: [
      { key: 'id', label: '예약번호' },
      { key: 'tour_date', label: '투어 날짜' },
      { key: 'tour_time', label: '투어 시간' },
      { key: 'pickup_time', label: '픽업 시간' },
      { key: 'adults', label: '성인 수' },
      { key: 'child', label: '아동 수' },
      { key: 'infant', label: '유아 수' },
      { key: 'selected_options', label: '선택 옵션(JSON)' },
      { key: 'selected_option_prices', label: '선택 옵션 금액(JSON)' }
    ],
    customer: [
      { key: 'name', label: '고객명' },
      { key: 'email', label: '이메일' },
      { key: 'phone', label: '전화번호' },
      { key: 'language', label: '언어' }
    ],
    product: [
      { key: 'id', label: '상품 ID' },
      { key: 'name', label: '상품명' },
      { key: 'name_ko', label: '상품명(한)' },
      { key: 'name_en', label: '상품명(영)' },
      { key: 'display_name', label: '표시명(JSON)' },
      { key: 'category', label: '카테고리' },
      { key: 'sub_category', label: '서브카테고리' },
      { key: 'description', label: '설명' },
      { key: 'duration', label: '소요 시간' },
      { key: 'base_price', label: '기본가' },
      { key: 'max_participants', label: '최대 인원' },
      { key: 'status', label: '상태' },
      { key: 'tags', label: '태그(JSON)' },
      { key: 'created_at', label: '생성일' }
    ],
    channel: [
      { key: 'name', label: '채널명' },
      { key: 'type', label: '유형' }
    ],
    pickup: [
      { key: 'display', label: '픽업 표기' },
      { key: 'hotel', label: '호텔명' },
      { key: 'pick_up_location', label: '픽업 위치' },
      { key: 'address', label: '주소' },
      { key: 'link', label: '링크' },
      { key: 'pin', label: '핀' },
      { key: 'description_ko', label: '설명(한)' },
      { key: 'description_en', label: '설명(영)' },
      { key: 'media', label: '미디어(JSON)' }
    ],
    pricing: [
      { key: 'adult_product_price', label: '성인 상품가' },
      { key: 'child_product_price', label: '아동 상품가' },
      { key: 'infant_product_price', label: '유아 상품가' },
      { key: 'product_price_total', label: '상품가 합계' },
      { key: 'required_options', label: '필수옵션(JSON)' },
      { key: 'required_option_total', label: '필수옵션 합계' },
      { key: 'subtotal', label: '소계' },
      { key: 'coupon_code', label: '쿠폰 코드' },
      { key: 'coupon_discount', label: '쿠폰 할인' },
      { key: 'additional_discount', label: '추가 할인' },
      { key: 'additional_cost', label: '추가 비용' },
      { key: 'card_fee', label: '카드 수수료' },
      { key: 'tax', label: '세금' },
      { key: 'prepayment_cost', label: '선결제 금액' },
      { key: 'prepayment_tip', label: '선결제 팁' },
      { key: 'selected_options', label: '선택옵션(JSON)' },
      { key: 'option_total', label: '옵션 합계' },
      { key: 'total_price', label: '총액' },
      { key: 'deposit_amount', label: '보증금' },
      { key: 'balance_amount', label: '잔액' },
      { key: 'private_tour_additional_cost', label: '프라이빗 추가비' },
      { key: 'commission_percent', label: '커미션(%)' },
      { key: 'total_locale', label: '총액(로케일)' }
    ]
  }
  const cols = columnsMap[relation || 'reservation'] || []
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-semibold mb-3">변수 선택</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {cols.map(c => (
            <button
              key={c.key}
              onClick={() => { onPick(`{{${relation}.${c.key}}}`); onClose() }}
              className="px-2 py-2 border rounded text-sm hover:bg-gray-50 text-left"
            >
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-gray-500">{`{{${relation}.${c.key}}}`}</div>
            </button>
          ))}
        </div>
        <div className="text-right">
          <button onClick={onClose} className="px-3 py-2 border rounded">닫기</button>
        </div>
      </div>
    </div>
  )
}

// 복사 모달 컴포넌트
function CopyTemplateModal({ 
  isOpen, 
  onClose, 
  sourceTemplate, 
  channels, 
  products, 
  onCopy 
}: { 
  isOpen: boolean
  onClose: () => void
  sourceTemplate?: DocTemplate
  channels: any[]
  products: any[]
  onCopy: (sourceTemplate: DocTemplate, targetChannel?: string, targetProduct?: string) => void
}) {
  const [targetChannel, setTargetChannel] = useState<string>('')
  const [targetProduct, setTargetProduct] = useState<string>('')

  if (!isOpen || !sourceTemplate) return null

  const handleCopy = () => {
    onCopy(
      sourceTemplate, 
      targetChannel || undefined, 
      targetProduct || undefined
    )
    setTargetChannel('')
    setTargetProduct('')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">템플릿 복사</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">원본 템플릿</label>
            <div className="p-2 bg-gray-100 rounded text-sm">
              <div><strong>이름:</strong> {sourceTemplate.name}</div>
              <div><strong>언어:</strong> {sourceTemplate.language}</div>
              {sourceTemplate.channel_id && (
                <div><strong>채널:</strong> {channels.find(c => c.id === sourceTemplate.channel_id)?.name || sourceTemplate.channel_id}</div>
              )}
              {sourceTemplate.product_id && (
                <div><strong>상품:</strong> {products.find(p => p.id === sourceTemplate.product_id)?.name_ko || sourceTemplate.product_id}</div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">대상 채널 (선택사항)</label>
            <select
              value={targetChannel}
              onChange={(e) => setTargetChannel(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">원본과 동일</option>
              {(() => {
                // 채널을 type별로 그룹화
                const groupedChannels = channels.reduce((acc, channel) => {
                  const type = channel.type || '기타'
                  if (!acc[type]) {
                    acc[type] = []
                  }
                  acc[type].push(channel)
                  return acc
                }, {} as Record<string, typeof channels>)
                
                return Object.entries(groupedChannels).map(([type, channelList]) => (
                  <optgroup key={type} label={`${type} (${channelList.length})`}>
                    {channelList.map(channel => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name} {channel.category ? `(${channel.category})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))
              })()}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">대상 상품 (선택사항)</label>
            <select
              value={targetProduct}
              onChange={(e) => setTargetProduct(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">원본과 동일</option>
              {(() => {
                // 상품을 category-sub_category별로 그룹화
                const groupedProducts = products.reduce((acc, product) => {
                  const category = product.category || '기타'
                  const subCategory = product.sub_category || '기본'
                  
                  if (!acc[category]) {
                    acc[category] = {}
                  }
                  if (!acc[category][subCategory]) {
                    acc[category][subCategory] = []
                  }
                  acc[category][subCategory].push(product)
                  return acc
                }, {} as Record<string, Record<string, typeof products>>)
                
                return Object.entries(groupedProducts).map(([category, subCategories]) => (
                  <optgroup key={category} label={`${category} (${Object.values(subCategories).flat().length})`}>
                    {Object.entries(subCategories).map(([subCategory, productList]) => 
                      productList.map(product => (
                        <option key={product.id} value={product.id}>
                          {subCategory} - {product.name_ko}
                        </option>
                      ))
                    )}
                  </optgroup>
                ))
              })()}
            </select>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            복사
          </button>
        </div>
      </div>
    </div>
  )
}


