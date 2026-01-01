'use client'

interface ParticipantsSectionProps {
  formData: {
    adults: number
    child: number
    infant: number
    totalPeople: number
    eventNote: string
    isPrivateTour: boolean
    privateTourAdditionalCost: number
    // 거주 상태별 인원 수
    usResidentCount?: number
    nonResidentCount?: number
    nonResidentWithPassCount?: number
    passCoveredCount?: number // 패스로 커버되는 인원 수
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  t: (key: string) => string
}

export default function ParticipantsSection({
  formData,
  setFormData,
  t
}: ParticipantsSectionProps) {
  // 패스 장수에 따라 실제 커버되는 인원 수 계산 (패스 1장 = 4인)
  // 실제 예약 인원을 초과할 수 없음
  const calculateActualPassCovered = (passCount: number, usResident: number, nonResident: number) => {
    const maxCoverable = passCount * 4 // 패스로 최대 커버 가능한 인원 수
    const remainingPeople = formData.totalPeople - usResident - nonResident // 패스로 커버해야 할 인원 수
    return Math.min(maxCoverable, remainingPeople) // 둘 중 작은 값
  }

  return (
    <>
      {/* 네 번째 행: 참가자 수 설정 */}
      <div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('form.adults')}</label>
            <input
              type="number"
              value={formData.adults}
              onChange={(e) => {
                const newAdults = Number(e.target.value) || 0
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setFormData((prev: any) => ({ 
                  ...prev, 
                  adults: newAdults,
                  totalPeople: newAdults + prev.child + prev.infant
                }))
              }}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setFormData((prev: any) => ({ 
                  ...prev, 
                  child: newChild,
                  totalPeople: prev.adults + newChild + prev.infant
                }))
              }}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('form.infant')}</label>
            <input
              type="number"
              value={formData.infant}
              onChange={(e) => {
                const newInfant = Number(e.target.value) || 0
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setFormData((prev: any) => ({ 
                  ...prev, 
                  infant: newInfant,
                  totalPeople: prev.adults + prev.child + newInfant
                }))
              }}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">총 인원</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700">
              <span className="font-medium">{formData.totalPeople}</span>명
            </div>
          </div>
        </div>
      </div>

      {/* 거주 상태별 인원 수 설정 */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          거주 상태별 인원 수
        </label>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              <span className="inline-flex items-center">
                <span className="w-3 h-3 rounded-full bg-green-600 mr-1"></span>
                미국 거주자
              </span>
            </label>
            <input
              type="number"
              value={formData.usResidentCount || 0}
              onChange={(e) => {
                const newCount = Number(e.target.value) || 0
                const actualPassCovered = calculateActualPassCovered(
                  formData.nonResidentWithPassCount || 0,
                  newCount,
                  formData.nonResidentCount || 0
                )
                setFormData((prev: any) => ({ 
                  ...prev, 
                  usResidentCount: newCount,
                  passCoveredCount: actualPassCovered
                }))
              }}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              <span className="inline-flex items-center">
                <span className="w-3 h-3 rounded-full bg-blue-600 mr-1"></span>
                비거주자
              </span>
            </label>
            <input
              type="number"
              value={formData.nonResidentCount || 0}
              onChange={(e) => {
                const newCount = Number(e.target.value) || 0
                const actualPassCovered = calculateActualPassCovered(
                  formData.nonResidentWithPassCount || 0,
                  formData.usResidentCount || 0,
                  newCount
                )
                setFormData((prev: any) => ({ 
                  ...prev, 
                  nonResidentCount: newCount,
                  passCoveredCount: actualPassCovered
                }))
              }}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              <span className="inline-flex items-center">
                <span className="w-3 h-3 rounded-full bg-purple-600 mr-1"></span>
                비거주자 (패스 보유) (패스 장수)
              </span>
            </label>
            <input
              type="number"
              value={formData.nonResidentWithPassCount || 0}
              onChange={(e) => {
                const newPassCount = Number(e.target.value) || 0
                const actualPassCovered = calculateActualPassCovered(
                  newPassCount,
                  formData.usResidentCount || 0,
                  formData.nonResidentCount || 0
                )
                setFormData((prev: any) => ({ 
                  ...prev, 
                  nonResidentWithPassCount: newPassCount,
                  passCoveredCount: actualPassCovered // 패스 장수와 실제 예약 인원에 따라 자동 계산
                }))
              }}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="실제 보유한 패스 장수 입력"
            />
            <p className="text-xs text-gray-500 mt-1">
              패스 {formData.nonResidentWithPassCount || 0}장 = {calculateActualPassCovered(formData.nonResidentWithPassCount || 0, formData.usResidentCount || 0, formData.nonResidentCount || 0)}인 커버 (최대 {(formData.nonResidentWithPassCount || 0) * 4}인 가능)
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              패스로 커버되는 인원 수 (자동 계산)
            </label>
            <input
              type="number"
              value={formData.passCoveredCount || 0}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              패스 1장당 4인 커버 (실제 예약 인원과 패스 최대 커버 인원 중 작은 값)
            </p>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          총 인원: {formData.totalPeople}명 | 
          거주 상태별 합계: {(formData.usResidentCount || 0) + (formData.nonResidentCount || 0) + (formData.passCoveredCount || 0)}명
          {((formData.usResidentCount || 0) + (formData.nonResidentCount || 0) + (formData.passCoveredCount || 0)) !== formData.totalPeople && (
            <span className="text-orange-600 ml-1">⚠️ 인원 수가 일치하지 않습니다</span>
          )}
        </div>
      </div>

      {/* 다섯 번째 행: 특별 요청 사항 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.eventNote')}</label>
        <textarea
          value={formData.eventNote}
          onChange={(e) => setFormData({ ...formData, eventNote: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('form.eventNotePlaceholder')}
        />
      </div>


    </>
  )
}
