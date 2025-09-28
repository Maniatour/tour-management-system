'use client'

import React, { useState, useEffect } from 'react'
import { Info, Calendar, MessageCircle, Image, Clock, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

  interface BasicInfoTabProps {
    formData: {
      name: string
      productCode: string
      category: string
      subCategory: string
      description: string
      duration: number
      maxParticipants: number
      departureCity: string
      arrivalCity: string
      departureCountry: string
      arrivalCountry: string
      languages: string[]
      groupSize: string[]
      adultAge: number
      childAgeMin: number
      childAgeMax: number
      infantAge: number
      status: 'active' | 'inactive' | 'draft'
    }
  setFormData: React.Dispatch<React.SetStateAction<any>>
  productId: string
  isNewProduct: boolean
}

export default function BasicInfoTab({
  formData,
  setFormData,
  productId,
  isNewProduct
}: BasicInfoTabProps) {
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [categories, setCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [subCategories, setSubCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [allSubCategories, setAllSubCategories] = useState<{ value: string; label: string; count: number }[]>([])

  // 기본 정보 저장 함수
  const handleSave = async () => {
    if (isNewProduct) {
      setSaveMessage('새 상품은 전체 저장을 사용해주세요.')
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name.trim(),
          product_code: formData.productCode.trim(),
          category: formData.category,
          sub_category: formData.subCategory.trim(),
          description: formData.description.trim(),
          duration: formData.duration.toString(),
          base_price: 0, // 기본 가격은 동적 가격에서 설정
          max_participants: formData.maxParticipants,
          status: formData.status,
          departure_city: formData.departureCity.trim(),
          arrival_city: formData.arrivalCity.trim(),
          departure_country: formData.departureCountry,
          arrival_country: formData.arrivalCountry,
          languages: formData.languages,
          group_size: formData.groupSize.toString(),
          adult_age: formData.adultAge,
          child_age_min: formData.childAgeMin,
          child_age_max: formData.childAgeMax,
          infant_age: formData.infantAge
        })
        .eq('id', productId)

      if (error) throw error

      setSaveMessage('기본 정보가 성공적으로 저장되었습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('기본 정보 저장 오류:', error)
      setSaveMessage('기본 정보 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 카테고리와 서브카테고리 데이터 가져오기
  useEffect(() => {
    fetchCategoriesAndSubCategories()
  }, [])



  // 카테고리 선택 시 서브카테고리 필터링
  useEffect(() => {
    if (formData.category) {
      // 현재 선택된 카테고리에 해당하는 서브카테고리만 필터링
      const filteredSubCategories = allSubCategories.filter(
        subCat => {
          // 해당 서브카테고리가 현재 선택된 카테고리의 상품에 포함되어 있는지 확인
          return true // 모든 서브카테고리를 표시 (카테고리별 필터링은 나중에 구현)
        }
      )
      setSubCategories(filteredSubCategories)
    } else {
      setSubCategories([])
    }
  }, [formData.category, allSubCategories])

  const fetchCategoriesAndSubCategories = async () => {
    try {
      // 상품 데이터에서 카테고리와 서브카테고리 추출
      const { data: products, error } = await supabase
        .from('products')
        .select('category, sub_category')

      if (error) throw error

      // 카테고리 통계 계산
      const categoryCounts: { [key: string]: number } = {}
      const subCategoryCounts: { [key: string]: number } = {}

      products?.forEach(product => {
        if (product.category) {
          categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1
        }
        if (product.sub_category) {
          subCategoryCounts[product.sub_category] = (subCategoryCounts[product.sub_category] || 0) + 1
        }
      })

      // 카테고리 목록 생성
      const categoryList = Object.keys(categoryCounts).map(category => ({
        value: category,
        label: category,
        count: categoryCounts[category]
      }))

      // 서브카테고리 목록 생성
      const subCategoryList = Object.keys(subCategoryCounts).map(subCategory => ({
        value: subCategory,
        label: subCategory,
        count: subCategoryCounts[subCategory]
      }))

      console.log('=== Categories and SubCategories Debug ===')
      console.log('Categories found:', categoryList)
      console.log('SubCategories found:', subCategoryList)
      console.log('Current formData.category:', formData.category)
      console.log('Current formData.subCategory:', formData.subCategory)
      
      setCategories(categoryList)
      setAllSubCategories(subCategoryList)
      setSubCategories(subCategoryList)
    } catch (error) {
      console.error('카테고리 및 서브카테고리 데이터 가져오기 오류:', error)
    }
  }

  const handleSaveBasicInfo = async () => {
    if (isNewProduct) {
      setSaveMessage('새 상품은 전체 저장을 사용해주세요.')
      return
    }

    setSaving(true)
    setSaveMessage('')

    try {
      // 기본 정보만 업데이트
      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name,
          product_code: formData.productCode,
          category: formData.category,
          sub_category: formData.subCategory,
          description: formData.description,
          duration: formData.duration.toString(),
          max_participants: formData.maxParticipants,
          departure_city: formData.departureCity,
          arrival_city: formData.arrivalCity,
                     departure_country: formData.departureCountry,
           arrival_country: formData.arrivalCountry,
           languages: formData.languages,
           group_size: formData.groupSize.join(','),
           adult_age: formData.adultAge,
          child_age_min: formData.childAgeMin,
          child_age_max: formData.childAgeMax,
          infant_age: formData.infantAge,
          status: formData.status
        })
        .eq('id', productId)

      if (error) throw error

      setSaveMessage('기본 정보가 성공적으로 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
            } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          console.error('기본 정보 저장 오류:', errorMessage)
          setSaveMessage(`기본 정보 저장에 실패했습니다: ${errorMessage}`)
          setTimeout(() => setSaveMessage(''), 3000)
        } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* 상품 기본 정보 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상품명 *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상품 코드 *</label>
          <input
            type="text"
            value={formData.productCode || ''}
            onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: ANT-001"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">판매 상태 *</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'draft' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="active">판매 중</option>
            <option value="inactive">판매 중단</option>
            <option value="draft">임시 저장</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">카테고리 선택</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label} ({category.count})
              </option>
            ))}
          </select>
        </div>
      </div>

              <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">서브 카테고리</label>
          {/* 디버깅: 현재 값들 확인 */}
          <div className="text-xs text-gray-500 mb-1">
            Debug: formData.subCategory = &quot;{formData.subCategory}&quot;, 
            subCategories.length = {subCategories.length}
          </div>
          <select
            value={formData.subCategory || ''}
            onChange={(e) => {
              console.log('서브카테고리 변경:', e.target.value)
              setFormData({ ...formData, subCategory: e.target.value })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!formData.category}
          >
            <option value="">서브 카테고리 선택</option>
            {subCategories.map((subCategory) => (
              <option key={subCategory.value} value={subCategory.value}>
                {subCategory.label} ({subCategory.count})
              </option>
            ))}
          </select>
          {!formData.category && (
            <p className="text-xs text-gray-500 mt-1">먼저 카테고리를 선택해주세요</p>
          )}
        </div>

      {/* 출발/도착 정보 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">출발 도시 *</label>
          <input
            type="text"
            value={formData.departureCity || ''}
            onChange={(e) => setFormData({ ...formData, departureCity: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 라스베가스"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">도착 도시 *</label>
          <input
            type="text"
            value={formData.arrivalCity || ''}
            onChange={(e) => setFormData({ ...formData, arrivalCity: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 앤텔롭 캐년"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">출발 국가 *</label>
          <select
            value={formData.departureCountry || ''}
            onChange={(e) => setFormData({ ...formData, departureCountry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">국가 선택</option>
            <option value="USA">미국</option>
            <option value="US">미국 (US)</option>
            <option value="KR">한국</option>
            <option value="JP">일본</option>
            <option value="CN">중국</option>
            <option value="TH">태국</option>
            <option value="VN">베트남</option>
            <option value="SG">싱가포르</option>
            <option value="MY">말레이시아</option>
            <option value="ID">인도네시아</option>
            <option value="PH">필리핀</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">도착 국가 *</label>
          <select
            value={formData.arrivalCountry || ''}
            onChange={(e) => setFormData({ ...formData, arrivalCountry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">국가 선택</option>
            <option value="USA">미국</option>
            <option value="US">미국 (US)</option>
            <option value="KR">한국</option>
            <option value="JP">일본</option>
            <option value="CN">중국</option>
            <option value="TH">태국</option>
            <option value="VN">베트남</option>
            <option value="SG">싱가포르</option>
            <option value="MY">말레이시아</option>
            <option value="ID">인도네시아</option>
            <option value="PH">필리핀</option>
          </select>
        </div>
      </div>
      
      {/* 투어 언어 및 그룹 크기 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">투어 언어 *</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.languages?.includes('ko') || false}
                onChange={(e) => {
                  const languages = formData.languages || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, languages: [...languages, 'ko'] });
                  } else {
                    setFormData({ ...formData, languages: languages.filter(lang => lang !== 'ko') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              한국어
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.languages?.includes('en') || false}
                onChange={(e) => {
                  const languages = formData.languages || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, languages: [...languages, 'en'] });
                  } else {
                    setFormData({ ...formData, languages: languages.filter(lang => lang !== 'en') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              영어
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">그룹 크기 *</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.groupSize?.includes('private') || false}
                onChange={(e) => {
                  const groupSizes = formData.groupSize || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, groupSize: [...groupSizes, 'private'] });
                  } else {
                    setFormData({ ...formData, groupSize: groupSizes.filter(size => size !== 'private') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Private (개인/가족)
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.groupSize?.includes('small') || false}
                onChange={(e) => {
                  const groupSizes = formData.groupSize || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, groupSize: [...groupSizes, 'small'] });
                  } else {
                    setFormData({ ...formData, groupSize: groupSizes.filter(size => size !== 'small') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Small Group (소규모 그룹)
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.groupSize?.includes('big') || false}
                onChange={(e) => {
                  const groupSizes = formData.groupSize || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, groupSize: [...groupSizes, 'big'] });
                  } else {
                    setFormData({ ...formData, groupSize: groupSizes.filter(size => size !== 'big') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Big Group (대규모 그룹)
            </label>
          </div>
        </div>
      </div>
      
      {/* 연령 기준 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">성인 기준 (이상) *</label>
          <input
            type="number"
            min="0"
            value={formData.adultAge || ''}
            onChange={(e) => setFormData({ ...formData, adultAge: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 13"
            required
          />
          <p className="text-xs text-gray-500 mt-1">세 이상</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">아동 기준 (이상) *</label>
          <input
            type="number"
            min="0"
            value={formData.childAgeMin || ''}
            onChange={(e) => setFormData({ ...formData, childAgeMin: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 3"
            required
          />
          <p className="text-xs text-gray-500 mt-1">세 이상</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">아동 기준 (이하) *</label>
          <input
            type="number"
            min="0"
            value={formData.childAgeMax || ''}
            onChange={(e) => setFormData({ ...formData, childAgeMax: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 12"
            required
          />
          <p className="text-xs text-gray-500 mt-1">세 이하</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">유아 기준 (이하) *</label>
          <input
            type="number"
            min="0"
            value={formData.infantAge || ''}
            onChange={(e) => setFormData({ ...formData, infantAge: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 2"
            required
          />
          <p className="text-xs text-gray-500 mt-1">세 이하</p>
        </div>
      </div>
      
      {/* 기존 필드들 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">설명 *</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">총 투어 시간 (시간) *</label>
          <input
            type="number"
            min="0.5"
            max="168"
            step="0.5"
            value={formData.duration}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (value >= 0.5 && value <= 168) {
                setFormData({ ...formData, duration: value });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 3.5 (숙박 투어의 경우 25, 48 등)"
            required
          />
          <p className="text-xs text-gray-500 mt-1">시간 단위로 입력 (0.5시간 = 30분, 최대 168시간 = 7일)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">최대 참가자 *</label>
          <input
            type="number"
            min="1"
            value={formData.maxParticipants}
            onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
      </div>


      {/* 기본 정보 저장 버튼 */}
      <div className="border-t pt-6 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">기본 정보</h3>
          </div>
          <button
            type="button"
            onClick={handleSaveBasicInfo}
            disabled={saving || isNewProduct}
            className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors ${
              saving || isNewProduct
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Save className="h-4 w-4" />
            <span>{saving ? '저장 중...' : '기본 정보 저장'}</span>
          </button>
        </div>
        {saveMessage && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            saveMessage.includes('성공') 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {saveMessage}
          </div>
        )}
        {isNewProduct && (
          <p className="mt-2 text-sm text-gray-500">
            새 상품은 전체 저장을 사용해주세요.
          </p>
        )}
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving || isNewProduct}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '기본 정보 저장'}
        </button>
      </div>
    </>
  )
}
