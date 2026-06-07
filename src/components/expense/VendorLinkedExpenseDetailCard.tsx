'use client'

import { useState } from 'react'
import { ExternalLink, ImageIcon, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import {
  formatVendorExpenseAmount,
  formatVendorExpenseDate,
  formatVendorExpenseDateTime,
  formatVendorExpensePaidFor,
  vendorLinkedExpenseReceiptUrl,
  type VendorLinkedExpenseRow,
} from '@/lib/expenseVendors'

type Props = {
  row: VendorLinkedExpenseRow
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  )
}

function boolLabel(value: boolean | null): string | null {
  if (value == null) return null
  return value ? '예' : '아니오'
}

export default function VendorLinkedExpenseDetailCard({ row }: Props) {
  const { paymentMethodMap } = usePaymentMethodOptions()
  const [receiptOpen, setReceiptOpen] = useState(false)
  const receiptUrl = vendorLinkedExpenseReceiptUrl(row)

  const paymentMethodLabel = (() => {
    const raw = (row.payment_method ?? '').trim()
    if (!raw) return null
    return paymentMethodMap[raw] ?? raw
  })()

  const stdPaidFor = (row.standard_paid_for ?? '').trim()
  const rawPaidFor = (row.paid_for ?? '').trim()
  const paidForDisplay = formatVendorExpensePaidFor(row)

  const hasReimbursement =
    row.reimbursed_amount != null && Number.isFinite(row.reimbursed_amount) && row.reimbursed_amount > 0

  return (
    <>
      <dl className="space-y-1.5">
        <DetailRow label="ID" value={<span className="font-mono text-[11px]">{row.id}</span>} />
        <DetailRow label="결제처" value={row.paid_to} />
        <DetailRow label="결제 내용" value={paidForDisplay} />
        {stdPaidFor && rawPaidFor && stdPaidFor !== rawPaidFor ? (
          <DetailRow label="원본 항목" value={rawPaidFor} />
        ) : null}
        {row.source === 'company' ? (
          <>
            <DetailRow label="카테고리" value={row.category} />
            <DetailRow label="하위 카테고리" value={row.subcategory} />
            <DetailRow label="지출 유형" value={row.expense_type} />
            <DetailRow label="세금 공제" value={boolLabel(row.tax_deductible)} />
            <DetailRow label="차량 ID" value={row.vehicle_id} />
            <DetailRow label="정비 유형" value={row.maintenance_type} />
            <DetailRow label="수급 직원" value={row.paid_to_employee_email} />
          </>
        ) : null}
        <DetailRow label="금액" value={formatVendorExpenseAmount(row.amount)} />
        <DetailRow label="등록일" value={formatVendorExpenseDate(row.submit_on)} />
        <DetailRow label="결제 방법" value={paymentMethodLabel} />
        {row.source === 'tour' ? (
          <>
            <DetailRow label="투어 ID" value={row.ref_id ? <span className="font-mono text-[11px]">{row.ref_id}</span> : null} />
            <DetailRow label="투어일" value={row.tour_date ? formatVendorExpenseDate(row.tour_date) : null} />
            <DetailRow label="상품 ID" value={row.product_id} />
          </>
        ) : null}
        {row.source === 'reservation' ? (
          <>
            <DetailRow label="예약 ID" value={row.ref_id ? <span className="font-mono text-[11px]">{row.ref_id}</span> : null} />
            <DetailRow label="이벤트 ID" value={row.event_id} />
          </>
        ) : null}
        <DetailRow label="제출자" value={row.submit_by} />
        <DetailRow label="설명" value={row.description} />
        {row.notes && row.notes !== row.description ? <DetailRow label="비고" value={row.notes} /> : null}
        {hasReimbursement ? (
          <>
            <DetailRow label="환급 금액" value={formatVendorExpenseAmount(row.reimbursed_amount)} />
            <DetailRow label="환급일" value={formatVendorExpenseDate(row.reimbursed_on)} />
            <DetailRow label="환급 메모" value={row.reimbursement_note} />
          </>
        ) : null}
        <DetailRow label="감사자" value={row.audited_by} />
        <DetailRow label="확인자" value={row.checked_by} />
        <DetailRow label="확인일" value={row.checked_on ? formatVendorExpenseDateTime(row.checked_on) : null} />
        <DetailRow label="등록 시각" value={row.created_at ? formatVendorExpenseDateTime(row.created_at) : null} />
        <DetailRow label="수정 시각" value={row.updated_at ? formatVendorExpenseDateTime(row.updated_at) : null} />
        <DetailRow label="파일 경로" value={row.file_path} />
      </dl>

      <div className="pt-2 border-t">
        <p className="text-xs font-medium text-muted-foreground mb-2">영수증</p>
        {receiptUrl ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className="block w-full max-w-[12rem] rounded-lg border overflow-hidden hover:ring-2 hover:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={receiptUrl}
                alt="영수증 미리보기"
                className="w-full h-auto max-h-32 object-cover bg-muted"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
            </button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReceiptOpen(true)}>
                <Receipt className="h-3.5 w-3.5 mr-1" />
                영수증 크게 보기
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" asChild>
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  새 창
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">등록된 영수증 없음</p>
        )}
      </div>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              영수증 — {paidForDisplay}
            </DialogTitle>
          </DialogHeader>
          {receiptUrl ? (
            <div className="flex-1 overflow-y-auto p-1">
              <div className="flex flex-col items-center gap-3">
                <img
                  src={receiptUrl}
                  alt={`${paidForDisplay} 영수증`}
                  className="max-w-full h-auto rounded-lg shadow-md"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.alt = '이미지를 불러올 수 없습니다'
                  }}
                />
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                    <ImageIcon className="h-4 w-4 mr-1" />
                    새 창에서 열기
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
