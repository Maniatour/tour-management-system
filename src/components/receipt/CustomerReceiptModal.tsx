'use client'

import React, { useEffect, useState } from 'react'
import { X, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type ReceiptData = {
  reservation: {
    id: string
    tour_date: string
    tour_time: string | null
    adults: number
    child: number
    infant: number
    total_people: number
    status?: string | null
    created_at?: string | null
    pickup_hotel?: string | null
  }
  customer: { name: string; language?: string | null; email?: string | null; phone?: string | null }
  product: { name_ko: string | null; name_en: string | null; customer_name_ko: string | null; customer_name_en: string | null }
  pickupHotelName: string
  channelName: string
  reservationOptions: Array<{ option_id: string; ea: number; price: number; total_price: number; option_name: string }>
  pricing: {
    adult_product_price: number
    product_price_total: number
    subtotal: number
    total_price: number
    not_included_price?: number
    balance_amount: number
    deposit_amount: number
    coupon_discount: number
    additional_discount: number
    option_total: number
    choices_total: number
    additional_cost: number
    tax: number
    card_fee: number
    prepayment_cost: number
    prepayment_tip: number
    currency?: string | null
  }
}

const labels = {
  ko: {
    title: '영수증',
    reservationSummary: '예약 요약',
    guest: '고객',
    email: '이메일',
    tel: '전화',
    hotel: '호텔',
    receiptId: 'Receipt id',
    status: '상태',
    channel: '채널',
    tourDate: '투어 날짜',
    date: '날짜',
    description: '설명',
    unitPrice: '단가',
    quantity: '수량',
    price: '합계',
    subTotal: '소계',
    paidAmount: '입금액',
    deposit: '선입금',
    balance: '잔액',
    discount: '할인',
    couponDiscount: '쿠폰 할인',
    additionalDiscount: '추가 할인',
    tax: '세금',
    additionalCost: '추가 비용',
    cardFee: '카드 수수료',
    prepaymentCost: '선결제 지출',
    prepaymentTip: '선결제 팁',
    productTotal: '상품 합계',
    grandTotal: '총 결제 금액',
    tipSuggest: '팁 안내',
    tipSectionTitle: '팁 안내',
    tipAboutUS: '미국에서는 팁이 좋은 서비스에 대한 감사의 표시로 널리 통용됩니다. 투어 가이드에게 주는 팁은 투어 요금에 포함되어 있지 않으며, 만족도에 따라 자유롭게 결정하시면 됩니다.',
    tipNotIncluded: '많은 투어 가이드들이 팁을 소득의 중요한 부분으로 의지하고 있습니다. 주신 팁은 예약 및 투어 준비에 참여한 모든 팀원들에게 나누어 전달됩니다.',
    tipSuggestedPerPerson: '1인당 참고 팁 (투어 요금 대비):',
    tipBasic: '10% (기본 서비스)',
    tipStandard: '15% (일반 서비스)',
    tipExcellent: '20% (우수 서비스)',
    tipThankYou: '가이드에게 따뜻한 격려와 존중으로 응원해 주셔서 감사합니다.',
    tip15: '15%',
    tip18: '18%',
    tip20: '20%',
    print: '인쇄',
    close: '닫기',
    selectCustomers: '인쇄할 고객 선택',
    selectAll: '전체 선택',
    deselectAll: '전체 해제',
    adult: '성인',
    child: '아동',
    infant: '유아',
  },
  en: {
    title: 'Receipt',
    reservationSummary: 'Reservation Summary',
    guest: 'Guest',
    email: 'E-mail',
    tel: 'Tel',
    hotel: 'Hotel',
    receiptId: 'Receipt id',
    status: 'Status',
    channel: 'Channel',
    tourDate: 'Tour Date',
    date: 'Date',
    description: 'Description',
    unitPrice: 'Unit Price',
    quantity: 'Quantity',
    price: 'Price',
    subTotal: 'Sub Total',
    paidAmount: 'Paid Amount',
    deposit: 'Deposit',
    balance: 'Balance',
    discount: 'Discount',
    couponDiscount: 'Coupon discount',
    additionalDiscount: 'Additional discount',
    tax: 'Tax',
    additionalCost: 'Additional cost',
    cardFee: 'Card fee',
    prepaymentCost: 'Prepayment',
    prepaymentTip: 'Prepayment tip',
    productTotal: 'Product Total',
    grandTotal: 'Grand Total',
    tipSuggest: 'Tip guide',
    tipSectionTitle: 'Suggested Tips',
    tipAboutUS: 'In the U.S., tipping is a customary way to show appreciation for good service. Tour guide gratuity is not included in the tour price and is voluntary, based on your satisfaction.',
    tipNotIncluded: 'Please note: Many tour guides rely on tips as a significant part of their income. Your tip directly supports their livelihood and hard work, and is shared among all team members who helped coordinate your reservation and tour.',
    tipSuggestedPerPerson: 'Suggested tip per person (based on your tour total):',
    tipBasic: '10% — Basic Service',
    tipStandard: '15% — Standard Service',
    tipExcellent: '20% — Excellent Service',
    tipThankYou: 'Thank you for supporting your guide with kindness and respect.',
    tip15: '15%',
    tip18: '18%',
    tip20: '20%',
    print: 'Print',
    close: 'Close',
    selectCustomers: 'Select customers to print',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    adult: 'Adult',
    child: 'Child',
    infant: 'Infant',
  },
}

const COMPANY = {
  name: 'LAS VEGAS MANIA TOUR',
  /** 회사 로고 URL. 설정하지 않으면 /favicon.png 사용. public 폴더 파일은 예: /company-logo.png */
  logoUrl: typeof process !== 'undefined' && process.env.NEXT_PUBLIC_COMPANY_LOGO_URL
    ? process.env.NEXT_PUBLIC_COMPANY_LOGO_URL
    : '/favicon.png',
  address: ['3351 S Highland Dr #202', 'Las Vegas, NV 89109', 'United States'],
  email: 'vegasmaniatour@gmail.com',
  website: 'www.maniatour.com',
  phone: '1-702-929-8025 / 1-702-444-5531',
  lic: 'Lic #: 2002495.056-121',
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') return parseFloat(v) || 0
  return Number(v) || 0
}

/** 고객 언어가 한국어이면 true (한국어가 아니면 영수증은 영어로 표시) */
function isCustomerKorean(lang: string | null | undefined): boolean {
  if (!lang) return false
  const l = lang.toString().toLowerCase()
  return l === 'ko' || l.startsWith('ko-') || l === 'korean' || l === 'kr'
}

function formatMoney(amount: number, currency: string): string {
  if (currency === 'KRW') return `₩${Math.round(amount).toLocaleString()}`
  return `$${amount.toFixed(2)}`
}

/** 예약 수정 - 가격 계산의 "고객 총 결제 금액"과 동일한 계산 */
function getCustomerTotalPayment(
  pricing: ReceiptData['pricing'],
  totalPeople: number
): number {
  const discounted = pricing.product_price_total - pricing.coupon_discount - pricing.additional_discount
  const notIncluded = (pricing.not_included_price ?? 0) * totalPeople
  return (
    discounted +
    (pricing.option_total ?? 0) +
    (pricing.choices_total ?? 0) +
    notIncluded +
    (pricing.additional_cost ?? 0) +
    (pricing.tax ?? 0) +
    (pricing.card_fee ?? 0) +
    (pricing.prepayment_cost ?? 0) +
    (pricing.prepayment_tip ?? 0)
  )
}

interface CustomerReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  /** 여러 예약 ID면 일괄 모드 (투어 상세에서 사용) */
  reservationIds?: string[]
}

export default function CustomerReceiptModal({
  isOpen,
  onClose,
  reservationId,
  reservationIds,
}: CustomerReceiptModalProps) {
  const [data, setData] = useState<ReceiptData | null>(null)
  const [batchData, setBatchData] = useState<ReceiptData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 배치 모드에서 인쇄할 예약 ID 집합 (기본: 전체) */
  const [selectedReservationIds, setSelectedReservationIds] = useState<Set<string>>(new Set())
  const isBatch = Boolean(reservationIds && reservationIds.length > 0)
  const ids = isBatch ? reservationIds! : [reservationId]

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    if (ids.length === 0) {
      setLoading(false)
      setData(null)
      setBatchData([])
      return
    }
    const load = async () => {
      setLoading(true)
      try {
        const results: ReceiptData[] = []
        for (const id of ids) {
          const { data: rez, error: rezErr } = await supabase
            .from('reservations')
            .select('id, tour_date, tour_time, adults, child, infant, total_people, customer_id, product_id, status, created_at, pickup_hotel, channel_id')
            .eq('id', id)
            .single()
          if (rezErr || !rez) {
            setError('Reservation not found')
            setLoading(false)
            return
          }
          const customerId = (rez as any).customer_id
          const productId = (rez as any).product_id
          const pickupHotelId = (rez as any).pickup_hotel
          const channelId = (rez as any).channel_id
          const [{ data: customer }, { data: product }, { data: pricing }, { data: pickupHotel }, { data: channel }] = await Promise.all([
            supabase.from('customers').select('name, language, email, phone').eq('id', customerId).single(),
            supabase.from('products').select('name_ko, name_en, customer_name_ko, customer_name_en').eq('id', productId).single(),
            supabase
              .from('reservation_pricing')
              .select('adult_product_price, product_price_total, subtotal, total_price, not_included_price, balance_amount, deposit_amount, coupon_discount, additional_discount, option_total, choices_total, additional_cost, tax, card_fee, prepayment_cost, prepayment_tip')
              .eq('reservation_id', id)
              .maybeSingle(),
            pickupHotelId
              ? supabase.from('pickup_hotels').select('hotel').eq('id', pickupHotelId).single()
              : Promise.resolve({ data: null }),
            channelId
              ? supabase.from('channels').select('name').eq('id', channelId).single()
              : Promise.resolve({ data: null }),
          ])
          const pickupHotelName = pickupHotel?.hotel || ''
          const channelName = (channel as any)?.name || ''
          // reservation_options (status 필터 없이 모두 조회) + option names
          const { data: optsRows, error: optsErr } = await supabase
            .from('reservation_options')
            .select('option_id, ea, price, total_price')
            .eq('reservation_id', id)
          if (optsErr) console.warn('reservation_options 조회 오류:', optsErr)
          const optionIds = [...new Set((optsRows || []).map((o: any) => o.option_id).filter(Boolean))]
          type OptionDisplay = { name: string; name_ko?: string | null; name_en?: string | null }
          let optionsMap: Record<string, OptionDisplay> = {}
          if (optionIds.length > 0) {
            const { data: opts, error: optNamesErr } = await supabase.from('options').select('id, name, name_ko, name_en').in('id', optionIds)
            if (optNamesErr) console.warn('options 조회 오류:', optNamesErr)
            ;(opts || []).forEach((o: any) => {
              optionsMap[o.id] = { name: o.name || '', name_ko: o.name_ko ?? null, name_en: o.name_en ?? null }
            })
            const missingIds = optionIds.filter((oid: string) => !optionsMap[oid])
            if (missingIds.length > 0) {
              const { data: poOpts } = await supabase.from('product_options').select('id, name').in('id', missingIds)
              ;(poOpts || []).forEach((o: any) => {
                optionsMap[o.id] = { name: o.name || optionsMap[o.id]?.name || '' }
              })
            }
          }
          const isEnCustomer = !isCustomerKorean(customer?.language)
          const receiptOptionLabelEn: Record<string, string> = {
            '비거주자 비용': 'Non-resident fee',
            '비거주자 (패스 보유)': 'Non-resident (with pass)',
          }
          const getOptionDisplayName = (disp: OptionDisplay) => {
            const ko = (disp.name_ko && disp.name_ko.trim()) || ''
            const en = (disp.name_en && disp.name_en.trim()) || ''
            const name = disp.name || ''
            if (isEnCustomer) {
              if (en) return en
              const fallbackEn = receiptOptionLabelEn[ko] || receiptOptionLabelEn[name]
              if (fallbackEn) return fallbackEn
              return ko || name
            }
            return ko || en || name
          }
          const reservationOptions = (optsRows || []).map((o: any) => {
            const disp = optionsMap[o.option_id] || { name: '' }
            const option_name = getOptionDisplayName(disp)
            return {
              option_id: o.option_id,
              ea: Number(o.ea) || 0,
              price: toNum(o.price),
              total_price: toNum(o.total_price),
              option_name: option_name || o.option_id || '',
            }
          })
          const lang = (customer?.language || 'ko').toString().toLowerCase()
          const isEn = lang === 'en' || lang === 'english' || lang === 'en-us'
          const productName = isEn
            ? (product?.customer_name_en || product?.name_en || product?.customer_name_ko || product?.name_ko || '')
            : (product?.customer_name_ko || product?.name_ko || product?.customer_name_en || product?.name_en || '')
          results.push({
            reservation: {
              id: (rez as any).id,
              tour_date: (rez as any).tour_date || '',
              tour_time: (rez as any).tour_time,
              adults: (rez as any).adults ?? 0,
              child: (rez as any).child ?? 0,
              infant: (rez as any).infant ?? 0,
              total_people: (rez as any).total_people ?? 0,
              status: (rez as any).status,
              created_at: (rez as any).created_at,
              pickup_hotel: (rez as any).pickup_hotel,
            },
            customer: {
              name: customer?.name || '',
              language: customer?.language,
              email: (customer as any)?.email,
              phone: (customer as any)?.phone,
            },
            product: {
              name_ko: product?.name_ko || null,
              name_en: product?.name_en || null,
              customer_name_ko: (product as any)?.customer_name_ko || null,
              customer_name_en: (product as any)?.customer_name_en || null,
            },
            pickupHotelName,
            channelName,
            reservationOptions,
            pricing: {
              adult_product_price: toNum((pricing as any)?.adult_product_price),
              product_price_total: toNum(pricing?.product_price_total),
              subtotal: toNum(pricing?.subtotal),
              total_price: toNum(pricing?.total_price),
              not_included_price: toNum(pricing?.not_included_price),
              balance_amount: toNum(pricing?.balance_amount),
              deposit_amount: toNum(pricing?.deposit_amount),
              coupon_discount: toNum((pricing as any)?.coupon_discount),
              additional_discount: toNum((pricing as any)?.additional_discount),
              option_total: toNum((pricing as any)?.option_total),
              choices_total: toNum((pricing as any)?.choices_total),
              additional_cost: toNum((pricing as any)?.additional_cost),
              tax: toNum((pricing as any)?.tax),
              card_fee: toNum((pricing as any)?.card_fee),
              prepayment_cost: toNum((pricing as any)?.prepayment_cost),
              prepayment_tip: toNum((pricing as any)?.prepayment_tip),
              currency: (pricing as any)?.currency || 'USD',
            },
          })
        }
        if (results.length === 1) setData(results[0])
        else setBatchData(results)
        if (results.length > 0) setSelectedReservationIds(new Set(results.map((r) => r.reservation.id)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen, reservationId, isBatch, ids.join(',')])

  const handlePrint = (singleData?: ReceiptData) => {
    const isTwoPerPage = !singleData && isBatch
    const target = document.getElementById(singleData ? `receipt-${singleData.reservation.id}` : 'receipt-batch-print')
    if (!target) return
    const clone = target.cloneNode(true) as HTMLElement
    if (isTwoPerPage) {
      clone.classList.add('receipt-print-two-per-page')
      clone.style.width = '279mm'
      clone.style.maxWidth = '279mm'
      clone.style.padding = '0'
      clone.style.background = 'white'
      clone.style.border = 'none'
      clone.style.boxShadow = 'none'
      clone.style.display = 'block'
      const cells: HTMLElement[] = []
      clone.querySelectorAll('.receipt-letter').forEach((el) => {
        const letter = el as HTMLElement
        const wrapper = document.createElement('div')
        wrapper.className = 'receipt-two-up-cell'
        letter.style.border = 'none'
        letter.style.boxShadow = 'none'
        letter.style.width = '100%'
        letter.style.maxWidth = '100%'
        letter.style.minHeight = 'auto'
        letter.parentNode?.insertBefore(wrapper, letter)
        wrapper.appendChild(letter)
        cells.push(wrapper)
      })
      clone.innerHTML = ''
      for (let i = 0; i < cells.length; i += 2) {
        const row = document.createElement('div')
        row.className = 'receipt-print-row'
        row.appendChild(cells[i])
        if (cells[i + 1]) row.appendChild(cells[i + 1])
        clone.appendChild(row)
      }
      clone.className = 'receipt-print-two-per-page'
      clone.removeAttribute('id')
    } else {
      clone.style.width = '216mm'
      clone.style.maxWidth = '216mm'
      clone.style.padding = '10mm'
      clone.style.background = 'white'
      clone.style.border = 'none'
      clone.style.boxShadow = 'none'
      clone.querySelectorAll('.receipt-letter').forEach((el) => {
        const elHtml = el as HTMLElement
        elHtml.style.width = '216mm'
        elHtml.style.maxWidth = '216mm'
        elHtml.style.border = 'none'
        elHtml.style.boxShadow = 'none'
      })
    }

    const iframe = document.createElement('iframe')
    iframe.title = 'Receipt Print'
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;border:none;overflow:hidden;'
    document.body.appendChild(iframe)
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      document.body.removeChild(iframe)
      return
    }

    const printStyles = isTwoPerPage
      ? `
      *, *::before, *::after { box-sizing: border-box; }
      html { font-size: 12px !important; min-height: 0 !important; height: auto !important; }
      html, body { margin: 0 !important; padding: 0 !important; width: 279mm !important; background: white !important; min-height: 0 !important; height: auto !important; }
      #receipt-print-root { display: block !important; min-height: 0 !important; height: auto !important; margin: 0 !important; padding: 2mm 3mm !important; }
      .receipt-print-two-per-page { display: block !important; width: 100% !important; max-width: 279mm !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; }
      .receipt-print-two-per-page > * { margin: 0 !important; padding: 0 !important; }
      .receipt-print-row { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 6mm !important; width: 100% !important; height: 198mm !important; max-height: 198mm !important; margin: 0 !important; padding: 0 !important; page-break-inside: avoid !important; }
      .receipt-print-row:not(:first-child) { page-break-before: always !important; break-before: page !important; margin-top: 0 !important; }
      .receipt-two-up-cell { height: 198mm !important; max-height: 198mm !important; min-height: 198mm !important; page-break-inside: avoid !important; display: flex !important; flex-direction: column !important; overflow: hidden !important; }
      .receipt-two-up-cell .receipt-letter { width: 100% !important; max-width: 100% !important; min-height: auto !important; flex: 1 1 auto !important; max-height: 198mm !important; break-inside: avoid !important; page-break-inside: avoid !important; border: none !important; box-shadow: none !important; padding: 2mm !important; overflow: hidden !important; font-size: 1rem !important; }
      .receipt-two-up-cell .receipt-letter h2 { font-size: 1.15rem !important; }
      .receipt-two-up-cell .receipt-letter h3 { font-size: 1.1rem !important; }
      .receipt-two-up-cell .receipt-letter h4 { font-size: 1.05rem !important; }
      .receipt-two-up-cell .receipt-letter table { font-size: 1rem !important; }
      .receipt-two-up-cell .receipt-letter .text-sm { font-size: 0.95rem !important; }
      .receipt-letter .receipt-tips-section { margin-top: 2mm !important; padding-top: 2mm !important; padding-bottom: 0 !important; font-size: 1rem !important; line-height: 1.45 !important; }
      .receipt-letter .receipt-tips-section p { margin: 0 0 1.5mm 0 !important; line-height: 1.45 !important; }
      .receipt-letter .receipt-tips-section .receipt-tips-thankyou { margin-top: 1em !important; margin-bottom: 0 !important; text-align: center !important; }
      .receipt-letter .receipt-tips-section ul { margin: 0 0 1mm 0 !important; padding-left: 4mm !important; line-height: 1.45 !important; }
      .receipt-letter .receipt-tips-section li { margin: 0 0 1.2mm 0 !important; line-height: 1.45 !important; }
      .receipt-letter .receipt-summary-email { white-space: nowrap !important; min-width: 0 !important; overflow: visible !important; }
      .receipt-letter .grid > div.min-w-0 { min-width: 0 !important; }
      .receipt-letter .receipt-balance-amount { color: #dc2626 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { size: 279mm 216mm; margin: 4mm 3mm !important; }
      @media print {
        html, body { min-height: 0 !important; height: auto !important; overflow: visible !important; }
        .receipt-print-two-per-page { min-height: 0 !important; }
      }
    `
      : `
      *, *::before, *::after { box-sizing: border-box; }
      html { font-size: 10px !important; }
      html, body { margin: 0; padding: 0; width: 216mm; background: white !important; }
      body { padding: 10mm; }
      .receipt-letter { border: none !important; box-shadow: none !important; font-size: 1rem !important; }
      .receipt-letter { page-break-after: always; page-break-inside: avoid; }
      .receipt-letter:last-child { page-break-after: auto; }
      .receipt-letter .receipt-summary-email { white-space: nowrap !important; min-width: 0 !important; overflow: visible !important; }
      .receipt-letter .grid > div.min-w-0 { min-width: 0 !important; }
      .receipt-letter .receipt-balance-amount { color: #dc2626 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { size: 216mm 279mm; margin: 10mm; }
    `
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      .map((l) => l.href)
      .filter(Boolean)
    iframeDoc.open()
    const bodyContent = isTwoPerPage
      ? `<div id="receipt-print-root" style="min-height:0!important;height:auto!important;margin:0!important;padding:2mm 3mm!important">${clone.outerHTML}</div>`
      : clone.outerHTML
    const bodyAttrs = isTwoPerPage
      ? ' class="receipt-print-two-up" style="min-height:0!important;height:auto!important;margin:0!important;padding:0!important"'
      : ''
    iframeDoc.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>
      ${links.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}
      <style>${printStyles}</style>
      </head><body${bodyAttrs}>${bodyContent}</body></html>`)
    iframeDoc.close()

    const printWin = iframe.contentWindow
    if (printWin) {
      printWin.onload = () => {
        printWin.focus()
        setTimeout(() => {
          printWin.print()
          document.body.removeChild(iframe)
        }, 250)
      }
    } else {
      document.body.removeChild(iframe)
    }
  }

  if (!isOpen) return null

  const list = isBatch ? batchData : data ? [data] : []
  const listToShow = isBatch && list.length > 0
    ? list.filter((d) => selectedReservationIds.has(d.reservation.id))
    : list
  const headerLabel = list.length > 0
    ? (isCustomerKorean(list[0].customer.language) ? labels.ko : labels.en)
    : labels.en

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* Letter(216mm) 수용을 위해 모달 폭 확보, 가로 스크롤 없음 */}
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[min(95vw,216mm)] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {headerLabel.title}
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-white min-w-0 flex flex-col items-center">
          {loading && <p className="text-gray-500 py-8">로딩 중...</p>}
          {error && <p className="text-red-600 py-8">{error}</p>}
          {!loading && !error && list.length === 0 && <p className="text-gray-500 py-8">데이터 없음</p>}
          {!loading && !error && list.length > 0 && (
            <div className="w-full flex flex-col items-center">
              {isBatch && list.length > 0 && (
                <div className="w-full mb-4 space-y-2">
                  <span className="text-sm font-medium text-gray-700">{labels.ko.selectCustomers}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelectedReservationIds(new Set(list.map((d) => d.reservation.id)))} className="text-xs text-blue-600 hover:underline">
                      {labels.ko.selectAll}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setSelectedReservationIds(new Set())} className="text-xs text-gray-500 hover:underline">
                      {labels.ko.deselectAll}
                    </button>
                  </div>
                  <div className="max-h-28 overflow-y-auto border border-gray-200 rounded p-2 space-y-1">
                    {list.map((d) => (
                      <label key={d.reservation.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                        <input
                          type="checkbox"
                          checked={selectedReservationIds.has(d.reservation.id)}
                          onChange={(e) => {
                            const next = new Set(selectedReservationIds)
                            if (e.target.checked) next.add(d.reservation.id)
                            else next.delete(d.reservation.id)
                            setSelectedReservationIds(next)
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="text-sm truncate">{d.customer.name || '—'}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {selectedReservationIds.size > 0 ? `${selectedReservationIds.size}장 인쇄` : '인쇄할 고객을 선택하세요'}
                  </p>
                </div>
              )}
            <div id="receipt-batch-print" className="space-y-6 w-full flex flex-col items-center">
              {listToShow.map((d) => {
                const isEn = !isCustomerKorean(d.customer.language)
                const L = isEn ? labels.en : labels.ko
                const cur = d.pricing.currency || 'USD'
                const productName = isEn
                  ? (d.product.customer_name_en || d.product.name_en || d.product.customer_name_ko || d.product.name_ko || '')
                  : (d.product.customer_name_ko || d.product.name_ko || d.product.customer_name_en || d.product.name_en || '')
                const customerTotalPayment = getCustomerTotalPayment(d.pricing, d.reservation.total_people ?? 0)
                const totalPeople = Math.max(1, d.reservation.total_people ?? 1)
                const notIncludedPerPerson = d.pricing.not_included_price ?? 0
                const unitPriceWithNotIncluded = d.pricing.adult_product_price + notIncludedPerPerson
                const productRowTotal = d.pricing.product_price_total + notIncludedPerPerson * totalPeople
                const tip10PerPerson = (customerTotalPayment * 0.10) / totalPeople
                const tip15PerPerson = (customerTotalPayment * 0.15) / totalPeople
                const tip20PerPerson = (customerTotalPayment * 0.20) / totalPeople
                const tip10Total = customerTotalPayment * 0.10
                const tip15Total = customerTotalPayment * 0.15
                const tip20Total = customerTotalPayment * 0.20
                const statusLabel = (d.reservation.status || 'pending').toLowerCase()

                return (
                  <div
                    key={d.reservation.id}
                    id={`receipt-${d.reservation.id}`}
                    className="receipt-letter bg-white p-6 w-full max-w-[216mm] box-border"
                    style={{ minHeight: '279mm' }}
                  >
                    {/* 회사 헤더 */}
                    <div className="border-b border-gray-200 pb-3 mb-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-2">
                          <img src={COMPANY.logoUrl} alt="" className="w-8 h-8 shrink-0 object-contain" />
                          <div>
                            <h2 className="text-lg font-bold text-gray-900">{COMPANY.name}</h2>
                            <p className="text-sm text-gray-600 mt-1">
                              {COMPANY.address[0]}
                              <br />
                              {COMPANY.address.slice(1).join(', ')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-600">
                          <p>{COMPANY.lic}</p>
                          <p>{COMPANY.email}</p>
                          <p className="text-blue-600 underline">{COMPANY.website}</p>
                          <p>{COMPANY.phone}</p>
                        </div>
                      </div>
                    </div>

                    {/* 영수증 제목 */}
                    <h3 className="text-center font-bold text-gray-900 py-2 mb-3 border-b border-gray-100 text-lg uppercase tracking-wide">
                      {L.title}
                    </h3>

                    <div className="mb-4">
                      <div className="grid grid-cols-[2fr_1fr] gap-x-6 gap-y-1 text-sm">
                        <div className="min-w-0">
                          <p><span className="text-gray-600">{L.guest}:</span> {d.customer.name}</p>
                          <p className="receipt-summary-email" title={d.customer.email || undefined}><span className="text-gray-600">{L.email}:</span> {d.customer.email || '—'}</p>
                          <p><span className="text-gray-600">{L.tel}:</span> {d.customer.phone || '—'}</p>
                          <p><span className="text-gray-600">{L.hotel}:</span> {d.pickupHotelName || '—'}</p>
                        </div>
                        <div className="text-right">
                          <p><span className="text-gray-600">{L.receiptId}:</span> {d.reservation.id}</p>
                          <p><span className="text-gray-600">{L.status}:</span> {statusLabel}</p>
                          <p><span className="text-gray-600">{L.channel}:</span> {d.channelName || '—'}</p>
                          <p><span className="text-gray-600">{L.tourDate}:</span> {d.reservation.tour_date}</p>
                        </div>
                      </div>
                    </div>

                    {/* 항목 테이블: DATE | DESCRIPTION | UNIT PRICE | QUANTITY | PRICE */}
                    <div className="border-t border-blue-200 pt-2">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-200">
                            <th className="px-2 py-2 text-left text-sm font-medium text-gray-700 uppercase whitespace-nowrap min-w-[7rem] w-[7rem]">{L.date}</th>
                            <th className="px-2 py-2 text-left text-sm font-medium text-gray-700 uppercase">{L.description}</th>
                            <th className="px-2 py-2 text-right text-sm font-medium text-gray-700 uppercase whitespace-nowrap min-w-[5.5rem] w-[5.5rem]">{L.unitPrice}</th>
                            <th className="px-2 py-2 text-right text-sm font-medium text-gray-700 uppercase">{L.quantity}</th>
                            <th className="px-2 py-2 text-right text-sm font-medium text-gray-700 uppercase">{L.price}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* 상품 */}
                          <tr className="border-b border-gray-100">
                            <td className="px-2 py-2 text-gray-900 whitespace-nowrap min-w-[7rem] w-[7rem]">{d.reservation.tour_date}</td>
                            <td className="px-2 py-2 text-gray-900 break-words">{productName}</td>
                            <td className="px-2 py-2 text-right text-gray-900 whitespace-nowrap min-w-[5.5rem] w-[5.5rem]">{formatMoney(unitPriceWithNotIncluded, cur)}</td>
                            <td className="px-2 py-2 text-right text-gray-900">{d.reservation.total_people}</td>
                            <td className="px-2 py-2 text-right text-gray-900">{formatMoney(productRowTotal, cur)}</td>
                          </tr>
                          {/* 할인 (상품 바로 아래) */}
                          {(d.pricing.coupon_discount + d.pricing.additional_discount) > 0 && (
                            <tr className="border-b border-gray-100 bg-red-50/30">
                              <td className="px-2 py-2" />
                              <td className="px-2 py-2 text-gray-900"><span className="text-gray-500">└ </span>{L.discount}</td>
                              <td className="px-2 py-2 text-right text-red-600 whitespace-nowrap" colSpan={3}>
                                -{formatMoney(d.pricing.coupon_discount + d.pricing.additional_discount, cur)}
                              </td>
                            </tr>
                          )}
                          {/* Product Total (상품+불포함 기준 합계 - 할인) */}
                          <tr className="border-b border-gray-200 bg-gray-50/50">
                            <td className="px-2 py-2" />
                            <td className="px-2 py-2 font-medium text-gray-900">{L.productTotal}</td>
                            <td className="px-2 py-2 text-right font-medium text-gray-900 whitespace-nowrap" colSpan={3}>
                              {formatMoney(productRowTotal - d.pricing.coupon_discount - d.pricing.additional_discount, cur)}
                            </td>
                          </tr>
                          {/* 옵션 */}
                          {(d.reservationOptions || []).map((opt, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                              <td className="px-2 py-2 text-gray-900 whitespace-nowrap min-w-[7rem] w-[7rem]">{d.reservation.tour_date}</td>
                              <td className="px-2 py-2 text-gray-900 break-words"><span className="text-gray-500">└ </span>{opt.option_name}</td>
                              <td className="px-2 py-2 text-right text-gray-900 whitespace-nowrap min-w-[5.5rem] w-[5.5rem]">{formatMoney(opt.price, cur)}</td>
                              <td className="px-2 py-2 text-right text-gray-900">{opt.ea}</td>
                              <td className="px-2 py-2 text-right text-gray-900">{formatMoney(opt.total_price, cur)}</td>
                            </tr>
                          ))}
                          {/* 기타 비용 (세금, 추가비용 등) */}
                          {d.pricing.tax > 0 && (
                            <tr className="border-b border-gray-100">
                              <td className="px-2 py-2" />
                              <td className="px-2 py-2 text-gray-900"><span className="text-gray-500">└ </span>{L.tax}</td>
                              <td className="px-2 py-2 text-right text-gray-900 whitespace-nowrap min-w-[5.5rem] w-[5.5rem]" colSpan={3}>
                                {formatMoney(d.pricing.tax, cur)}
                              </td>
                            </tr>
                          )}
                          {d.pricing.additional_cost > 0 && (
                            <tr className="border-b border-gray-100">
                              <td className="px-2 py-2" />
                              <td className="px-2 py-2 text-gray-900"><span className="text-gray-500">└ </span>{L.additionalCost}</td>
                              <td className="px-2 py-2 text-right text-gray-900 whitespace-nowrap min-w-[5.5rem] w-[5.5rem]" colSpan={3}>
                                {formatMoney(d.pricing.additional_cost, cur)}
                              </td>
                            </tr>
                          )}
                          {d.pricing.card_fee > 0 && (
                            <tr className="border-b border-gray-100">
                              <td className="px-2 py-2" />
                              <td className="px-2 py-2 text-gray-900"><span className="text-gray-500">└ </span>{L.cardFee}</td>
                              <td className="px-2 py-2 text-right text-gray-900 whitespace-nowrap min-w-[5.5rem] w-[5.5rem]" colSpan={3}>
                                {formatMoney(d.pricing.card_fee, cur)}
                              </td>
                            </tr>
                          )}
                          {d.pricing.prepayment_cost > 0 && (
                            <tr className="border-b border-gray-100">
                              <td className="px-2 py-2" />
                              <td className="px-2 py-2 text-gray-900"><span className="text-gray-500">└ </span>{L.prepaymentCost}</td>
                              <td className="px-2 py-2 text-right text-gray-900 whitespace-nowrap min-w-[5.5rem] w-[5.5rem]" colSpan={3}>
                                {formatMoney(d.pricing.prepayment_cost, cur)}
                              </td>
                            </tr>
                          )}
                          {d.pricing.prepayment_tip > 0 && (
                            <tr className="border-b border-gray-100">
                              <td className="px-2 py-2" />
                              <td className="px-2 py-2 text-gray-900"><span className="text-gray-500">└ </span>{L.prepaymentTip}</td>
                              <td className="px-2 py-2 text-right text-gray-900 whitespace-nowrap min-w-[5.5rem] w-[5.5rem]" colSpan={3}>
                                {formatMoney(d.pricing.prepayment_tip, cur)}
                              </td>
                            </tr>
                          )}
                          {/* Grand Total */}
                          <tr className="border-t-2 border-gray-300 bg-gray-100/80">
                            <td className="px-2 py-3" />
                            <td className="px-2 py-3 font-bold text-gray-900">{L.grandTotal}</td>
                            <td className="px-2 py-3 text-right font-bold text-gray-900 whitespace-nowrap" colSpan={3}>
                              {formatMoney(customerTotalPayment, cur)}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="mt-4 flex flex-col items-end gap-1 text-sm">
                        <p className="flex justify-end gap-4 w-full max-w-[220px]"><span className="text-gray-600">{L.paidAmount}:</span> <span>{formatMoney(d.pricing.deposit_amount, cur)}</span></p>
                        <p className="flex justify-end gap-4 w-full max-w-[220px]"><span className="text-gray-600">{L.balance}:</span> <span className="receipt-balance-amount font-medium text-red-600">{formatMoney(d.pricing.balance_amount, cur)}</span></p>
                      </div>
                    </div>

                    <div className="receipt-tips-section mt-6 pt-4 border-t border-gray-200 text-sm space-y-3">
                      <p className="text-sm font-semibold text-gray-800">{L.tipSectionTitle}</p>
                      <p className="receipt-tips-intro text-gray-600 text-sm leading-relaxed">{L.tipAboutUS}</p>
                      <p className="receipt-tips-intro text-gray-600 text-sm leading-relaxed">{L.tipNotIncluded}</p>
                      <p className="text-gray-700 text-sm font-medium mt-2">{L.tipSuggestedPerPerson}</p>
                      <ul className="list-none space-y-1 text-sm text-gray-700">
                        <li>• {L.tipBasic} → {isEn ? <><span className="font-bold">{formatMoney(tip10PerPerson, cur)}</span> per person (<span className="font-bold">{formatMoney(tip10Total, cur)}</span> total)</> : <>1인당 <span className="font-bold">{formatMoney(tip10PerPerson, cur)}</span> (총 <span className="font-bold">{formatMoney(tip10Total, cur)}</span>)</>}</li>
                        <li>• {L.tipStandard} → {isEn ? <><span className="font-bold">{formatMoney(tip15PerPerson, cur)}</span> per person (<span className="font-bold">{formatMoney(tip15Total, cur)}</span> total)</> : <>1인당 <span className="font-bold">{formatMoney(tip15PerPerson, cur)}</span> (총 <span className="font-bold">{formatMoney(tip15Total, cur)}</span>)</>}</li>
                        <li>• {L.tipExcellent} → {isEn ? <><span className="font-bold">{formatMoney(tip20PerPerson, cur)}</span> per person (<span className="font-bold">{formatMoney(tip20Total, cur)}</span> total)</> : <>1인당 <span className="font-bold">{formatMoney(tip20PerPerson, cur)}</span> (총 <span className="font-bold">{formatMoney(tip20Total, cur)}</span>)</>}</li>
                      </ul>
                      <p className="receipt-tips-thankyou text-gray-600 text-sm italic mt-8 mb-0 text-center block">{L.tipThankYou}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            </div>
          )}
        </div>
        {!loading && !error && list.length > 0 && (
          <div className="p-6 border-t flex justify-end gap-2 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={() => (list.length === 1 ? handlePrint(list[0]) : handlePrint())}
              disabled={isBatch && selectedReservationIds.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              {labels.ko.print}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
              {labels.ko.close}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
