from pathlib import Path
p = Path("src/components/reservation/ReservationOptionsSection.tsx")
text = p.read_text(encoding="utf-8")
blocks = [
(
"""  /** 새 예약 시 옵션 목록을 부모에게 전달 (예약 저장 시 함께 저장용) */
  onPendingOptionsChange?: (options: CreateReservationOptionData[]) => void
}""",
"""  /** 새 예약 시 옵션 목록을 부모에게 전달 (예약 저장 시 함께 저장용) */
  onPendingOptionsChange?: (options: CreateReservationOptionData[]) => void
  /** DB에 반영된 추가·수정·삭제 직후 (카드 뷰 집계 갱신 등) */
  onPersistedMutation?: () => void
  /** 부모 모달 위에 옵션 추가 오버레이를 올릴 때 z-index 클래스 (예: z-[110]) */
  addOptionModalZClass?: string
}""",
),
(
"""export default function ReservationOptionsSection({ reservationId, onTotalPriceChange, hideTitle, title: titleProp, itemVariant = 'card', isPersisted = true, onPendingOptionsChange }: ReservationOptionsSectionProps) {""",
"""export default function ReservationOptionsSection({ reservationId, onTotalPriceChange, hideTitle, title: titleProp, itemVariant = 'card', isPersisted = true, onPendingOptionsChange, onPersistedMutation, addOptionModalZClass }: ReservationOptionsSectionProps) {""",
),
(
"""        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">""",
"""        <div className={`fixed inset-0 flex items-center justify-center bg-black/50 p-4 ${addOptionModalZClass ?? 'z-50'}`}>""",
),
(
"""    try {
      await createReservationOption(newItem)
      handleCloseAddModal()
    } catch (error) {""",
"""    try {
      await createReservationOption(newItem)
      handleCloseAddModal()
      onPersistedMutation?.()
    } catch (error) {""",
),
(
"""      setEditingOption(null)
    } catch (error) {
      console.error('Error updating reservation option:', error)""",
"""      setEditingOption(null)
      onPersistedMutation?.()
    } catch (error) {
      console.error('Error updating reservation option:', error)""",
),
(
"""      try {
        await deleteReservationOption(optionId)
      } catch (error) {
        console.error('Error deleting reservation option:', error)""",
"""      try {
        await deleteReservationOption(optionId)
        onPersistedMutation?.()
      } catch (error) {
        console.error('Error deleting reservation option:', error)""",
),
]
for i, (o, n) in enumerate(blocks):
    if o not in text:
        raise SystemExit(f"missing {i+1}")
    text = text.replace(o, n, 1)
p.write_text(text, encoding="utf-8")
print("ReservationOptionsSection ok")
