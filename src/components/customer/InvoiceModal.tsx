'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Send, DollarSign, Users, Package, Plus, Trash2, Calendar } from 'lucide-react'
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
  participantType?: 'adult' | 'child' | 'infant'
  choiceId?: string
  choiceOptionId?: string
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

  const [invoiceDate, setInvoiceDate] = useState(getLasVegasDate())
  const [notes, setNotes] = useState('')
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null)
  const [allProductOptions, setAllProductOptions] = useState<ProductOption[]>([])
  const [defaultChannelId, setDefaultChannelId] = useState<string>('')
  const [applyTax, setApplyTax] = useState(true)
  const [taxPercent, setTaxPercent] = useState(10)
  const [applyDiscount, setApplyDiscount] = useState(false)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [applyProcessingFee, setApplyProcessingFee] = useState(false)
  const [showKRW, setShowKRW] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(1300)
  const [productChoicesMap, setProductChoicesMap] = useState<Record<string, ProductChoice[]>>({})
  const [showProductSelector, setShowProductSelector] = useState<string | null>(null)

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
        itemType: 'product'
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
        setInvoiceNumber(data.invoice_number)
        setInvoiceDate(data.invoice_date)
        setInvoiceItems(data.items || [])
        setSubtotal(parseFloat(data.subtotal) || 0)
        setTax(parseFloat(data.tax) || 0)
        setTotal(parseFloat(data.total) || 0)
        setApplyTax(data.apply_tax || false)
        setTaxPercent(parseFloat(data.tax_percent) || 10)
        setApplyDiscount(data.apply_discount || false)
        setDiscountPercent(parseFloat(data.discount_percent) || 0)
        setApplyProcessingFee(data.apply_processing_fee || false)
        setExchangeRate(parseFloat(data.exchange_rate) || 1300)
        setNotes(data.notes || '')
        setSavedInvoiceId(data.id)

        // 상품 초이스 로드
        const productIds = [...new Set((data.items || []).filter((item: any) => item.productId).map((item: any) => item.productId))]
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
    const calculatedDiscount = applyDiscount ? (calculatedSubtotal + calculatedTax) * (discountPercent / 100) : 0
    const amountAfterDiscount = calculatedSubtotal + calculatedTax - calculatedDiscount
    const calculatedProcessingFee = applyProcessingFee ? amountAfterDiscount * 0.05 : 0
    const calculatedTotal = amountAfterDiscount + calculatedProcessingFee

    setSubtotal(calculatedSubtotal)
    setTax(calculatedTax)
    setTotal(calculatedTotal)
  }, [invoiceItems, applyTax, taxPercent, applyDiscount, discountPercent, applyProcessingFee])

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
    
    // 날짜가 변경된 경우 동적 가격 다시 계산
    if (updates.date && updates.date !== item.date && item.productId && channelId) {
      const participantType = item.participantType || 'adult'
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
      participantType: participantType as 'adult' | 'child' | 'infant',
      choiceId: undefined,
      choiceOptionId: undefined,
      choiceInfo: undefined,
      selectedOptions: []
    })

    setShowProductSelector(null)
  }

  // 초이스 옵션 선택
  const handleItemChoiceSelect = async (itemId: string, choiceId: string, optionId: string) => {
    const item = invoiceItems.find(i => i.id === itemId)
    if (!item || !item.productId) return

    const channelId = defaultChannelId || customer.channel_id || ''
    const participantType = item.participantType || 'adult'
    const adults = participantType === 'adult' ? 1 : 0
    const children = participantType === 'child' ? 1 : 0
    const infants = participantType === 'infant' ? 1 : 0
    const selectedChoices = [optionId]
    const selectedOptions = item.selectedOptions || []

    let totalPrice = 0
    if (channelId && item.date) {
      try {
        const pricing = await NewDynamicPricingService.calculateDynamicPrice(
          item.productId,
          channelId,
          item.date,
          adults,
          children,
          infants,
          selectedChoices,
          selectedOptions
        )
        totalPrice = pricing.totalPrice
      } catch (error) {
        console.error('동적 가격 조회 실패:', error)
        let basePrice = 0
        const product = products.find(p => p.id === item.productId)
        if (participantType === 'adult' && product?.adult_base_price) {
          basePrice = product.adult_base_price
        } else if (participantType === 'child' && product?.child_base_price) {
          basePrice = product.child_base_price
        } else if (participantType === 'infant' && product?.infant_base_price) {
          basePrice = product.infant_base_price
        } else {
          basePrice = product?.adult_base_price || product?.base_price || 0
        }
        totalPrice = basePrice
      }
    }

    const choices = productChoicesMap[item.productId] || []
    const choice = choices.find(c => c.id === choiceId)
    const option = choice?.options.find(o => o.id === optionId)
    const choiceName = locale === 'ko' ? (choice?.name_ko || choice?.name) : (choice?.name_en || choice?.name)
    const optionName = locale === 'ko' ? (option?.name_ko || option?.name) : (option?.name_en || option?.name)

    handleUpdateInvoiceItem(itemId, {
      choiceId,
      choiceOptionId: optionId,
      choiceInfo: `${choiceName}: ${optionName}`,
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
      itemType: 'product'
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
      optionId: undefined
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
          .invoice-header { margin-bottom: 30px; }
          .invoice-info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <h1>${locale === 'ko' ? '인보이스' : 'Invoice'}</h1>
          <div class="invoice-info">
            <p><strong>${locale === 'ko' ? '인보이스 번호' : 'Invoice Number'}:</strong> ${invoiceNumber}</p>
            <p><strong>${locale === 'ko' ? '날짜' : 'Date'}:</strong> ${new Date(invoiceDate).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}</p>
            <p><strong>${locale === 'ko' ? '고객' : 'Customer'}:</strong> ${customer.name}</p>
            <p><strong>${locale === 'ko' ? '이메일' : 'Email'}:</strong> ${customer.email}</p>
          </div>
        </div>
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
              <td colspan="5" class="text-right">${locale === 'ko' ? '소계' : 'Subtotal'}:</td>
              <td class="text-right">${formatUSD(subtotal)}</td>
            </tr>
            ${applyTax && taxPercent > 0 ? `
            <tr>
              <td colspan="5" class="text-right">${locale === 'ko' ? '세금' : 'Tax'} (${taxPercent}%):</td>
              <td class="text-right">${formatUSD(tax)}</td>
            </tr>
            ` : ''}
            ${applyDiscount && discountPercent > 0 ? `
            <tr>
              <td colspan="5" class="text-right">${locale === 'ko' ? '할인' : 'Discount'} (${discountPercent}%):</td>
              <td class="text-right" style="color: #dc2626;">-${formatUSD((subtotal + tax) * (discountPercent / 100))}</td>
            </tr>
            ` : ''}
            ${applyProcessingFee ? `
            <tr>
              <td colspan="5" class="text-right">${locale === 'ko' ? '신용카드 처리 수수료 (5%)' : 'Credit Card Processing Fee (5%)'}:</td>
              <td class="text-right">${formatUSD((subtotal + tax - (applyDiscount ? (subtotal + tax) * (discountPercent / 100) : 0)) * 0.05)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td colspan="5" class="text-right">${locale === 'ko' ? '총액' : 'Total'}:</td>
              <td class="text-right">${formatUSD(total)}</td>
            </tr>
          </tbody>
        </table>
        ${notes ? `<div style="margin-top: 20px;"><strong>${locale === 'ko' ? '메모' : 'Notes'}:</strong> ${notes}</div>` : ''}
      </body>
      </html>
    `
  }

  // 인보이스 저장
  const handleSaveInvoice = async () => {
    // 최소 하나의 항목이 선택되어 있는지 확인
    const hasValidItems = invoiceItems.some(item => 
      (item.itemType === 'product' && item.productId) || 
      (item.itemType === 'option' && item.optionId)
    )
    
    if (!hasValidItems) {
      alert(locale === 'ko' ? '최소 하나의 상품 또는 통합 옵션을 선택해주세요.' : 'Please select at least one product or integrated option.')
      return
    }

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
        discount: applyDiscount ? (subtotal + tax) * (discountPercent / 100) : 0,
        discount_percent: applyDiscount ? discountPercent : 0,
        apply_discount: applyDiscount,
        processing_fee: applyProcessingFee ? (subtotal + tax - (applyDiscount ? (subtotal + tax) * (discountPercent / 100) : 0)) * 0.05 : 0,
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

      setSavedInvoiceId(response.data.id)
      alert(locale === 'ko' ? '인보이스가 저장되었습니다.' : 'Invoice has been saved.')
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
          items: invoiceItems,
          subtotal,
          tax,
          tax_percent: applyTax ? taxPercent : 0,
          apply_tax: applyTax,
          discount: applyDiscount ? (subtotal + tax) * (discountPercent / 100) : 0,
          discount_percent: applyDiscount ? discountPercent : 0,
          apply_discount: applyDiscount,
          processing_fee: applyProcessingFee ? (subtotal + tax - (applyDiscount ? (subtotal + tax) * (discountPercent / 100) : 0)) * 0.05 : 0,
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
          <div className="grid grid-cols-2 gap-4 mb-6">
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
                {locale === 'ko' ? '날짜' : 'Date'}
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* 인보이스 항목 테이블 */}
          <div className="mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase w-24">
                    {locale === 'ko' ? '날짜' : 'Date'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    {locale === 'ko' ? '항목' : 'Item'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase w-20">
                    {locale === 'ko' ? '수량' : 'Quantity'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase w-32">
                    {locale === 'ko' ? '단가' : 'Unit Price'}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase w-32">
                    {locale === 'ko' ? '합계' : 'Total'}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase w-16">
                    {/* 삭제 버튼 */}
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
                              <button
                                onClick={() => setShowProductSelector(item.id)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left hover:bg-gray-50"
                              >
                                {item.productName || (locale === 'ko' ? '상품 선택' : 'Select Product')}
                              </button>
                              {item.productId && choices.length > 0 && (
                                <select
                                  value={item.choiceOptionId || ''}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      const choice = choices.find(c => c.options.some(o => o.id === e.target.value))
                                      if (choice) {
                                        handleItemChoiceSelect(item.id, choice.id, e.target.value)
                                      }
                                    } else {
                                      handleUpdateInvoiceItem(item.id, {
                                        choiceId: undefined,
                                        choiceOptionId: undefined,
                                        choiceInfo: undefined,
                                        unitPrice: item.unitPrice,
                                        total: item.unitPrice * item.quantity
                                      })
                                    }
                                  }}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs mt-1"
                                >
                                  <option value="">{locale === 'ko' ? '초이스 선택 (선택사항)' : 'Select Choice (Optional)'}</option>
                                  {choices.map(choice => {
                                    const options = choice.options?.filter(opt => opt.is_active) || []
                                    return options.map(option => (
                                      <option key={option.id} value={option.id}>
                                        {locale === 'ko' ? (choice.name_ko || choice.name) : (choice.name_en || choice.name)}: {locale === 'ko' ? (option.name_ko || option.name) : (option.name_en || option.name)}
                                      </option>
                                    ))
                                  })}
                                </select>
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

                      {/* 액션 버튼 */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {item.itemType === 'product' && hasOptions && (
                            <button
                              onClick={() => handleAddOptionItem(item)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title={locale === 'ko' ? '통합 옵션 추가' : 'Add Integrated Option'}
                            >
                              <Package size={14} className="text-gray-400" />
                            </button>
                          )}
                          {index === invoiceItems.length - 1 && (
                            <>
                              <button
                                onClick={handleAddInvoiceItem}
                                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                title={locale === 'ko' ? '상품 항목 추가' : 'Add Product Item'}
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                onClick={handleAddStandaloneOptionItem}
                                className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                                title={locale === 'ko' ? '통합 옵션만 추가' : 'Add Option Only'}
                              >
                                <Plus size={14} className="text-purple-600" />
                              </button>
                            </>
                          )}
                          {invoiceItems.length > 1 && (
                            <button
                              onClick={() => handleRemoveInvoiceItem(item.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title={locale === 'ko' ? '삭제' : 'Remove'}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                    {locale === 'ko' ? '소계' : 'Subtotal'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {formatUSD(subtotal)}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
                {/* 세금 */}
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm text-gray-700">
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
                  <td colSpan={1} className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {applyTax && taxPercent > 0 && (
                      <span>{formatUSD(tax)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
                {/* 할인 */}
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={applyDiscount}
                        onChange={(e) => {
                          setApplyDiscount(e.target.checked)
                          if (!e.target.checked) {
                            setDiscountPercent(0)
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
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                    )}
                  </td>
                  <td colSpan={1} className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-sm font-medium text-red-600 text-right">
                    {applyDiscount && discountPercent > 0 && (
                      <span>-{formatUSD((subtotal + tax) * (discountPercent / 100))}</span>
                    )}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
                {/* 신용카드 처리 수수료 */}
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm text-gray-700">
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
                  <td colSpan={3} className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {applyProcessingFee && (
                      <span>{formatUSD(total - (subtotal + tax - (applyDiscount ? (subtotal + tax) * (discountPercent / 100) : 0)))}</span>
                    )}
                  </td>
                  <td></td>
                </tr>
                <tr className="bg-blue-50">
                  <td colSpan={5} className="px-4 py-3 text-lg font-bold text-gray-900 text-right">
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
                  <td></td>
                </tr>
                {/* 환율 추가 버튼 */}
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
                  <td colSpan={4} className="px-4 py-2">
                    <button
                      onClick={() => setShowKRW(!showKRW)}
                      className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                    >
                      <span>{showKRW ? (locale === 'ko' ? '환율 숨기기' : 'Hide Exchange Rate') : (locale === 'ko' ? '환율 추가' : 'Show Exchange Rate')}</span>
                    </button>
                  </td>
                </tr>
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
                {locale === 'ko' ? '저장됨' : 'Saved'}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {locale === 'ko' ? '취소' : 'Cancel'}
            </button>
            <button
              onClick={handleSaveInvoice}
              disabled={saving || !invoiceItems.some(item => 
                (item.itemType === 'product' && item.productId) || 
                (item.itemType === 'option' && item.optionId)
              )}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (locale === 'ko' ? '저장 중...' : 'Saving...') : (locale === 'ko' ? '저장' : 'Save')}
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
