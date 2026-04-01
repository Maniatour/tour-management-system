'use client'

import ReservationEvidenceUpload from '@/components/reservation/ReservationEvidenceUpload'
import {
  computePassCoveredCount,
  emptyResidentStatusAmounts,
  residentLineDefaultAmountUsd,
  type ResidentLineKey,
} from '@/utils/usResidentChoiceSync'

interface ParticipantsSectionProps {
  formData: {
    adults: number
    child: number
    infant: number
    totalPeople: number
    eventNote: string
    isPrivateTour: boolean
    privateTourAdditionalCost: number
    undecidedResidentCount?: number
    usResidentCount?: number
    nonResidentCount?: number
    nonResidentWithPassCount?: number
    nonResidentUnder16Count?: number
    nonResidentPurchasePassCount?: number
    passCoveredCount?: number
    residentStatusAmounts?: Partial<Record<ResidentLineKey, number>>
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  /** 거주 라인 변경 시 초이스(selectedChoices)·choicesTotal까지 반영할 때 사용 (없으면 setFormData만) */
  applyResidentParticipantPatch?: (patch: Record<string, unknown>) => void
  t: (key: string) => string
  reservationId?: string | null
  locale?: string
}

const RESIDENT_ROWS: {
  lineKey: ResidentLineKey
  label: string
  dotClass: string
  countField: keyof ParticipantsSectionProps['formData']
  amountHint?: string
}[] = [
  { lineKey: 'undecided', label: '미정', dotClass: 'bg-amber-500', countField: 'undecidedResidentCount' },
  { lineKey: 'us_resident', label: '미국 거주자', dotClass: 'bg-green-600', countField: 'usResidentCount' },
  { lineKey: 'non_resident', label: '비 거주자', dotClass: 'bg-blue-600', countField: 'nonResidentCount' },
  {
    lineKey: 'non_resident_under_16',
    label: '비 거주자 (미성년자)',
    dotClass: 'bg-orange-600',
    countField: 'nonResidentUnder16Count',
  },
  {
    lineKey: 'non_resident_with_pass',
    label: '비 거주자 (패스보유)',
    dotClass: 'bg-purple-600',
    countField: 'nonResidentWithPassCount',
    amountHint: '패스 장수',
  },
  {
    lineKey: 'non_resident_purchase_pass',
    label: '비 거주자 (패스 구매)',
    dotClass: 'bg-indigo-600',
    countField: 'nonResidentPurchasePassCount',
  },
]

export default function ParticipantsSection({
  formData,
  setFormData,
  applyResidentParticipantPatch,
  t,
  reservationId,
  locale = 'ko',
}: ParticipantsSectionProps) {
  const apply = (patch: Record<string, unknown>) => {
    if (applyResidentParticipantPatch) {
      applyResidentParticipantPatch(patch)
      return
    }
    setFormData((prev: Record<string, unknown>) => {
      const baseAmounts = { ...emptyResidentStatusAmounts(), ...(prev.residentStatusAmounts as object) }
      const next = { ...prev, ...patch }
      if (patch.residentStatusAmounts && typeof patch.residentStatusAmounts === 'object') {
        next.residentStatusAmounts = {
          ...baseAmounts,
          ...(patch.residentStatusAmounts as object),
        }
      }
      return next
    })
  }

  const amounts = { ...emptyResidentStatusAmounts(), ...(formData.residentStatusAmounts || {}) }

  const sumResidentPeople =
    (formData.undecidedResidentCount || 0) +
    (formData.usResidentCount || 0) +
    (formData.nonResidentCount || 0) +
    (formData.nonResidentUnder16Count || 0) +
    (formData.nonResidentPurchasePassCount || 0) +
    (formData.passCoveredCount || 0)

  const needsEvidenceHighlight =
    (formData.usResidentCount || 0) > 0 ||
    (formData.nonResidentUnder16Count || 0) > 0 ||
    (formData.nonResidentWithPassCount || 0) > 0

  return (
    <>
      <div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('form.adults')}</label>
            <input
              type="number"
              value={formData.adults}
              onChange={(e) => {
                const newAdults = Number(e.target.value) || 0
                setFormData((prev: any) => ({
                  ...prev,
                  adults: newAdults,
                  totalPeople: newAdults + prev.child + prev.infant,
                }))
              }}
              min="1"
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('form.child')}</label>
            <input
              type="number"
              value={formData.child}
              onChange={(e) => {
                const newChild = Number(e.target.value) || 0
                setFormData((prev: any) => ({
                  ...prev,
                  child: newChild,
                  totalPeople: prev.adults + newChild + prev.infant,
                }))
              }}
              min="0"
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('form.infant')}</label>
            <input
              type="number"
              value={formData.infant}
              onChange={(e) => {
                const newInfant = Number(e.target.value) || 0
                setFormData((prev: any) => ({
                  ...prev,
                  infant: newInfant,
                  totalPeople: prev.adults + prev.child + newInfant,
                }))
              }}
              min="0"
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">총 인원</label>
            <div className="px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-700">
              <span className="font-medium">{formData.totalPeople}</span>명
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <label className="block text-xs font-medium text-gray-700 mb-2">
          거주 상태별 인원 수 · 금액 (미국 거주자 구분 및 기타 입장료와 연동)
        </label>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 pl-0">
            <div className="flex-1 min-w-0 text-gray-500 font-medium">구분</div>
            <div className="w-16 shrink-0 text-center text-gray-500 font-medium">수량</div>
            <div className="w-20 shrink-0 text-center text-gray-500 font-medium">금액($)</div>
          </div>
          {RESIDENT_ROWS.map((row) => (
            <div key={row.lineKey} className="flex items-center gap-2">
              <div
                className={`flex-1 min-w-0 text-gray-600 flex items-center gap-1.5 ${row.amountHint ? 'cursor-help' : ''}`}
                title={row.amountHint}
              >
                <span className={`w-3 h-3 rounded-full shrink-0 ${row.dotClass}`} />
                <span className="leading-snug break-words">
                  {row.label}
                  {row.amountHint ? (
                    <span className="text-gray-400 ml-1">({row.amountHint})</span>
                  ) : null}
                </span>
              </div>
              <input
                type="number"
                min={0}
                value={Number(formData[row.countField] ?? 0)}
                onChange={(e) => {
                  const newCount = Math.max(0, Number(e.target.value) || 0)
                  const lineAmount = residentLineDefaultAmountUsd(row.lineKey, newCount)

                  // 미정은 직접 편집 시 그대로 반영. 그 외 구간을 바꾸면 (미국 거주자·비거주 등) 미정을 총인원에서 나머지로 자동 조정
                  if (row.lineKey === 'undecided') {
                    apply({
                      undecidedResidentCount: newCount,
                      residentStatusAmounts: { ...amounts, undecided: lineAmount },
                    })
                    return
                  }

                  let us = formData.usResidentCount || 0
                  let non = formData.nonResidentCount || 0
                  let under = formData.nonResidentUnder16Count || 0
                  let passCount = formData.nonResidentWithPassCount || 0
                  let purchasePass = formData.nonResidentPurchasePassCount || 0
                  if (row.countField === 'usResidentCount') us = newCount
                  if (row.countField === 'nonResidentCount') non = newCount
                  if (row.countField === 'nonResidentUnder16Count') under = newCount
                  if (row.countField === 'nonResidentWithPassCount') passCount = newCount
                  if (row.countField === 'nonResidentPurchasePassCount') purchasePass = newCount

                  const passCovered = computePassCoveredCount(
                    passCount,
                    us,
                    non,
                    under,
                    formData.totalPeople
                  )
                  const othersSum = us + non + under + purchasePass + passCovered
                  const newUndecided = Math.max(0, formData.totalPeople - othersSum)

                  apply({
                    [row.countField]: newCount,
                    undecidedResidentCount: newUndecided,
                    passCoveredCount: passCovered,
                    residentStatusAmounts: {
                      ...amounts,
                      [row.lineKey]: lineAmount,
                      undecided: residentLineDefaultAmountUsd('undecided', newUndecided),
                    },
                  })
                }}
                className="w-16 shrink-0 px-1.5 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xs text-center"
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={amounts[row.lineKey] ?? 0}
                onChange={(e) => {
                  const v = e.target.value === '' ? 0 : Number(e.target.value)
                  const num = Number.isFinite(v) ? v : 0
                  apply({
                    residentStatusAmounts: { ...amounts, [row.lineKey]: num },
                  })
                }}
                className="w-20 shrink-0 px-1.5 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-xs text-center"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          <span>
            총 인원: {formData.totalPeople}명 | 거주·패스 배정 합계: {sumResidentPeople}명
          </span>
          {sumResidentPeople !== formData.totalPeople && (
            <span className="block mt-1 text-orange-600">⚠️ 인원 수가 일치하지 않습니다</span>
          )}
        </div>
        <ReservationEvidenceUpload
          reservationId={reservationId}
          compact
          locale={locale}
          highlight={needsEvidenceHighlight}
        />
      </div>

      <div className="mt-4 mb-0">
        <label className="block text-xs font-medium text-gray-700 mb-1">{t('form.eventNote')}</label>
        <textarea
          value={formData.eventNote}
          onChange={(e) => setFormData({ ...formData, eventNote: e.target.value })}
          rows={2}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
          placeholder={t('form.eventNotePlaceholder')}
        />
      </div>
    </>
  )
}
