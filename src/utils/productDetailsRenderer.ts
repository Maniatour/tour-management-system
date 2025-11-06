/**
 * 상품 세부정보를 HTML로 렌더링하는 유틸리티 함수들
 */

import { markdownToHtml } from '@/components/LightRichEditor'

export interface ProductDetails {
  slogan1?: string
  slogan2?: string
  slogan3?: string
  description?: string
  included?: string
  not_included?: string
  pickup_drop_info?: string
  luggage_info?: string
  tour_operation_info?: string
  preparation_info?: string
  small_group_info?: string
  companion_info?: string
  exclusive_booking_info?: string
  cancellation_policy?: string
  chat_announcement?: string
}

/**
 * 상품 세부정보를 HTML로 렌더링
 */
export function renderProductDetails(details: ProductDetails, locale: 'ko' | 'en' = 'ko'): string {
  if (!details) {
    return `<p style="color: #6b7280; font-style: italic;">${locale === 'ko' ? '상품 세부정보가 없습니다.' : 'No product details available.'}</p>`
  }

  const labels = {
    ko: {
      slogan1: '슬로건 1',
      slogan2: '슬로건 2', 
      slogan3: '슬로건 3',
      description: '상품 설명',
      included: '포함 사항',
      not_included: '불포함 사항',
      pickup_drop_info: '픽업/드롭 정보',
      luggage_info: '수하물 정보',
      tour_operation_info: '투어 운영 정보',
      preparation_info: '준비 사항',
      small_group_info: '소그룹 정보',
      companion_info: '동반자 정보',
      exclusive_booking_info: '독점 예약 정보',
      cancellation_policy: '취소 정책',
      chat_announcement: '채팅 공지사항'
    },
    en: {
      slogan1: 'Slogan 1',
      slogan2: 'Slogan 2',
      slogan3: 'Slogan 3',
      description: 'Product Description',
      included: 'Included',
      not_included: 'Not Included',
      pickup_drop_info: 'Pickup/Drop Information',
      luggage_info: 'Luggage Information',
      tour_operation_info: 'Tour Operation Information',
      preparation_info: 'Preparation Information',
      small_group_info: 'Small Group Information',
      companion_info: 'Companion Information',
      exclusive_booking_info: 'Exclusive Booking Information',
      cancellation_policy: 'Cancellation Policy',
      chat_announcement: 'Chat Announcement'
    }
  }

  const labelSet = labels[locale]
  let html = '<div class="product-details-container" style="max-width: 800px; margin: 0 auto;">'

  // 슬로건들
  if (details.slogan1 || details.slogan2 || details.slogan3) {
    html += '<div class="slogans-section" style="margin-bottom: 24px; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">'
    html += '<h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: bold;">슬로건</h3>'
    if (details.slogan1) html += `<p style="margin: 4px 0; font-size: 16px;">${details.slogan1}</p>`
    if (details.slogan2) html += `<p style="margin: 4px 0; font-size: 16px;">${details.slogan2}</p>`
    if (details.slogan3) html += `<p style="margin: 4px 0; font-size: 16px;">${details.slogan3}</p>`
    html += '</div>'
  }

  // 상품 설명
  if (details.description) {
    const descriptionHtml = markdownToHtml(details.description)
    html += `
      <div class="description-section" style="margin-bottom: 20px; padding: 16px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 16px; font-weight: bold;">${labelSet.description}</h3>
        <div style="margin: 0; color: #374151; line-height: 1.6;">${descriptionHtml}</div>
      </div>
    `
  }

  // 포함/불포함 사항
  if (details.included || details.not_included) {
    html += '<div class="inclusion-section" style="margin-bottom: 20px;">'
    
    if (details.included) {
      html += `
        <div style="margin-bottom: 12px; padding: 12px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
          <h4 style="margin: 0 0 8px 0; color: #15803d; font-size: 14px; font-weight: bold;">✅ ${labelSet.included}</h4>
          <div style="color: #166534; line-height: 1.5;">${details.included}</div>
        </div>
      `
    }
    
    if (details.not_included) {
      html += `
        <div style="padding: 12px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
          <h4 style="margin: 0 0 8px 0; color: #dc2626; font-size: 14px; font-weight: bold;">❌ ${labelSet.not_included}</h4>
          <div style="color: #991b1b; line-height: 1.5;">${details.not_included}</div>
        </div>
      `
    }
    
    html += '</div>'
  }

  // 투어 정보 섹션
  const tourInfoFields = [
    { key: 'pickup_drop_info', label: labelSet.pickup_drop_info, icon: '🚌' },
    { key: 'luggage_info', label: labelSet.luggage_info, icon: '🧳' },
    { key: 'tour_operation_info', label: labelSet.tour_operation_info, icon: '🎯' },
    { key: 'preparation_info', label: labelSet.preparation_info, icon: '📋' }
  ]

  const hasTourInfo = tourInfoFields.some(field => details[field.key as keyof ProductDetails])
  if (hasTourInfo) {
    html += '<div class="tour-info-section" style="margin-bottom: 20px;">'
    html += '<h3 style="margin: 0 0 16px 0; color: #1e40af; font-size: 18px; font-weight: bold; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">투어 정보</h3>'
    
    tourInfoFields.forEach(field => {
      const value = details[field.key as keyof ProductDetails]
      if (value) {
        html += `
          <div style="margin-bottom: 12px; padding: 12px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e5e7eb;">
            <h4 style="margin: 0 0 8px 0; color: #374151; font-size: 14px; font-weight: bold;">${field.icon} ${field.label}</h4>
            <div style="color: #6b7280; line-height: 1.5;">${value}</div>
          </div>
        `
      }
    })
    
    html += '</div>'
  }

  // 그룹 정보 섹션
  const groupInfoFields = [
    { key: 'small_group_info', label: labelSet.small_group_info, icon: '👥' },
    { key: 'companion_info', label: labelSet.companion_info, icon: '🤝' }
  ]

  const hasGroupInfo = groupInfoFields.some(field => details[field.key as keyof ProductDetails])
  if (hasGroupInfo) {
    html += '<div class="group-info-section" style="margin-bottom: 20px;">'
    html += '<h3 style="margin: 0 0 16px 0; color: #059669; font-size: 18px; font-weight: bold; border-bottom: 2px solid #10b981; padding-bottom: 8px;">그룹 정보</h3>'
    
    groupInfoFields.forEach(field => {
      const value = details[field.key as keyof ProductDetails]
      if (value) {
        html += `
          <div style="margin-bottom: 12px; padding: 12px; background-color: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
            <h4 style="margin: 0 0 8px 0; color: #166534; font-size: 14px; font-weight: bold;">${field.icon} ${field.label}</h4>
            <div style="color: #15803d; line-height: 1.5;">${value}</div>
          </div>
        `
      }
    })
    
    html += '</div>'
  }

  // 예약 및 정책 정보 섹션
  const policyFields = [
    { key: 'exclusive_booking_info', label: labelSet.exclusive_booking_info, icon: '🔒' },
    { key: 'cancellation_policy', label: labelSet.cancellation_policy, icon: '📋' }
  ]

  const hasPolicyInfo = policyFields.some(field => details[field.key as keyof ProductDetails])
  if (hasPolicyInfo) {
    html += '<div class="policy-section" style="margin-bottom: 20px;">'
    html += '<h3 style="margin: 0 0 16px 0; color: #dc2626; font-size: 18px; font-weight: bold; border-bottom: 2px solid #ef4444; padding-bottom: 8px;">예약 및 정책</h3>'
    
    policyFields.forEach(field => {
      const value = details[field.key as keyof ProductDetails]
      if (value) {
        html += `
          <div style="margin-bottom: 12px; padding: 12px; background-color: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;">
            <h4 style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px; font-weight: bold;">${field.icon} ${field.label}</h4>
            <div style="color: #dc2626; line-height: 1.5;">${value}</div>
          </div>
        `
      }
    })
    
    html += '</div>'
  }

  // 채팅 공지사항
  if (details.chat_announcement) {
    html += `
      <div class="chat-announcement-section" style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 8px; color: white;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">📢 ${labelSet.chat_announcement}</h3>
        <div style="line-height: 1.5;">${details.chat_announcement}</div>
      </div>
    `
  }

  html += '</div>'
  return html
}

/**
 * 특정 필드만 렌더링하는 함수들
 */
export const productDetailsRenderers = {
  /**
   * 슬로건들만 렌더링
   */
  renderSlogans: (details: ProductDetails, locale: 'ko' | 'en' = 'ko') => {
    if (!details) return ''
    
    let html = '<div class="slogans-only" style="padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">'
    html += '<h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: bold;">슬로건</h3>'
    if (details.slogan1) html += `<p style="margin: 4px 0; font-size: 16px;">${details.slogan1}</p>`
    if (details.slogan2) html += `<p style="margin: 4px 0; font-size: 16px;">${details.slogan2}</p>`
    if (details.slogan3) html += `<p style="margin: 4px 0; font-size: 16px;">${details.slogan3}</p>`
    html += '</div>'
    return html
  },

  /**
   * 포함/불포함 사항만 렌더링
   */
  renderInclusions: (details: ProductDetails, locale: 'ko' | 'en' = 'ko') => {
    if (!details || (!details.included && !details.not_included)) return ''
    
    const labels = {
      ko: { included: '포함 사항', not_included: '불포함 사항' },
      en: { included: 'Included', not_included: 'Not Included' }
    }
    const labelSet = labels[locale]
    
    let html = '<div class="inclusions-only">'
    
    if (details.included) {
      html += `
        <div style="margin-bottom: 12px; padding: 12px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
          <h4 style="margin: 0 0 8px 0; color: #15803d; font-size: 14px; font-weight: bold;">✅ ${labelSet.included}</h4>
          <div style="color: #166534; line-height: 1.5;">${details.included}</div>
        </div>
      `
    }
    
    if (details.not_included) {
      html += `
        <div style="padding: 12px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
          <h4 style="margin: 0 0 8px 0; color: #dc2626; font-size: 14px; font-weight: bold;">❌ ${labelSet.not_included}</h4>
          <div style="color: #991b1b; line-height: 1.5;">${details.not_included}</div>
        </div>
      `
    }
    
    html += '</div>'
    return html
  },

  /**
   * 취소 정책만 렌더링
   */
  renderCancellationPolicy: (details: ProductDetails, locale: 'ko' | 'en' = 'ko') => {
    if (!details?.cancellation_policy) return ''
    
    const label = locale === 'ko' ? '취소 정책' : 'Cancellation Policy'
    
    return `
      <div style="padding: 12px; background-color: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;">
        <h4 style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px; font-weight: bold;">📋 ${label}</h4>
        <div style="color: #dc2626; line-height: 1.5;">${details.cancellation_policy}</div>
      </div>
    `
  }
}
