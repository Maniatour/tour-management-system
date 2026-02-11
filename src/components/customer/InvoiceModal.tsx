'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Send, DollarSign, Users, Package, Plus, Trash2, Calendar, Eye, FileText, Search, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import ProductSelector, { Product as ProductSelectorProduct } from '@/components/common/ProductSelector'
import { NewDynamicPricingService } from '@/lib/newDynamicPricingService'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  channel_id?: string | null
}

interface Product {
  id: string
  name_ko: string | null
  name_en: string | null
  base_price?: number | null
  adult_base_price?: number | null
  child_base_price?: number | null
  infant_base_price?: number | null
}

interface InvoiceModalProps {
  customer: Customer
  products: Product[]
  onClose: () => void
  locale?: string
  savedInvoiceId?: string | null
}

interface InvoiceItem {
  id: string
  productId: string
  productName: string
  date: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  editable: boolean
  choiceInfo?: string
  selectedProductId?: string
  participantType?: 'adult' | 'child' | 'infant' | 'none'
  choiceId?: string
  choiceOptionId?: string
  selectedChoices?: Record<string, string> // choiceId -> optionId 매핑
  selectedOptions?: string[]
  itemType?: 'product' | 'option'
  optionId?: string
}

interface ProductOption {
  id: string
  name: string
  description?: string
  choice_name?: string
  choice_description?: string
  adult_price_adjustment: number
  child_price_adjustment: number
  infant_price_adjustment: number
  is_required?: boolean
  is_multiple?: boolean
  is_default?: boolean
  product_id?: string
}

interface ProductChoice {
  id: string
  name: string
  name_ko?: string
  name_en?: string
  description?: string
  options: Array<{
    id: string
    name: string
    name_ko?: string
    name_en?: string
    description?: string
    adult_price: number
    child_price: number
    infant_price: number
    is_active: boolean
    is_default: boolean
  }>
}

const formatUSD = (usd: number): string => {
  return `$${usd.toFixed(2)}`
}

const formatKRW = (krw: number): string => {
  return `₩${Math.round(krw).toLocaleString('ko-KR')}`
}

const convertToKRW = (usd: number, rate: number): number => {
  return usd * rate
}

export default function InvoiceModal({ customer, products, onClose, locale: initialLocale = 'ko', savedInvoiceId: initialSavedInvoiceId = null }: InvoiceModalProps) {
  const t = useTranslations('customers.invoice')
  
  const [locale, setLocale] = useState<'ko' | 'en'>(initialLocale as 'ko' | 'en')
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [subtotal, setSubtotal] = useState(0)
  const [tax, setTax] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  // 라스베가스 시간대 날짜 가져오기
  const getLasVegasDate = () => {
    const now = new Date()
    const lasVegasTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
    const year = lasVegasTime.getFullYear()
    const month = String(lasVegasTime.getMonth() + 1).padStart(2, '0')
    const day = String(lasVegasTime.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Issue Date의 3일 뒤 날짜 계산
  const getDueDateFromIssueDate = (issueDate: string) => {
    if (!issueDate) return ''
    const date = new Date(issueDate)
    date.setDate(date.getDate() + 3)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const initialIssueDate = getLasVegasDate()
  const [invoiceDate, setInvoiceDate] = useState(initialIssueDate)
  const [dueDate, setDueDate] = useState(getDueDateFromIssueDate(initialIssueDate))
  const [notes, setNotes] = useState('')
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null)
  const [allProductOptions, setAllProductOptions] = useState<ProductOption[]>([])
  const [defaultChannelId, setDefaultChannelId] = useState<string>('')
  const [applyTax, setApplyTax] = useState(false)
  const [taxPercent, setTaxPercent] = useState(10)
  const [applyDiscount, setApplyDiscount] = useState(false)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [applyProcessingFee, setApplyProcessingFee] = useState(false)
  const [showKRW, setShowKRW] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(1300)
  const [productChoicesMap, setProductChoicesMap] = useState<Record<string, ProductChoice[]>>({})
  const [showProductSelector, setShowProductSelector] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState<string | null>(null)
  const [itemSearchQueries, setItemSearchQueries] = useState<Record<string, string>>({})
  const [itemDropdownOpen, setItemDropdownOpen] = useState<Record<string, boolean>>({})

  // 실시간 환율 가져오기
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const response = await fetch('/api/exchange-rate')
        const data = await response.json()
        if (data.rate) {
          setExchangeRate(Math.round(data.rate * 100) / 100)
        }
      } catch (error) {
        console.error('환율 조회 실패:', error)
      }
    }
    fetchExchangeRate()
  }, [])

  // 기본 채널 ID 가져오기 및 모든 통합 옵션 로드
  useEffect(() => {
    const fetchDefaultChannel = async () => {
      if (customer.channel_id) {
        setDefaultChannelId(customer.channel_id)
      } else {
        const { data: channels, error } = await supabase
          .from('channels')
          .select('id')
          .limit(1)
          .single()
        
        if (!error && channels) {
          setDefaultChannelId(channels.id)
        }
      }
    }
    fetchDefaultChannel()

    const fetchAllProductOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('product_options')
          .select(`
            id,
            name,
            description,
            choice_name,
            choice_description,
            adult_price_adjustment,
            child_price_adjustment,
            infant_price_adjustment,
            is_required,
            is_multiple,
            is_default,
            product_id
          `)
          .order('name', { ascending: true })

        if (error) throw error
        setAllProductOptions(data || [])
      } catch (error) {
        console.error('모든 통합 옵션 로드 오류:', error)
        setAllProductOptions([])
      }
    }
    fetchAllProductOptions()
  }, [customer.channel_id])

  // 저장된 인보이스 로드
  useEffect(() => {
    if (initialSavedInvoiceId) {
      loadSavedInvoice(initialSavedInvoiceId)
    } else {
      // 초기 인보이스 번호 및 빈 항목 생성
      const date = new Date()
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const random = Math.random().toString(36).substring(2, 8).toUpperCase()
      setInvoiceNumber(`INV-${year}${month}${day}-${random}`)

      const initialItem: InvoiceItem = {
        id: `item-${Date.now()}`,
        productId: '',
        productName: '',
        date: getLasVegasDate(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
        editable: true,
        participantType: 'adult',
        itemType: 'product',
        selectedChoices: {}
      }
      setInvoiceItems([initialItem])
    }
  }, [initialSavedInvoiceId])

  // 저장된 인보이스 로드 함수
  const loadSavedInvoice = async (invoiceId: string) => {
    setLoadingInvoice(true)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single()

      if (error) throw error

      if (data) {
        // 기존 choiceId/choiceOptionId를 selectedChoices로 변환
        const items = (data.items || []).map((item: any) => {
          // selectedChoices가 없고 기존 choiceId/choiceOptionId가 있으면 변환
          if (!item.selectedChoices && item.choiceId && item.choiceOptionId) {
            return {
              ...item,
              selectedChoices: {
                [item.choiceId]: item.choiceOptionId
              }
            }
          }
          // selectedChoices가 없으면 빈 객체로 초기화
          if (!item.selectedChoices) {
            return {
              ...item,
              selectedChoices: {}
            }
          }
          return item
        })
        
        setInvoiceNumber(data.invoice_number)
        setInvoiceDate(data.invoice_date)
        // 저장된 due_date가 있으면 사용하고, 없으면 issue_date의 3일 뒤로 설정
        setDueDate(data.due_date || getDueDateFromIssueDate(data.invoice_date))
        setInvoiceItems(items)
        setSubtotal(parseFloat(data.subtotal) || 0)
        setTax(parseFloat(data.tax) || 0)
        setTotal(parseFloat(data.total) || 0)
        setApplyTax(data.apply_tax || false)
        setTaxPercent(parseFloat(data.tax_percent) || 10)
        setApplyDiscount(data.apply_discount || false)
        setDiscountPercent(parseFloat(data.discount_percent) || 0)
        setDiscountAmount(parseFloat(data.discount) || 0)
        setDiscountReason(data.discount_reason || '')
        setApplyProcessingFee(data.apply_processing_fee || false)
        setExchangeRate(parseFloat(data.exchange_rate) || 1300)
        setNotes(data.notes || '')
        setSavedInvoiceId(data.id)

        // 검색어 초기화
        const searchQueries: Record<string, string> = {}
        items.forEach((item: any) => {
          if (item.productName) {
            searchQueries[item.id] = item.productName
          }
        })
        setItemSearchQueries(searchQueries)

        // 상품 초이스 로드
        const productIds = [...new Set(items.filter((item: any) => item.productId).map((item: any) => item.productId))]
        for (const productId of productIds) {
          await loadProductChoices(productId)
        }
      }
    } catch (error) {
      console.error('저장된 인보이스 로드 오류:', error)
      alert(locale === 'ko' ? '인보이스를 불러오는 중 오류가 발생했습니다.' : 'An error occurred while loading invoice.')
    } finally {
      setLoadingInvoice(false)
    }
  }

  // 합계 계산
  useEffect(() => {
    const calculatedSubtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0)
    const calculatedTax = applyTax ? calculatedSubtotal * (taxPercent / 100) : 0
    const calculatedDiscount = applyDiscount 
      ? (discountAmount > 0 ? discountAmount : (calculatedSubtotal + calculatedTax) * (discountPercent / 100))
      : 0
    const amountAfterDiscount = calculatedSubtotal + calculatedTax - calculatedDiscount
    const calculatedProcessingFee = applyProcessingFee ? amountAfterDiscount * 0.05 : 0
    const calculatedTotal = amountAfterDiscount + calculatedProcessingFee

    setSubtotal(calculatedSubtotal)
    setTax(calculatedTax)
    setTotal(calculatedTotal)
  }, [invoiceItems, applyTax, taxPercent, applyDiscount, discountPercent, discountAmount, applyProcessingFee])


  // 외부 클릭 시 드롭다운 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.add-menu-container')) {
        setShowAddMenu(null)
      }
      if (!target.closest('.item-combobox-container')) {
        setItemDropdownOpen({})
      }
    }

    if (showAddMenu || Object.keys(itemDropdownOpen).length > 0) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showAddMenu, itemDropdownOpen])

  // 상품 초이스 로드
  const loadProductChoices = async (productId: string) => {
    try {
      const { data: choicesData, error } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_group_en,
          choice_type,
          options:choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            is_active,
            is_default
          )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

      if (error) throw error

      const formattedChoices: ProductChoice[] = (choicesData || []).map((choice: any) => ({
        id: choice.id,
        name: choice.choice_group_ko || choice.choice_group,
        name_ko: choice.choice_group_ko || choice.choice_group,
        name_en: choice.choice_group_en || choice.choice_group,
        description: choice.choice_type,
        options: (choice.options || []).filter((opt: any) => opt.is_active !== false).map((opt: any) => ({
          id: opt.id,
          option_key: opt.option_key, // option_key 추가
          name: opt.option_name_ko || opt.option_name,
          name_ko: opt.option_name_ko || opt.option_name,
          name_en: opt.option_name,
          description: opt.option_key,
          adult_price: opt.adult_price || 0,
          child_price: opt.child_price || 0,
          infant_price: opt.infant_price || 0,
          is_active: opt.is_active !== false,
          is_default: opt.is_default || false
        }))
      }))

      setProductChoicesMap(prev => ({ ...prev, [productId]: formattedChoices }))
      return formattedChoices
    } catch (error) {
      console.error('상품 초이스 로드 오류:', error)
      return []
    }
  }

  // 항목 업데이트
  const handleUpdateInvoiceItem = async (itemId: string, updates: Partial<InvoiceItem>) => {
    const item = invoiceItems.find(i => i.id === itemId)
    if (!item) return

    const channelId = defaultChannelId || customer.channel_id || ''
    const participantType = updates.participantType || item.participantType || 'adult'
    const date = updates.date || item.date
    
    // 참가자 유형이 변경된 경우 가격 다시 계산
    if (updates.participantType && updates.participantType !== item.participantType && item.productId && channelId && date) {
      const adults = participantType === 'adult' ? 1 : 0
      const children = participantType === 'child' ? 1 : 0
      const infants = participantType === 'infant' ? 1 : 0

      try {
        // dynamic_pricing에서 기본 가격과 choices_pricing 직접 조회
        const { data: dynamicPricingData, error: pricingError } = await supabase
          .from('dynamic_pricing')
          .select('choices_pricing, adult_price, child_price, infant_price')
          .eq('product_id', item.productId)
          .eq('channel_id', channelId)
          .eq('date', date)
          .limit(1)
          .single()

        if (!pricingError && dynamicPricingData) {
          let basePrice = 0
          let choicePrice = 0

          // 참가자 유형에 맞는 기본 가격 가져오기
          if (participantType === 'adult') {
            basePrice = parseFloat(dynamicPricingData.adult_price || 0)
          } else if (participantType === 'child') {
            basePrice = parseFloat(dynamicPricingData.child_price || 0)
          } else {
            basePrice = parseFloat(dynamicPricingData.infant_price || 0)
          }

          // choices_pricing에서 해당 초이스 옵션의 가격 직접 조회
          if (item.choiceOptionId && dynamicPricingData.choices_pricing) {
            const choicesPricing = typeof dynamicPricingData.choices_pricing === 'string'
              ? JSON.parse(dynamicPricingData.choices_pricing)
              : dynamicPricingData.choices_pricing

            const choicePricing = choicesPricing[item.choiceOptionId]
            if (choicePricing) {
              if (participantType === 'adult') {
                choicePrice = parseFloat(choicePricing.adult || choicePricing.adult_price || 0)
              } else if (participantType === 'child') {
                choicePrice = parseFloat(choicePricing.child || choicePricing.child_price || 0)
              } else {
                choicePrice = parseFloat(choicePricing.infant || choicePricing.infant_price || 0)
              }
            }
          }

          // 기본 가격 + 초이스 가격
          updates.unitPrice = basePrice + choicePrice
          updates.total = updates.unitPrice * item.quantity
        }
      } catch (error) {
        console.error('참가자 유형 변경 시 동적 가격 조회 실패:', error)
      }
    }
    
    // 날짜가 변경된 경우 동적 가격 다시 계산
    if (updates.date && updates.date !== item.date && item.productId && channelId) {
      const adults = participantType === 'adult' ? 1 : 0
      const children = participantType === 'child' ? 1 : 0
      const infants = participantType === 'infant' ? 1 : 0
      const selectedChoices = item.choiceOptionId ? [item.choiceOptionId] : []
      const selectedOptions = item.selectedOptions || []

      if (channelId) {
        try {
          const pricing = await NewDynamicPricingService.calculateDynamicPrice(
            item.productId,
            channelId,
            updates.date,
            adults,
            children,
            infants,
            selectedChoices,
            selectedOptions
          )
          updates.unitPrice = pricing.totalPrice
          updates.total = pricing.totalPrice * item.quantity
        } catch (error) {
          console.error('날짜 변경 시 동적 가격 조회 실패:', error)
        }
      }
    }

    setInvoiceItems(prev => prev.map(i => {
      if (i.id === itemId) {
        const updated = { ...i, ...updates }
        if (updates.unitPrice !== undefined || updates.quantity !== undefined) {
          updated.total = updated.unitPrice * updated.quantity
        }
        return updated
      }
      return i
    }))
  }

  // 상품 선택
  const handleItemProductSelect = async (itemId: string, product: ProductSelectorProduct) => {
    const item = invoiceItems.find(i => i.id === itemId)
    if (!item) return

    const channelId = defaultChannelId || customer.channel_id || ''
    const date = item?.date || getLasVegasDate()
    const participantType = item?.participantType || 'adult'
    const adults = participantType === 'adult' ? 1 : 0
    const children = participantType === 'child' ? 1 : 0
    const infants = participantType === 'infant' ? 1 : 0

    let basePrice = 0
    if (channelId && date) {
      try {
        const pricing = await NewDynamicPricingService.calculateDynamicPrice(
          product.id,
          channelId,
          date,
          adults,
          children,
          infants,
          [],
          []
        )
        basePrice = pricing.basePrice
      } catch (error) {
        console.error('동적 가격 조회 실패:', error)
        const productData = products.find(p => p.id === product.id)
        if (participantType === 'adult' && productData?.adult_base_price) {
          basePrice = productData.adult_base_price
        } else if (participantType === 'child' && productData?.child_base_price) {
          basePrice = productData.child_base_price
        } else if (participantType === 'infant' && productData?.infant_base_price) {
          basePrice = productData.infant_base_price
        } else {
          basePrice = productData?.adult_base_price || productData?.base_price || 0
        }
      }
    } else {
      const productData = products.find(p => p.id === product.id)
      if (participantType === 'adult' && productData?.adult_base_price) {
        basePrice = productData.adult_base_price
      } else if (participantType === 'child' && productData?.child_base_price) {
        basePrice = productData.child_base_price
      } else if (participantType === 'infant' && productData?.infant_base_price) {
        basePrice = productData.infant_base_price
      } else {
        basePrice = productData?.adult_base_price || productData?.base_price || 0
      }
    }

    const quantity = item?.quantity || 1
    const productName = locale === 'ko' ? (product.name_ko || product.name) : (product.name_en || product.name)
    const participantLabel = locale === 'ko' 
      ? (participantType === 'adult' ? '성인' : participantType === 'child' ? '아동' : '유아')
      : (participantType === 'adult' ? 'Adult' : participantType === 'child' ? 'Child' : 'Infant')

    // 상품 초이스 로드
    await loadProductChoices(product.id)

    handleUpdateInvoiceItem(itemId, {
      productId: product.id,
      productName,
      description: `${productName} (${participantLabel})`,
      unitPrice: basePrice,
      total: basePrice * quantity,
      participantType: participantType as 'adult' | 'child' | 'infant' | 'none',
      choiceId: undefined,
      choiceOptionId: undefined,
      selectedChoices: {},
      choiceInfo: undefined,
      selectedOptions: []
    })

    // 검색어 업데이트
    setItemSearchQueries(prev => ({ ...prev, [itemId]: productName }))
    setItemDropdownOpen(prev => ({ ...prev, [itemId]: false }))
    setShowProductSelector(null)
  }

  // 초이스 옵션 선택 (그룹별)
  const handleItemChoiceSelect = async (itemId: string, choiceId: string, optionId: string | null) => {
    const item = invoiceItems.find(i => i.id === itemId)
    if (!item || !item.productId) return

    const channelId = defaultChannelId || customer.channel_id || ''
    const participantType = item.participantType || 'adult'
    const adults = participantType === 'adult' ? 1 : 0
    const children = participantType === 'child' ? 1 : 0
    const infants = participantType === 'infant' ? 1 : 0
    
    // 선택된 초이스 업데이트
    const currentSelectedChoices = item.selectedChoices || {}
    const updatedSelectedChoices = optionId 
      ? { ...currentSelectedChoices, [choiceId]: optionId }
      : (() => {
          const { [choiceId]: removed, ...rest } = currentSelectedChoices
          return rest
        })()
    
    // 모든 선택된 초이스 옵션 ID 배열
    const selectedChoiceOptionIds = Object.values(updatedSelectedChoices)
    const selectedOptions = item.selectedOptions || []

    let totalPrice = 0
    let basePrice = 0
    let choicePrice = 0

    if (channelId && item.date) {
      try {
        // dynamic_pricing에서 기본 가격과 choices_pricing 직접 조회
        const { data: dynamicPricingData, error: pricingError } = await supabase
          .from('dynamic_pricing')
          .select('choices_pricing, adult_price, child_price, infant_price')
          .eq('product_id', item.productId)
          .eq('channel_id', channelId)
          .eq('date', item.date)
          .limit(1)
          .single()

        if (!pricingError && dynamicPricingData) {
          // 참가자 유형에 맞는 기본 가격 가져오기
          if (participantType === 'adult') {
            basePrice = parseFloat(dynamicPricingData.adult_price || 0)
          } else if (participantType === 'child') {
            basePrice = parseFloat(dynamicPricingData.child_price || 0)
          } else {
            basePrice = parseFloat(dynamicPricingData.infant_price || 0)
          }

          // 모든 선택된 초이스의 가격을 계산하기 위해 calculateDynamicPrice 사용
          try {
            // 먼저 기본 가격만 계산 (초이스 없이)
            const pricingWithoutChoice = await NewDynamicPricingService.calculateDynamicPrice(
              item.productId,
              channelId,
              item.date,
              adults,
              children,
              infants,
              [], // 초이스 없이
              []
            )
            
            // 모든 선택된 초이스 포함 가격 계산
            const pricingWithChoice = await NewDynamicPricingService.calculateDynamicPrice(
              item.productId,
              channelId,
              item.date,
              adults,
              children,
              infants,
              selectedChoiceOptionIds, // 모든 선택된 초이스 옵션 ID
              []
            )
            
            // 초이스 가격 = (초이스 포함 가격 - 기본 가격) / 참가자 수
            const totalParticipants = adults + children + infants
            if (totalParticipants > 0) {
              choicePrice = (pricingWithChoice.totalPrice - pricingWithoutChoice.totalPrice) / totalParticipants
            } else {
              choicePrice = pricingWithChoice.totalPrice - pricingWithoutChoice.totalPrice
            }
            
            console.log('초이스 가격 계산 - basePrice:', basePrice, 'choicePrice:', choicePrice, 'totalPrice:', basePrice + choicePrice)
          } catch (error) {
            console.error('calculateDynamicPrice 실패:', error)
          }
        } else {
          // dynamic_pricing이 없으면 calculateDynamicPrice 사용
          const pricing = await NewDynamicPricingService.calculateDynamicPrice(
            item.productId,
            channelId,
            item.date,
            adults,
            children,
            infants,
            selectedChoiceOptionIds,
            []
          )
          basePrice = pricing.basePrice
        }

        // 기본 가격 + 초이스 가격
        totalPrice = basePrice + choicePrice
        console.log('최종 가격 계산 - basePrice:', basePrice, 'choicePrice:', choicePrice, 'totalPrice:', totalPrice, 'selectedChoices:', updatedSelectedChoices)
      } catch (error) {
        console.error('동적 가격 조회 실패:', error)
        // Fallback: 전체 가격 계산
        try {
          const pricing = await NewDynamicPricingService.calculateDynamicPrice(
            item.productId,
            channelId,
            item.date,
            adults,
            children,
            infants,
            selectedChoiceOptionIds,
            selectedOptions
          )
          totalPrice = pricing.totalPrice
          console.log('Fallback 가격 계산 결과:', totalPrice)
        } catch (fallbackError) {
          console.error('Fallback 가격 계산 실패:', fallbackError)
          const product = products.find(p => p.id === item.productId)
          if (participantType === 'adult' && product?.adult_base_price) {
            totalPrice = product.adult_base_price
          } else if (participantType === 'child' && product?.child_base_price) {
            totalPrice = product.child_base_price
          } else if (participantType === 'infant' && product?.infant_base_price) {
            totalPrice = product.infant_base_price
          } else {
            totalPrice = product?.adult_base_price || product?.base_price || 0
          }
        }
      }
    } else {
      // 채널 ID나 날짜가 없으면 기본 가격 사용
      const product = products.find(p => p.id === item.productId)
      if (participantType === 'adult' && product?.adult_base_price) {
        totalPrice = product.adult_base_price
      } else if (participantType === 'child' && product?.child_base_price) {
        totalPrice = product.child_base_price
      } else if (participantType === 'infant' && product?.infant_base_price) {
        totalPrice = product.infant_base_price
      } else {
        totalPrice = product?.adult_base_price || product?.base_price || 0
      }
    }

    // 모든 선택된 초이스 정보 생성
    const choices = productChoicesMap[item.productId] || []
    const choiceInfoParts: string[] = []
    
    for (const [cid, oid] of Object.entries(updatedSelectedChoices)) {
      const choice = choices.find(c => c.id === cid)
      const option = choice?.options.find(o => o.id === oid)
      if (choice && option) {
        const choiceName = locale === 'ko' ? (choice.name_ko || choice.name) : (choice.name_en || choice.name)
        const optionName = locale === 'ko' ? (option.name_ko || option.name) : (option.name_en || option.name)
        choiceInfoParts.push(`${choiceName}: ${optionName}`)
      }
    }
    
    const choiceInfo = choiceInfoParts.length > 0 ? choiceInfoParts.join(', ') : undefined

    console.log('초이스 선택 완료 - selectedChoices:', updatedSelectedChoices, 'totalPrice:', totalPrice, 'quantity:', item.quantity)

    handleUpdateInvoiceItem(itemId, {
      selectedChoices: updatedSelectedChoices,
      choiceInfo,
      unitPrice: totalPrice,
      total: totalPrice * item.quantity
    })
  }

  // 통합 옵션 선택
  const handleItemOptionSelect = async (itemId: string, optionId: string) => {
    const item = invoiceItems.find(i => i.id === itemId)
    if (!item) return

    const channelId = defaultChannelId || customer.channel_id || ''
    const participantType = item.participantType || 'adult'
    const adults = participantType === 'adult' ? 1 : 0
    const children = participantType === 'child' ? 1 : 0
    const infants = participantType === 'infant' ? 1 : 0
    const selectedChoices = item.choiceOptionId ? [item.choiceOptionId] : []
    const selectedOptions = item.selectedOptions || []
    const isSelected = selectedOptions.includes(optionId)
    const newOptions = isSelected 
      ? selectedOptions.filter(id => id !== optionId)
      : [...selectedOptions, optionId]

    let totalPrice = item.unitPrice
    if (channelId && item.date && item.productId) {
      try {
        const pricing = await NewDynamicPricingService.calculateDynamicPrice(
          item.productId,
          channelId,
          item.date,
          adults,
          children,
          infants,
          selectedChoices,
          newOptions
        )
        totalPrice = pricing.totalPrice
      } catch (error) {
        console.error('동적 가격 조회 실패:', error)
      }
    } else if (item.itemType === 'option') {
      // 통합 옵션만 선택된 경우
      const selectedOption = allProductOptions.find(opt => opt.id === optionId)
      if (selectedOption) {
        let adjustment = 0
        if (participantType === 'adult') {
          adjustment = selectedOption.adult_price_adjustment
        } else if (participantType === 'child') {
          adjustment = selectedOption.child_price_adjustment
        } else if (participantType === 'infant') {
          adjustment = selectedOption.infant_price_adjustment
        }
        
        if (isSelected) {
          totalPrice = item.unitPrice + adjustment
        } else {
          totalPrice = item.unitPrice - adjustment
        }
      }
    }

    handleUpdateInvoiceItem(itemId, {
      selectedOptions: newOptions,
      unitPrice: totalPrice,
      total: totalPrice * item.quantity
    })
  }

  // 항목 추가
  const handleAddInvoiceItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      productId: '',
      productName: '',
      date: getLasVegasDate(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      editable: true,
      participantType: 'adult',
      itemType: 'product',
      selectedChoices: {}
    }
    setInvoiceItems(prev => [...prev, newItem])
  }

  // 통합 옵션 항목 추가 (상품에 연결된 경우)
  const handleAddOptionItem = (productItem: InvoiceItem) => {
    const newOptionItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      productId: productItem.productId || '',
      productName: '',
      date: productItem.date || new Date().toISOString().split('T')[0],
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      editable: true,
      participantType: productItem.participantType || 'adult',
      itemType: 'option',
      optionId: undefined,
      selectedChoices: {}
    }
    setInvoiceItems(prev => [...prev, newOptionItem])
  }

  // 통합 옵션만 추가 (상품 없이)
  const handleAddStandaloneOptionItem = () => {
    const lastItem = invoiceItems[invoiceItems.length - 1]
    const newOptionItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      productId: '',
      productName: '',
      date: lastItem?.date || new Date().toISOString().split('T')[0],
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      editable: true,
      participantType: lastItem?.participantType || 'adult',
      itemType: 'option',
      optionId: undefined
    }
    setInvoiceItems(prev => [...prev, newOptionItem])
  }

  // 텍스트 항목 추가
  const handleAddTextItem = () => {
    const lastItem = invoiceItems[invoiceItems.length - 1]
    const newTextItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      productId: '',
      productName: '',
      date: lastItem?.date || getLasVegasDate(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      editable: true,
      participantType: 'none',
      itemType: 'product',
      selectedChoices: {}
    }
    setInvoiceItems(prev => [...prev, newTextItem])
  }

  // 항목 삭제
  const handleRemoveInvoiceItem = (itemId: string) => {
    setInvoiceItems(prev => prev.filter(i => i.id !== itemId))
  }

  // 인보이스 HTML 생성
  const generateInvoiceHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .invoice-container { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .company-info { flex: 1; }
          .company-info h2 { margin: 0 0 10px 0; font-size: 20px; font-weight: bold; }
          .company-info p { margin: 4px 0; font-size: 12px; line-height: 1.4; }
          .invoice-header { flex: 1; text-align: right; }
          .invoice-info { margin-bottom: 0; }
          .invoice-info p { margin: 6px 0; text-align: right; }
          .invoice-title { text-align: center; font-size: 32px; font-weight: bold; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="company-info">
            <h2>LAS VEGAS MANIA TOUR</h2>
            <p>3351 South Highland Drive</p>
            <p>Las Vegas, Nevada 89109</p>
            <p>United States</p>
            <p>info@maniatour.com</p>
            <p>+1 702-929-8025 / +1 702-444-5531</p>
          </div>
          <div class="invoice-header">
            <div class="invoice-info">
              <p><strong>${locale === 'ko' ? '인보이스 번호' : 'Invoice Number'}:</strong> ${invoiceNumber}</p>
              <p><strong>${locale === 'ko' ? '작성일' : 'Issue Date'}:</strong> ${new Date(invoiceDate).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}</p>
              ${dueDate ? `<p><strong>${locale === 'ko' ? '만기일' : 'Due Date'}:</strong> ${new Date(dueDate).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}</p>` : ''}
              <p><strong>${locale === 'ko' ? '고객' : 'Customer'}:</strong> ${customer.name}</p>
              <p><strong>${locale === 'ko' ? '이메일' : 'Email'}:</strong> ${customer.email}</p>
            </div>
          </div>
        </div>
        <h1 class="invoice-title">${locale === 'ko' ? '인보이스' : 'Invoice'}</h1>
        <table>
          <thead>
            <tr>
              <th>${locale === 'ko' ? '날짜' : 'Date'}</th>
              <th>${locale === 'ko' ? '항목' : 'Item'}</th>
              <th class="text-right">${locale === 'ko' ? '수량' : 'Quantity'}</th>
              <th class="text-right">${locale === 'ko' ? '단가' : 'Unit Price'}</th>
              <th class="text-right">${locale === 'ko' ? '합계' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceItems.map(item => `
              <tr>
                <td>${new Date(item.date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}</td>
                <td>
                  <div>${item.description}</div>
                  ${item.choiceInfo ? `<div style="margin-top: 4px;"><span style="font-size: 11px; background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px;">${item.choiceInfo}</span></div>` : ''}
                </td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${formatUSD(item.unitPrice)}</td>
                <td class="text-right">${formatUSD(item.total)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"></td>
              <td class="text-right">${locale === 'ko' ? '소계' : 'Subtotal'}:</td>
              <td class="text-right">${formatUSD(subtotal)}</td>
            </tr>
            ${applyTax && taxPercent > 0 ? `
            <tr>
              <td colspan="3"></td>
              <td class="text-right">${locale === 'ko' ? '세금' : 'Tax'} (${taxPercent}%):</td>
              <td class="text-right">${formatUSD(tax)}</td>
            </tr>
            ` : ''}
            ${applyDiscount && (discountPercent > 0 || discountAmount > 0) ? `
            <tr>
              <td colspan="3"></td>
              <td class="text-right">${locale === 'ko' ? '할인' : 'Discount'}${discountPercent > 0 ? ` (${discountPercent}%)` : ''}${discountReason ? ` - ${discountReason}` : ''}:</td>
              <td class="text-right" style="color: #dc2626;">-${formatUSD(discountAmount > 0 ? discountAmount : (subtotal + tax) * (discountPercent / 100))}</td>
            </tr>
            ` : ''}
            ${applyProcessingFee ? `
            <tr>
              <td colspan="3"></td>
              <td class="text-right">${locale === 'ko' ? '신용카드 처리 수수료 (5%)' : 'Credit Card Processing Fee (5%)'}:</td>
              <td class="text-right">${formatUSD((subtotal + tax - (applyDiscount ? (subtotal + tax) * (discountPercent / 100) : 0)) * 0.05)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td colspan="3"></td>
              <td class="text-right">${locale === 'ko' ? '총액' : 'Total'}:</td>
              <td class="text-right">${formatUSD(total)}</td>
            </tr>
          </tbody>
        </table>
        ${notes ? `<div style="margin-top: 20px;"><strong>${locale === 'ko' ? '메모' : 'Notes'}:</strong> ${notes}</div>` : ''}
      </body>
      </html>
    `
  }

  // 인보이스 저장 (임시저장 / 다시 저장)
  const handleSaveInvoice = async () => {
    setSaving(true)
    try {
      const invoiceData = {
        customer_id: customer.id,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        items: invoiceItems,
        subtotal,
        tax,
        tax_percent: applyTax ? taxPercent : 0,
        apply_tax: applyTax,
        discount: applyDiscount ? (discountAmount > 0 ? discountAmount : (subtotal + tax) * (discountPercent / 100)) : 0,
        discount_percent: applyDiscount ? discountPercent : 0,
        discount_reason: applyDiscount ? discountReason : '',
        apply_discount: applyDiscount,
        processing_fee: applyProcessingFee ? (subtotal + tax - (applyDiscount ? (discountAmount > 0 ? discountAmount : (subtotal + tax) * (discountPercent / 100)) : 0)) * 0.05 : 0,
        apply_processing_fee: applyProcessingFee,
        total,
        exchange_rate: exchangeRate,
        notes,
        status: 'draft'
      }

      let response
      if (savedInvoiceId) {
        // 업데이트
        response = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', savedInvoiceId)
          .select()
          .single()
      } else {
        // 새로 생성
        response = await supabase
          .from('invoices')
          .insert(invoiceData)
          .select()
          .single()
      }

      if (response.error) throw response.error

      const isUpdate = !!savedInvoiceId
      setSavedInvoiceId(response.data.id)
      alert(isUpdate
        ? (locale === 'ko' ? '인보이스가 다시 저장되었습니다.' : 'Invoice has been updated.')
        : (locale === 'ko' ? '인보이스가 임시 저장되었습니다.' : 'Invoice has been saved as draft.'))
    } catch (error) {
      console.error('인보이스 저장 오류:', error)
      alert(locale === 'ko' ? '인보이스 저장 중 오류가 발생했습니다.' : 'An error occurred while saving invoice.')
    } finally {
      setSaving(false)
    }
  }

  // 이메일 발송
  const handleSendEmail = async () => {
    if (!customer.email) {
      alert(locale === 'ko' ? '고객 이메일이 없습니다.' : 'Customer email is missing.')
      return
    }

    // 최소 하나의 항목이 선택되어 있는지 확인
    const hasValidItems = invoiceItems.some(item => 
      (item.itemType === 'product' && item.productId) || 
      (item.itemType === 'option' && item.optionId)
    )
    
    if (!hasValidItems) {
      alert(locale === 'ko' ? '최소 하나의 상품 또는 통합 옵션을 선택해주세요.' : 'Please select at least one product or integrated option.')
      return
    }

    setSending(true)
    try {
      const invoiceHtml = generateInvoiceHTML()

      const response = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: customer.email,
          subject: `${locale === 'ko' ? '인보이스' : 'Invoice'} - ${invoiceNumber}`,
          html: invoiceHtml,
          customerId: customer.id,
          invoiceNumber,
          invoiceDate,
          total
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // 이메일 발송 성공 시 인보이스 저장
        const invoiceData = {
          customer_id: customer.id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          items: invoiceItems,
          subtotal,
          tax,
          tax_percent: applyTax ? taxPercent : 0,
          apply_tax: applyTax,
          discount: applyDiscount ? (discountAmount > 0 ? discountAmount : (subtotal + tax) * (discountPercent / 100)) : 0,
          discount_percent: applyDiscount ? discountPercent : 0,
          discount_reason: applyDiscount ? discountReason : '',
          apply_discount: applyDiscount,
          processing_fee: applyProcessingFee ? (subtotal + tax - (applyDiscount ? (discountAmount > 0 ? discountAmount : (subtotal + tax) * (discountPercent / 100)) : 0)) * 0.05 : 0,
          apply_processing_fee: applyProcessingFee,
          total,
          exchange_rate: exchangeRate,
          notes,
          status: 'sent',
          sent_at: new Date().toISOString(),
          email_id: data.emailId
        }

        if (savedInvoiceId) {
          // 업데이트
          await supabase
            .from('invoices')
            .update(invoiceData)
            .eq('id', savedInvoiceId)
        } else {
          // 새로 생성
          const { data: savedData, error: saveError } = await supabase
            .from('invoices')
            .insert(invoiceData)
            .select()
            .single()
          
          if (!saveError && savedData) {
            setSavedInvoiceId(savedData.id)
          }
        }

        alert(locale === 'ko' ? '인보이스가 발송되었습니다.' : 'Invoice has been sent.')
        onClose()
      } else {
        alert(locale === 'ko' ? `발송 실패: ${data.error}` : `Failed to send: ${data.error}`)
      }
    } catch (error) {
      console.error('이메일 발송 오류:', error)
      alert(locale === 'ko' ? '이메일 발송 중 오류가 발생했습니다.' : 'An error occurred while sending email.')
    } finally {
      setSending(false)
    }
  }

  // 상품별 통합 옵션 가져오기
  const getProductOptions = (productId: string) => {
    if (!productId) return allProductOptions
    return allProductOptions.filter(opt => !opt.product_id || opt.product_id === productId)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {locale === 'ko' ? '인보이스 생성' : 'Create Invoice'}
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setLocale('ko')}
                className={`px-3 py-1 rounded text-sm ${locale === 'ko' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                한국어
              </button>
              <button
                onClick={() => setLocale('en')}
                className={`px-3 py-1 rounded text-sm ${locale === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                English
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 인보이스 정보 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {locale === 'ko' ? '인보이스 번호' : 'Invoice Number'}
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {locale === 'ko' ? '작성일' : 'Issue Date'}
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  const newIssueDate = e.target.value
                  setInvoiceDate(newIssueDate)
                  // Due Date가 비어있거나 Issue Date의 3일 뒤가 아닌 경우에만 자동 업데이트
                  if (!dueDate || dueDate === getDueDateFromIssueDate(invoiceDate)) {
                    setDueDate(getDueDateFromIssueDate(newIssueDate))
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {locale === 'ko' ? '만기일' : 'Due Date'}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* 인보이스 항목 테이블 */}
          <div className="mb-6">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-700 uppercase" style={{ width: '6%' }}>
                    {/* 추가/삭제 버튼 */}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase" style={{ width: '12%' }}>
                    {locale === 'ko' ? '날짜' : 'Date'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase" style={{ width: '30%' }}>
                    {locale === 'ko' ? '항목' : 'Item'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase" style={{ width: '11%' }}>
                    {locale === 'ko' ? '참가자 유형' : 'Participant'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase" style={{ width: '9%' }}>
                    {locale === 'ko' ? '수량' : 'Quantity'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase" style={{ width: '13%' }}>
                    {locale === 'ko' ? '단가' : 'Unit Price'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase" style={{ width: '19%' }}>
                    {locale === 'ko' ? '합계' : 'Total'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item, index) => {
                  const choices = item.productId ? (productChoicesMap[item.productId] || []) : []
                  const productOptions = getProductOptions(item.productId)
                  const hasOptions = productOptions.length > 0

                  return (
                    <tr key={item.id} className="border-b">
                      {/* 추가/삭제 버튼 */}
                      <td className="px-1 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <div className="relative add-menu-container">
                            <button
                              onClick={() => setShowAddMenu(showAddMenu === item.id ? null : item.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded hover:bg-blue-50"
                              title={locale === 'ko' ? '항목 추가' : 'Add Item'}
                            >
                              <Plus size={14} />
                            </button>
                            {showAddMenu === item.id && (
                              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                                <button
                                  onClick={() => {
                                    handleAddInvoiceItem()
                                    setShowAddMenu(null)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors flex items-center space-x-2"
                                >
                                  <Plus size={14} className="text-green-600" />
                                  <span>{locale === 'ko' ? '상품 추가' : 'Add Product'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleAddStandaloneOptionItem()
                                    setShowAddMenu(null)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center space-x-2 border-t border-gray-100"
                                >
                                  <Package size={14} className="text-purple-600" />
                                  <span>{locale === 'ko' ? '통합 옵션 추가' : 'Add Integrated Option'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleAddTextItem()
                                    setShowAddMenu(null)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center space-x-2 border-t border-gray-100"
                                >
                                  <FileText size={14} className="text-blue-600" />
                                  <span>{locale === 'ko' ? '텍스트 추가' : 'Add Text'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                          {invoiceItems.length > 1 && (
                            <button
                              onClick={() => handleRemoveInvoiceItem(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                              title={locale === 'ko' ? '삭제' : 'Remove'}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                      {/* 날짜 */}
                      <td className="px-4 py-3 text-sm">
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => handleUpdateInvoiceItem(item.id, { date: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>

                      {/* 항목 */}
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-2">
                          {item.itemType === 'option' ? (
                            <select
                              value={item.optionId || ''}
                              onChange={async (e) => {
                                const optionId = e.target.value
                                const selectedOption = allProductOptions.find(opt => opt.id === optionId)
                                if (!selectedOption) return

                                const optionName = locale === 'ko' 
                                  ? (selectedOption.name || selectedOption.choice_name || '')
                                  : (selectedOption.description || selectedOption.choice_description || selectedOption.name || '')
                                
                                const participantType = item.participantType || 'adult'
                                let totalPrice = 0
                                
                                // 상품이 연결된 경우 동적 가격 계산 시도
                                if (item.productId && defaultChannelId) {
                                  try {
                                    const adults = participantType === 'adult' ? 1 : 0
                                    const children = participantType === 'child' ? 1 : 0
                                    const infants = participantType === 'infant' ? 1 : 0
                                    const pricing = await NewDynamicPricingService.calculateDynamicPrice(
                                      item.productId,
                                      defaultChannelId,
                                      item.date,
                                      adults,
                                      children,
                                      infants,
                                      [],
                                      [e.target.value]
                                    )
                                    totalPrice = pricing.additionalOptionsPrice
                                  } catch (error) {
                                    console.error('동적 가격 조회 실패:', error)
                                    // 동적 가격 실패 시 가격 조정 사용
                                    if (participantType === 'adult') {
                                      totalPrice = selectedOption.adult_price_adjustment
                                    } else if (participantType === 'child') {
                                      totalPrice = selectedOption.child_price_adjustment
                                    } else {
                                      totalPrice = selectedOption.infant_price_adjustment
                                    }
                                  }
                                } else {
                                  // 통합 옵션만 선택된 경우 가격 조정 사용
                                  if (participantType === 'adult') {
                                    totalPrice = selectedOption.adult_price_adjustment
                                  } else if (participantType === 'child') {
                                    totalPrice = selectedOption.child_price_adjustment
                                  } else {
                                    totalPrice = selectedOption.infant_price_adjustment
                                  }
                                }

                                handleUpdateInvoiceItem(item.id, {
                                  optionId: e.target.value,
                                  productName: optionName,
                                  description: optionName,
                                  unitPrice: totalPrice,
                                  total: totalPrice * item.quantity
                                })
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">{locale === 'ko' ? '통합 옵션 선택' : 'Select Integrated Option'}</option>
                              {productOptions.map(option => {
                                const optionName = locale === 'ko' 
                                  ? (option.name || option.choice_name || '')
                                  : (option.description || option.choice_description || option.name || '')
                                const participantType = item.participantType || 'adult'
                                const adjustment = participantType === 'adult' 
                                  ? option.adult_price_adjustment
                                  : participantType === 'child'
                                  ? option.child_price_adjustment
                                  : option.infant_price_adjustment
                                
                                return (
                                  <option key={option.id} value={option.id}>
                                    {optionName} {adjustment !== 0 && `(${adjustment > 0 ? '+' : ''}${formatUSD(adjustment)})`}
                                  </option>
                                )
                              })}
                            </select>
                          ) : (
                            <>
                              <div className="space-y-2">
                                {/* Combobox 스타일 입력 */}
                                <div className="relative item-combobox-container">
                                  <div className="flex items-center border border-gray-300 rounded-lg">
                                    <Search className="absolute left-2 h-4 w-4 text-gray-400" />
                                    <input
                                      type="text"
                                      value={itemSearchQueries[item.id] !== undefined ? itemSearchQueries[item.id] : (item.productName || '')}
                                      onChange={(e) => {
                                        const query = e.target.value
                                        setItemSearchQueries(prev => ({ ...prev, [item.id]: query }))
                                        setItemDropdownOpen(prev => ({ ...prev, [item.id]: true }))
                                        
                                        // 텍스트 입력 시 즉시 업데이트
                                        handleUpdateInvoiceItem(item.id, {
                                          productName: query,
                                          description: item.description || query,
                                          productId: '', // 텍스트 입력 시 productId는 빈 문자열
                                          choiceId: undefined,
                                          choiceOptionId: undefined,
                                          choiceInfo: undefined
                                        })
                                      }}
                                      onFocus={() => {
                                        setItemDropdownOpen(prev => ({ ...prev, [item.id]: true }))
                                        // 포커스 시 검색어 초기화 (상품명으로)
                                        if (itemSearchQueries[item.id] === undefined && item.productName) {
                                          setItemSearchQueries(prev => ({ ...prev, [item.id]: item.productName }))
                                        }
                                      }}
                                      placeholder={locale === 'ko' ? '입력, 선택 또는 검색' : 'Type, select or search for item'}
                                      className="w-full pl-8 pr-8 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                      onClick={() => {
                                        const isOpen = itemDropdownOpen[item.id]
                                        setItemDropdownOpen(prev => ({ ...prev, [item.id]: !isOpen }))
                                        if (!isOpen) {
                                          setShowProductSelector(item.id)
                                        }
                                      }}
                                      className="absolute right-2 p-1 hover:bg-gray-100 rounded"
                                    >
                                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${itemDropdownOpen[item.id] ? 'rotate-180' : ''}`} />
                                    </button>
                                  </div>
                                  
                                  {/* 드롭다운 목록 */}
                                  {itemDropdownOpen[item.id] && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      <button
                                        onClick={() => {
                                          setShowProductSelector(item.id)
                                          setItemDropdownOpen(prev => ({ ...prev, [item.id]: false }))
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100"
                                      >
                                        {locale === 'ko' ? '상품 목록에서 선택' : 'Select from product list'}
                                      </button>
                                      {(() => {
                                        const query = itemSearchQueries[item.id] || ''
                                        const filteredProducts = products.filter(p => {
                                          const nameKo = p.name_ko?.toLowerCase() || ''
                                          const nameEn = p.name_en?.toLowerCase() || ''
                                          const searchLower = query.toLowerCase()
                                          return nameKo.includes(searchLower) || nameEn.includes(searchLower)
                                        }).slice(0, 10)
                                        
                                        return filteredProducts.map(product => {
                                          const productName = locale === 'ko' ? (product.name_ko || product.name_en) : (product.name_en || product.name_ko)
                                          return (
                                            <button
                                              key={product.id}
                                              onClick={() => {
                                                handleItemProductSelect(item.id, product)
                                                setItemSearchQueries(prev => ({ ...prev, [item.id]: productName || '' }))
                                                setItemDropdownOpen(prev => ({ ...prev, [item.id]: false }))
                                              }}
                                              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                                            >
                                              {productName}
                                            </button>
                                          )
                                        })
                                      })()}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Description 필드 */}
                                <textarea
                                  value={item.description || ''}
                                  onChange={(e) => handleUpdateInvoiceItem(item.id, {
                                    description: e.target.value
                                  })}
                                  placeholder={locale === 'ko' ? '설명 작성' : 'Write a description'}
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y"
                                />
                              </div>
                              {/* 초이스 그룹별 선택 */}
                              {item.productId && choices.length > 0 && (
                                <div className="space-y-2 mt-2">
                                  {choices.map(choice => {
                                    const options = choice.options?.filter(opt => opt.is_active) || []
                                    if (options.length === 0) return null
                                    
                                    const choiceName = locale === 'ko' ? (choice.name_ko || choice.name) : (choice.name_en || choice.name)
                                    const selectedOptionId = item.selectedChoices?.[choice.id] || ''
                                    
                                    return (
                                      <div key={choice.id} className="space-y-1">
                                        <label className="text-xs font-medium text-gray-700">
                                          {choiceName}
                                        </label>
                                        <select
                                          value={selectedOptionId}
                                          onChange={(e) => {
                                            const optionId = e.target.value || null
                                            handleItemChoiceSelect(item.id, choice.id, optionId)
                                          }}
                                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                        >
                                          <option value="">{locale === 'ko' ? '선택 안함' : 'None'}</option>
                                          {options.map(option => {
                                            const optionName = locale === 'ko' ? (option.name_ko || option.name) : (option.name_en || option.name)
                                            return (
                                              <option key={option.id} value={option.id}>
                                                {optionName}
                                              </option>
                                            )
                                          })}
                                        </select>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              {item.choiceInfo && (
                                <div className="text-xs text-blue-600 mt-1">
                                  {item.choiceInfo}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* 참가자 유형 */}
                      <td className="px-4 py-3 text-sm text-center">
                        {item.itemType === 'product' ? (
                          <select
                            value={item.participantType || 'adult'}
                            onChange={async (e) => {
                              const newParticipantType = e.target.value as 'adult' | 'child' | 'infant' | 'none'
                              await handleUpdateInvoiceItem(item.id, { participantType: newParticipantType })
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="adult">{locale === 'ko' ? '성인' : 'Adult'}</option>
                            <option value="child">{locale === 'ko' ? '아동' : 'Child'}</option>
                            <option value="infant">{locale === 'ko' ? '유아' : 'Infant'}</option>
                            <option value="none">{locale === 'ko' ? '없음' : 'None'}</option>
                          </select>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            {item.participantType === 'adult' ? (locale === 'ko' ? '성인' : 'Adult') :
                             item.participantType === 'child' ? (locale === 'ko' ? '아동' : 'Child') :
                             item.participantType === 'infant' ? (locale === 'ko' ? '유아' : 'Infant') :
                             (locale === 'ko' ? '없음' : 'None')}
                          </span>
                        )}
                      </td>

                      {/* 수량 */}
                      <td className="px-4 py-3 text-sm text-right">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateInvoiceItem(item.id, {
                            quantity: parseInt(e.target.value) || 1,
                            total: item.unitPrice * (parseInt(e.target.value) || 1)
                          })}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                        />
                      </td>

                      {/* 단가 */}
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        <div className="flex items-center justify-end">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                            <input
                              type="number"
                              value={item.unitPrice.toFixed(2)}
                              onChange={(e) => handleUpdateInvoiceItem(item.id, {
                                unitPrice: parseFloat(e.target.value) || 0,
                                total: (parseFloat(e.target.value) || 0) * item.quantity
                              })}
                              className="w-24 pl-6 pr-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-2 focus:ring-blue-500"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </td>

                      {/* 합계 */}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {formatUSD(item.total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                    {locale === 'ko' ? '소계' : 'Subtotal'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {formatUSD(subtotal)}
                  </td>
                </tr>
                {/* 세금 */}
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={applyTax}
                        onChange={(e) => {
                          setApplyTax(e.target.checked)
                          if (!e.target.checked) {
                            setTaxPercent(0)
                          } else if (taxPercent === 0) {
                            setTaxPercent(10)
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label className="text-sm font-medium">
                        {locale === 'ko' ? '세금 적용' : 'Apply Tax'}
                      </label>
                    </div>
                  </td>
                  <td colSpan={2} className="px-4 py-3">
                    {applyTax && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={taxPercent}
                          onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          placeholder="10"
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {applyTax && taxPercent > 0 && (
                      <span>{formatUSD(tax)}</span>
                    )}
                  </td>
                </tr>
                {/* 할인 */}
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={applyDiscount}
                        onChange={(e) => {
                          setApplyDiscount(e.target.checked)
                          if (!e.target.checked) {
                            setDiscountPercent(0)
                            setDiscountAmount(0)
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label className="text-sm font-medium">
                        {locale === 'ko' ? '할인 적용' : 'Apply Discount'}
                      </label>
                    </div>
                  </td>
                  <td colSpan={2} className="px-4 py-3">
                    {applyDiscount && (
                      <input
                        type="text"
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        placeholder={locale === 'ko' ? '할인 이유 (선택사항)' : 'Discount reason (optional)'}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {applyDiscount && (
                      <div className="flex items-center justify-end space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={discountPercent}
                          onChange={(e) => {
                            const newPercent = parseFloat(e.target.value) || 0
                            setDiscountPercent(newPercent)
                            // 퍼센테이지 입력 시 할인 금액 자동 계산
                            if (newPercent > 0) {
                              const calculatedSubtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0)
                              const calculatedTax = applyTax ? calculatedSubtotal * (taxPercent / 100) : 0
                              const calculatedDiscount = (calculatedSubtotal + calculatedTax) * (newPercent / 100)
                              setDiscountAmount(calculatedDiscount)
                            } else {
                              setDiscountAmount(0)
                            }
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {applyDiscount && (
                      <div className="flex items-center justify-end">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-red-600 text-sm font-medium">-$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={(() => {
                              if (discountAmount > 0) {
                                return discountAmount.toFixed(2)
                              } else if (discountPercent > 0) {
                                const calculatedSubtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0)
                                const calculatedTax = applyTax ? calculatedSubtotal * (taxPercent / 100) : 0
                                const calculatedDiscount = (calculatedSubtotal + calculatedTax) * (discountPercent / 100)
                                return calculatedDiscount.toFixed(2)
                              }
                              return ''
                            })()}
                            onChange={(e) => {
                              const newAmount = parseFloat(e.target.value) || 0
                              setDiscountAmount(newAmount)
                              setDiscountPercent(0) // 금액 입력 시 퍼센테이지는 0으로
                            }}
                            className="w-24 pl-8 pr-2 py-1 border border-gray-300 rounded text-right text-sm text-red-600 focus:ring-2 focus:ring-red-500"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
                {/* 신용카드 처리 수수료 */}
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={applyProcessingFee}
                        onChange={(e) => setApplyProcessingFee(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label className="text-sm font-medium">
                        {locale === 'ko' ? '신용카드 처리 수수료 적용 (5%)' : 'Apply Credit Card Processing Fee (5%)'}
                      </label>
                    </div>
                  </td>
                  <td colSpan={2} className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {applyProcessingFee && (
                      <span>{formatUSD(total - (subtotal + tax - (applyDiscount ? (subtotal + tax) * (discountPercent / 100) : 0)))}</span>
                    )}
                  </td>
                </tr>
                <tr className="bg-blue-50">
                  <td colSpan={6} className="px-4 py-3 text-lg font-bold text-gray-900 text-right">
                    {locale === 'ko' ? '총액' : 'Total'}
                  </td>
                  <td className="px-4 py-3 text-lg font-bold text-blue-600 text-right">
                    <div className="flex flex-col items-end">
                      <span>{formatUSD(total)}</span>
                      {showKRW && (
                        <span className="text-sm font-normal text-gray-600 mt-1">
                          {formatKRW(convertToKRW(total, exchangeRate))}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {/* 환율 추가 버튼 */}
                <tr>
                  <td colSpan={7} className="px-4 py-2 text-center">
                    <button
                      onClick={() => setShowKRW(!showKRW)}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                    >
                      <span>{showKRW ? (locale === 'ko' ? '환율 숨기기' : 'Hide Exchange Rate') : (locale === 'ko' ? '환율 추가' : 'Show Exchange Rate')}</span>
                    </button>
                  </td>
                </tr>
                {/* 환율 정보 (showKRW가 true일 때만 표시) */}
                {showKRW && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">
                          {locale === 'ko' ? '송금보낼때 환율 (1 USD =' : 'Transfer Exchange Rate (1 USD ='}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1300)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          placeholder="1300"
                          title={locale === 'ko' ? '실시간 환율이 자동으로 로드됩니다. 수동으로 수정할 수 있습니다.' : 'Real-time exchange rate is loaded automatically. You can manually adjust it.'}
                        />
                        <span className="text-sm text-gray-700 whitespace-nowrap">KRW)</span>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/exchange-rate')
                              const data = await response.json()
                              if (data.rate) {
                                setExchangeRate(Math.round(data.rate * 100) / 100)
                              }
                            } catch (error) {
                              console.error('환율 새로고침 실패:', error)
                            }
                          }}
                          className="ml-2 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                          title={locale === 'ko' ? '환율 새로고침' : 'Refresh exchange rate'}
                        >
                          🔄
                        </button>
                      </div>
                    </td>
                    <td colSpan={3} className="px-4 py-2"></td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* 메모 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {locale === 'ko' ? '메모' : 'Notes'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder={locale === 'ko' ? '추가 메모를 입력하세요...' : 'Enter additional notes...'}
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-6 border-t">
          <div className="flex items-center space-x-2">
            {savedInvoiceId && (
              <span className="text-sm text-green-600">
                {locale === 'ko' ? '임시 저장됨 (다시 저장 가능)' : 'Saved as draft (can save again)'}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPreview(true)}
              disabled={!invoiceItems.some(item => 
                (item.itemType === 'product' && item.productId) || 
                (item.itemType === 'option' && item.optionId)
              )}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>{locale === 'ko' ? '미리보기' : 'Preview'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {locale === 'ko' ? '취소' : 'Cancel'}
            </button>
            <button
              onClick={handleSaveInvoice}
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? (locale === 'ko' ? '저장 중...' : 'Saving...')
                : savedInvoiceId
                  ? (locale === 'ko' ? '다시 저장' : 'Save Again')
                  : (locale === 'ko' ? '임시저장' : 'Save as Draft')}
            </button>
            <button
              onClick={handleSendEmail}
              disabled={sending || !invoiceItems.some(item => 
                (item.itemType === 'product' && item.productId) || 
                (item.itemType === 'option' && item.optionId)
              )}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>{sending ? (locale === 'ko' ? '발송 중...' : 'Sending...') : (locale === 'ko' ? '이메일 발송' : 'Send Email')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 인보이스 미리보기 모달 */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                {locale === 'ko' ? '인보이스 미리보기' : 'Invoice Preview'}
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <iframe
                srcDoc={generateInvoiceHTML()}
                className="w-full h-full min-h-[600px] border border-gray-300 rounded bg-white"
                title={locale === 'ko' ? '인보이스 미리보기' : 'Invoice Preview'}
                style={{ height: 'calc(90vh - 200px)' }}
              />
            </div>
            <div className="flex items-center justify-end p-6 border-t bg-white">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                {locale === 'ko' ? '닫기' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상품 선택 모달 */}
      {showProductSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">{locale === 'ko' ? '상품 선택' : 'Select Product'}</h3>
              <button
                onClick={() => setShowProductSelector(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <ProductSelector
                selectedProductId={invoiceItems.find(i => i.id === showProductSelector)?.productId}
                onProductSelect={(product) => {
                  if (product && showProductSelector) {
                    handleItemProductSelect(showProductSelector, product)
                  }
                }}
                showChoices={false}
                locale={locale}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
