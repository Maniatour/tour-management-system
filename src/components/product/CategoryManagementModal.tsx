'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Edit2, Trash2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface CategoryItem {
  value: string
  label: string
  count: number
  id?: string
}

interface SubCategoryItem {
  value: string
  label: string
  count: number
  id?: string
  categoryId?: string
}

interface CategoryManagementModalProps {
  isOpen: boolean
  onClose: () => void
  categories: CategoryItem[]
  subCategories: CategoryItem[]
  onCategoriesUpdate: (categories: CategoryItem[], subCategories: CategoryItem[]) => void
}

export default function CategoryManagementModal({
  isOpen,
  onClose,
  categories,
  subCategories,
  onCategoriesUpdate
}: CategoryManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'category' | 'subcategory'>('category')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubCategoryName, setNewSubCategoryName] = useState('')
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingSubCategory, setEditingSubCategory] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editSubCategoryName, setEditSubCategoryName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // 모달이 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setNewCategoryName('')
      setNewSubCategoryName('')
      setSelectedCategoryForSub('')
      setEditingCategory(null)
      setEditingSubCategory(null)
      setEditCategoryName('')
      setEditSubCategoryName('')
      setMessage('')
    }
  }, [isOpen])

  // 새 카테고리 추가
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setMessage('카테고리명을 입력해주세요.')
      return
    }

    const trimmedName = newCategoryName.trim()
    
    // 중복 확인
    if (categories.some(cat => cat.value.toLowerCase() === trimmedName.toLowerCase())) {
      setMessage('이미 존재하는 카테고리입니다.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      // product_categories 테이블에 새 카테고리 추가
      const { data, error } = await supabase
        .from('product_categories')
        .insert([{
          name: trimmedName,
          description: '',
          sort_order: categories.length + 1,
          is_active: true
        }])
        .select()
        .single()

      if (error) {
        console.error('카테고리 추가 오류:', error)
        setMessage('카테고리 추가 중 오류가 발생했습니다.')
        return
      }

      const newCategory: CategoryItem = {
        value: trimmedName,
        label: trimmedName,
        count: 0
      }

      const updatedCategories = [...categories, newCategory]
      onCategoriesUpdate(updatedCategories, subCategories)
      
      setNewCategoryName('')
      setMessage('카테고리가 성공적으로 추가되었습니다.')
    } catch (error) {
      console.error('카테고리 추가 오류:', error)
      setMessage('카테고리 추가 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 새 서브카테고리 추가
  const handleAddSubCategory = async () => {
    if (!newSubCategoryName.trim()) {
      setMessage('서브카테고리명을 입력해주세요.')
      return
    }

    if (!selectedCategoryForSub) {
      setMessage('카테고리를 선택해주세요.')
      return
    }

    const trimmedName = newSubCategoryName.trim()
    
    // 선택된 카테고리에서 중복 확인
    const selectedCategory = categories.find(cat => cat.value === selectedCategoryForSub)
    if (!selectedCategory) {
      setMessage('선택된 카테고리를 찾을 수 없습니다.')
      return
    }

    // 같은 카테고리 내에서 중복 확인
    if (subCategories.some(sub => sub.categoryId === selectedCategory.id && sub.value.toLowerCase() === trimmedName.toLowerCase())) {
      setMessage('이미 존재하는 서브카테고리입니다.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      // product_sub_categories 테이블에 새 서브카테고리 추가
      const { data, error } = await supabase
        .from('product_sub_categories')
        .insert([{
          category_id: selectedCategory.id,
          name: trimmedName,
          description: '',
          sort_order: subCategories.filter(sub => sub.categoryId === selectedCategory.id).length + 1,
          is_active: true
        }])
        .select()
        .single()

      if (error) {
        console.error('서브카테고리 추가 오류:', error)
        setMessage('서브카테고리 추가 중 오류가 발생했습니다.')
        return
      }

      const newSubCategory: SubCategoryItem = {
        value: trimmedName,
        label: trimmedName,
        count: 0,
        id: data.id,
        categoryId: selectedCategory.id
      }

      const updatedSubCategories = [...subCategories, newSubCategory]
      onCategoriesUpdate(categories, updatedSubCategories)
      
      setNewSubCategoryName('')
      setSelectedCategoryForSub('')
      setMessage('서브카테고리가 성공적으로 추가되었습니다.')
    } catch (error) {
      console.error('서브카테고리 추가 오류:', error)
      setMessage('서브카테고리 추가 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 카테고리 편집 시작
  const startEditCategory = (category: CategoryItem) => {
    setEditingCategory(category.value)
    setEditCategoryName(category.label)
  }

  // 서브카테고리 편집 시작
  const startEditSubCategory = (subCategory: CategoryItem) => {
    setEditingSubCategory(subCategory.value)
    setEditSubCategoryName(subCategory.label)
  }

  // 카테고리 편집 저장
  const handleSaveCategoryEdit = async () => {
    if (!editCategoryName.trim()) {
      setMessage('카테고리명을 입력해주세요.')
      return
    }

    const trimmedName = editCategoryName.trim()
    
    // 중복 확인 (자기 자신 제외)
    if (categories.some(cat => cat.value !== editingCategory && cat.value.toLowerCase() === trimmedName.toLowerCase())) {
      setMessage('이미 존재하는 카테고리입니다.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      // product_categories 테이블에서 카테고리명 업데이트
      const { error } = await supabase
        .from('product_categories')
        .update({ 
          name: trimmedName,
          updated_at: new Date().toISOString()
        })
        .eq('name', editingCategory)

      if (error) {
        console.error('카테고리 수정 오류:', error)
        setMessage('카테고리 수정 중 오류가 발생했습니다.')
        return
      }

      // products 테이블의 해당 카테고리도 업데이트
      const { error: productError } = await supabase
        .from('products')
        .update({ 
          category: trimmedName,
          updated_at: new Date().toISOString()
        })
        .eq('category', editingCategory)

      if (productError) {
        console.error('상품 카테고리 업데이트 오류:', productError)
        // 카테고리 테이블은 업데이트되었지만 상품 테이블 업데이트 실패
        setMessage('카테고리는 수정되었지만 일부 상품 업데이트에 실패했습니다.')
      }

      const updatedCategories = categories.map(cat => 
        cat.value === editingCategory 
          ? { ...cat, value: trimmedName, label: trimmedName }
          : cat
      )
      
      onCategoriesUpdate(updatedCategories, subCategories)
      
      setEditingCategory(null)
      setEditCategoryName('')
      setMessage('카테고리가 성공적으로 수정되었습니다.')
    } catch (error) {
      console.error('카테고리 수정 오류:', error)
      setMessage('카테고리 수정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 서브카테고리 편집 저장
  const handleSaveSubCategoryEdit = async () => {
    if (!editSubCategoryName.trim()) {
      setMessage('서브카테고리명을 입력해주세요.')
      return
    }

    const trimmedName = editSubCategoryName.trim()
    
    // 편집 중인 서브카테고리 찾기
    const editingSub = subCategories.find(sub => sub.value === editingSubCategory)
    if (!editingSub) {
      setMessage('편집 중인 서브카테고리를 찾을 수 없습니다.')
      return
    }

    // 같은 카테고리 내에서 중복 확인 (자기 자신 제외)
    if (subCategories.some(sub => 
      sub.value !== editingSubCategory && 
      sub.categoryId === editingSub.categoryId && 
      sub.value.toLowerCase() === trimmedName.toLowerCase()
    )) {
      setMessage('이미 존재하는 서브카테고리입니다.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      // product_sub_categories 테이블에서 서브카테고리명 업데이트
      const { error } = await supabase
        .from('product_sub_categories')
        .update({ 
          name: trimmedName,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSub.id)

      if (error) {
        console.error('서브카테고리 수정 오류:', error)
        setMessage('서브카테고리 수정 중 오류가 발생했습니다.')
        return
      }

      // products 테이블의 해당 서브카테고리도 업데이트
      const { error: productError } = await supabase
        .from('products')
        .update({ 
          sub_category: trimmedName,
          updated_at: new Date().toISOString()
        })
        .eq('sub_category', editingSubCategory)

      if (productError) {
        console.error('상품 서브카테고리 업데이트 오류:', productError)
        // 서브카테고리 테이블은 업데이트되었지만 상품 테이블 업데이트 실패
        setMessage('서브카테고리는 수정되었지만 일부 상품 업데이트에 실패했습니다.')
      }

      const updatedSubCategories = subCategories.map(sub => 
        sub.value === editingSubCategory 
          ? { ...sub, value: trimmedName, label: trimmedName }
          : sub
      )
      
      onCategoriesUpdate(categories, updatedSubCategories)
      
      setEditingSubCategory(null)
      setEditSubCategoryName('')
      setMessage('서브카테고리가 성공적으로 수정되었습니다.')
    } catch (error) {
      console.error('서브카테고리 수정 오류:', error)
      setMessage('서브카테고리 수정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 편집 취소
  const cancelEdit = () => {
    setEditingCategory(null)
    setEditingSubCategory(null)
    setEditCategoryName('')
    setEditSubCategoryName('')
    setMessage('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">카테고리 관리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('category')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'category'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            카테고리 관리
          </button>
          <button
            onClick={() => setActiveTab('subcategory')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'subcategory'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            서브카테고리 관리
          </button>
        </div>

        {/* 메시지 */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-lg text-sm ${
            message.includes('성공') || message.includes('추가') || message.includes('수정')
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* 컨텐츠 */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'category' ? (
            <div className="space-y-6">
              {/* 새 카테고리 추가 */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">새 카테고리 추가</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="카테고리명을 입력하세요"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                  <button
                    onClick={handleAddCategory}
                    disabled={saving || !newCategoryName.trim()}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors ${
                      saving || !newCategoryName.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    <span>추가</span>
                  </button>
                </div>
              </div>

              {/* 카테고리 목록 */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">기존 카테고리</h3>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category.value} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      {editingCategory === category.value ? (
                        <div className="flex items-center space-x-2 flex-1">
                          <input
                            type="text"
                            value={editCategoryName}
                            onChange={(e) => setEditCategoryName(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveCategoryEdit()}
                          />
                          <button
                            onClick={handleSaveCategoryEdit}
                            disabled={saving}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <span className="font-medium text-gray-900">{category.label}</span>
                            <span className="ml-2 text-sm text-gray-500">({category.count}개 상품)</span>
                          </div>
                          <button
                            onClick={() => startEditCategory(category)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-gray-500 text-center py-4">등록된 카테고리가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 새 서브카테고리 추가 */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">새 서브카테고리 추가</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 선택 *</label>
                    <select
                      value={selectedCategoryForSub}
                      onChange={(e) => setSelectedCategoryForSub(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">카테고리를 선택하세요</option>
                      {categories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newSubCategoryName}
                      onChange={(e) => setNewSubCategoryName(e.target.value)}
                      placeholder="서브카테고리명을 입력하세요"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSubCategory()}
                    />
                    <button
                      onClick={handleAddSubCategory}
                      disabled={saving || !newSubCategoryName.trim() || !selectedCategoryForSub}
                      className={`px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors ${
                        saving || !newSubCategoryName.trim() || !selectedCategoryForSub
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                      <span>추가</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 서브카테고리 목록 */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">기존 서브카테고리</h3>
                <div className="space-y-4">
                  {categories.map((category) => {
                    const categorySubCategories = subCategories.filter(sub => sub.categoryId === category.id)
                    if (categorySubCategories.length === 0) return null
                    
                    return (
                      <div key={category.id} className="border rounded-lg p-3">
                        <h4 className="font-medium text-gray-800 mb-2">{category.label}</h4>
                        <div className="space-y-2">
                          {categorySubCategories.map((subCategory) => (
                            <div key={subCategory.value} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              {editingSubCategory === subCategory.value ? (
                                <div className="flex items-center space-x-2 flex-1">
                                  <input
                                    type="text"
                                    value={editSubCategoryName}
                                    onChange={(e) => setEditSubCategoryName(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    onKeyPress={(e) => e.key === 'Enter' && handleSaveSubCategoryEdit()}
                                  />
                                  <button
                                    onClick={handleSaveSubCategoryEdit}
                                    disabled={saving}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex-1">
                                    <span className="font-medium text-gray-900">{subCategory.label}</span>
                                    <span className="ml-2 text-sm text-gray-500">({subCategory.count}개 상품)</span>
                                  </div>
                                  <button
                                    onClick={() => startEditSubCategory(subCategory)}
                                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {subCategories.length === 0 && (
                    <p className="text-gray-500 text-center py-4">등록된 서브카테고리가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
