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
