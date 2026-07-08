'use client'

import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import type { CustomerPageZone as CustomerPageZoneId } from '@/lib/customerPageZones'
import { postCustomerPageZoneEdit } from '@/lib/customerPageEditMessaging'
import { getZoneEditConfig } from '@/lib/customerPageZoneEditMap'

type CustomerPageZoneProps = {
  zone: string
  children: ReactNode
  className?: string
}

/** 고객 페이지 영역 — preview=1&editMode=1 또는 워크bench postMessage 시 수정 버튼 표시 */
export default function CustomerPageZone({ zone, children, className = '' }: CustomerPageZoneProps) {
  const { isPreview, isEditMode } = useCustomerPageEditMode()
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
      data-edit-mode={showEditButton ? '1' : '0'}
      className={`customer-page-zone relative ${showEditButton ? 'customer-page-zone--editable' : ''} ${className}`.trim()}
    >
      {children}
      {showEditButton && (
        <button
          type="button"
          onClick={handleEditClick}
          className="customer-page-zone-edit-btn absolute top-2 right-2 z-[100] inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold leading-none text-white shadow-lg hover:bg-blue-700 pointer-events-auto opacity-100"
          title={editConfig ? `${editConfig.label} 수정` : `${zone} 수정`}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          <span>수정</span>
        </button>
      )}
    </div>
  )
}
