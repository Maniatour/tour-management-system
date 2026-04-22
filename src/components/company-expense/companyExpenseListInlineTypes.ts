export type CompanyExpenseInlineListDraft = {
  submit_on: string
  paid_to: string
  paid_for: string
  /** 표준 결제 내용 라벨 UUID, 없으면 빈 문자열 */
  paid_for_label_id: string
  description: string
  amount: string
  payment_method: string
  category: string
  expense_type: string
  vehicle_id: string
  status: string
  submit_by: string
}
