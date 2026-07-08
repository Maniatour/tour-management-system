'use client'

import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Pencil } from 'lucide-react'
import type { CustomerPageZone as CustomerPageZoneId } from '@/lib/customerPageZones'
import { postCustomerPageZoneEdit } from '@/lib/customerPageEditMessaging'
import { getZoneEditConfig } from '@/lib/customerPageZoneEditMap'

type CustomerPageZoneProps = {
  zone: string
  children: ReactNode
  className?: string
}

/** 고객 페이지 영역 — admin preview=1&highlight= 쿼리로 강조, editMode=1 시 수정 버튼 표시 */
export default function CustomerPageZone({ zone, children, className = '' }: CustomerPageZoneProps) {
  const searchParams = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'
  const isEditMode = searchParams.get('editMode') === '1'
  const showEditButton = isPreview && isEditMode
  const editConfig = getZoneEditConfig(zone as CustomerPageZoneId)

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    postCustomerPageZoneEdit(zone as CustomerPageZoneId)
  }

  return (
    <div
      data-customer-zone={zone}
      className={`customer-page-zone relative ${showEditButton ? 'customer-page-zone--editable' : ''} ${className}`.trim()}
    >
      {children}
      {showEditButton && editConfig && (
        <button
          type="button"
          onClick={handleEditClick}
          className="customer-page-zone-edit-btn"
          title={`${editConfig.label} 수정`}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span>수정</span>
        </button>
      )}
    </div>
  )
}
