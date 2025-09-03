'use client'

interface Option {
  id: string
  name: string
  type: string
  required: boolean
  choices: Array<{
    id: string
    name: string
    adult_price_adjustment?: number
    child_price_adjustment?: number
    infant_price_adjustment?: number
  }>
}

interface OptionsSectionProps {
  formData: {
    productId: string
    requiredOptions: Record<string, string>
    selectedOptionPrices: Record<string, number>
  }
  setFormData: (data: { [key: string]: unknown }) => void
  getRequiredOptionsForProduct: (productId: string) => Record<string, Option>
  t: (key: string) => string
}

export default function OptionsSection({
  formData,
  setFormData,
  getRequiredOptionsForProduct,
  t
}: OptionsSectionProps) {
  const requiredOptions = getRequiredOptionsForProduct(formData.productId)

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.requiredOptions')}</label>
      <div className="border border-gray-300 rounded-lg p-3 max-h-80 overflow-y-auto">
        {Object.keys(requiredOptions).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(requiredOptions).map(([optionId, option]) => (
              <div key={optionId} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900">{option.name}</h4>
                  {option.required && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">필수</span>
                  )}
                </div>
                
                <div className="space-y-2">
                  {option.choices.map((choice) => (
                    <div key={choice.id} className="flex items-center justify-between p-2 border border-gray-100 rounded">
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name={`option_${optionId}`}
                          value={choice.id}
                          checked={formData.requiredOptions[optionId] === choice.id}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            requiredOptions: {
                              ...prev.requiredOptions,
                              [optionId]: e.target.value
                            }
                          }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-900">{choice.name}</span>
                      </div>
                      
                      {/* 가격 조정 입력 */}
                      <div className="flex items-center space-x-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">성인</label>
                          <input
                            type="number"
                            placeholder="0"
                            defaultValue={choice.adult_price_adjustment || 0}
                            onChange={(e) => {
                              const value = Number(e.target.value) || 0
                              setFormData(prev => ({
                                ...prev,
                                selectedOptionPrices: {
                                  ...prev.selectedOptionPrices,
                                  [`${optionId}_${choice.id}_adult`]: value
                                }
                              }))
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">아동</label>
                          <input
                            type="number"
                            placeholder="0"
                            defaultValue={choice.child_price_adjustment || 0}
                            onChange={(e) => {
                              const value = Number(e.target.value) || 0
                              setFormData(prev => ({
                                ...prev,
                                selectedOptionPrices: {
                                  ...prev.selectedOptionPrices,
                                  [`${optionId}_${choice.id}_child`]: value
                                }
                              }))
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">유아</label>
                          <input
                            type="number"
                            placeholder="0"
                            defaultValue={choice.infant_price_adjustment || 0}
                            onChange={(e) => {
                              const value = Number(e.target.value) || 0
                              setFormData(prev => ({
                                ...prev,
                                selectedOptionPrices: {
                                  ...prev.selectedOptionPrices,
                                  [`${optionId}_${choice.id}_infant`]: value
                                }
                              }))
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4 border border-gray-200 rounded-lg">
            {t('form.noRequiredOptions')}
          </div>
        )}
      </div>
    </div>
  )
}
