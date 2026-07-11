'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import type { CustomerPageZone as CustomerPageZoneId } from '@/lib/customerPageZones'
import { getZoneEditConfig, resolveCustomerPageZone } from '@/lib/customerPageZoneEditMap'
import { postCustomerPageZoneEdit } from '@/lib/customerPageEditMessaging'
import { zoneUiStyleToCssProperties } from '@/lib/customerPageZoneUiStyle'
import { useCustomerPageZoneUiStyle } from '@/hooks/useCustomerPageZoneUiStyle'

type CustomerPageZoneProps = {
  zone: string
  children: ReactNode
  className?: string
  /** 목록 카드 등 URL에 상품 ID가 없을 때 명시적으로 전달 */
  productId?: string | null
  /** 하위 zone에 수정 버튼이 있을 때 부모 버튼 숨김 (하이라이트·탭·카드 등) */
  suppressEditButton?: boolean
}

/** 고객 페이지 영역 — preview=1&editMode=1 또는 워크bench postMessage 시 수정 버튼 표시 */
export default function CustomerPageZone({
  zone,
  children,
  className = '',
  productId: productIdProp,
  suppressEditButton = false,
}: CustomerPageZoneProps) {
  const params = useParams()
  const searchParams = useSearchParams()
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const showEditButton = isPreview && isEditMode && !suppressEditButton
  const canonicalZone = resolveCustomerPageZone(zone)
  const editConfig = getZoneEditConfig(canonicalZone)
  const uiStyle = useCustomerPageZoneUiStyle(canonicalZone)
  const uiInlineStyle = uiStyle ? zoneUiStyleToCssProperties(uiStyle) : undefined
  const hasUiStyle = uiStyle !== null

  const resolvedProductId = useMemo(() => {
    if (productIdProp?.trim()) return productIdProp.trim()
    const fromParams = params.id
    if (typeof fromParams === 'string' && fromParams.trim()) return fromParams.trim()
    return searchParams.get('productId')?.trim() || null
  }, [productIdProp, params.id, searchParams])

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    postCustomerPageZoneEdit(canonicalZone as CustomerPageZoneId, resolvedProductId)
  }

  return (
    <div
      data-customer-zone={zone}
      data-edit-mode={showEditButton ? '1' : '0'}
      style={uiInlineStyle}
      className={`customer-page-zone cp-ui-zone relative ${hasUiStyle ? 'cp-ui-styled-zone' : ''} ${showEditButton ? 'customer-page-zone--editable' : ''} ${zone === 'detail-mobile-sticky-cta' ? 'customer-page-zone--fixed' : ''} ${className}`.trim()}
    >
      {children}
      {showEditButton && (
        <button
          type="button"
          onClick={handleEditClick}
          className="customer-page-zone-edit-btn pointer-events-auto absolute right-2 top-2 z-[100] inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold leading-none text-primary-foreground opacity-100 shadow-lg hover:bg-primary/90"
          title={editConfig ? `${editConfig.label} 수정` : `${zone} 수정`}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          <span>수정</span>
        </button>
      )}
    </div>
  )
}
