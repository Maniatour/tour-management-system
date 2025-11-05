'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Check, X, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Tag {
  id: string
  key: string
  translations: {
    [locale: string]: {
      label: string
      pronunciation?: string
    }
  }
}

interface TagSelectorProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  locale?: string
  placeholder?: string
  maxDisplay?: number
}

/**
 * 중앙 관리 태그 선택 컴포넌트
 * 
 * 사용법:
 * <TagSelector 
 *   selectedTags={formData.tags} 
 *   onTagsChange={(tags) => setFormData({...formData, tags})}
 *   locale="ko"
 * />
 */
export default function TagSelector({ 
  selectedTags, 
  onTagsChange, 
  locale = 'ko',
  placeholder = '태그를 선택하세요',
  maxDisplay = Infinity 
}: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTagKey, setNewTagKey] = useState('')

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tags')
        .select(`
          id,
          key,
          tag_translations (
            locale,
            label,
            pronunciation
          )
        `)
        .order('key', { ascending: true })

      if (error) {
        console.error('Error fetching tags:', error)
        return
      }

      const tagsWithTranslations = (data || []).map(tag => ({
        ...tag,
        translations: (tag.tag_translations as any[]).reduce((acc, trans) => {
          acc[trans.locale] = {
            label: trans.label,
            pronunciation: trans.pronunciation
          }
          return acc
        }, {})
      }))

      setTags(tagsWithTranslations)
    } catch (error) {
      console.error('Error fetching tags:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTagLabel = (tag: Tag) => {
    const translation = tag.translations[locale]
    if (translation?.label) {
      return translation.pronunciation?.split('|')[0] || translation.label
    }
    return tag.key
  }

  const filteredTags = tags.filter(tag => 
    tag.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getTagLabel(tag).toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleTagToggle = (tagKey: string) => {
    if (selectedTags.includes(tagKey)) {
      onTagsChange(selectedTags.filter(t => t !== tagKey))
    } else {
      onTagsChange([...selectedTags, tagKey])
    }
  }

  const handleAddNewTag = async () => {
    if (!newTagKey.trim()) return

    const keyPattern = /^[a-z][a-z0-9_]*$/
    let normalizedKey = newTagKey.trim()
    
    // 태그 키 형식이 아니면 변환
    if (!keyPattern.test(normalizedKey)) {
      normalizedKey = normalizedKey
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^[^a-z]/, 'tag_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      
      if (!normalizedKey) {
        normalizedKey = `tag_${Date.now()}`
      }
      
      // 사용자에게 변환된 키를 알림
      if (normalizedKey !== newTagKey.trim()) {
        if (!confirm(`태그 키가 "${normalizedKey}"로 변환됩니다. 계속하시겠습니까?`)) {
          return
        }
      }
    }

    try {
      // 태그 추가
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({
          id: crypto.randomUUID(),
          key: normalizedKey,
          is_system: false
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          alert('이미 존재하는 태그입니다.')
          return
        }
        console.error('Error adding tag:', error)
        alert('태그 추가 중 오류가 발생했습니다.')
        return
      }

      // 원본 키가 한글이거나 다른 언어인 경우 한국어 번역 자동 추가
      if (newTagKey.trim() !== normalizedKey) {
        const { error: translationError } = await supabase
          .from('tag_translations')
          .insert({
            id: crypto.randomUUID(),
            tag_id: newTag.id,
            locale: locale,
            label: newTagKey.trim()
          })

        if (translationError && translationError.code !== '23505') {
          console.error('태그 번역 추가 오류:', translationError)
        }
      }

      // 선택된 태그 목록에 추가
      onTagsChange([...selectedTags, normalizedKey])

      alert('태그가 추가되었습니다.')
      setNewTagKey('')
      setShowAddModal(false)
      await fetchTags()
    } catch (error) {
      console.error('Error adding tag:', error)
      alert('태그 추가 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="space-y-2">
      {/* 선택된 태그들 */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.slice(0, maxDisplay).map(tagKey => {
            const tag = tags.find(t => t.key === tagKey)
            return (
              <span
                key={tagKey}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
              >
                {tag ? getTagLabel(tag) : tagKey}
                <button
                  onClick={() => handleTagToggle(tagKey)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                  type="button"
                >
                  <X size={14} />
                </button>
              </span>
            )
          })}
          {selectedTags.length > maxDisplay && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
              +{selectedTags.length - maxDisplay}
            </span>
          )}
        </div>
      )}

      {/* 태그 선택 드롭다운 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span className={selectedTags.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
            {selectedTags.length === 0 ? placeholder : `${selectedTags.length}개 선택됨`}
          </span>
          <Search size={16} />
        </button>

        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
            {/* 검색 입력 */}
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="태그 검색..."
                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* 태그 목록 */}
            <div className="max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">로딩 중...</div>
              ) : filteredTags.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다' : '태그가 없습니다'}
                </div>
              ) : (
                <ul className="py-1">
                  {filteredTags.map(tag => (
                    <li key={tag.id}>
                      <button
                        type="button"
                        onClick={() => handleTagToggle(tag.key)}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between ${
                          selectedTags.includes(tag.key) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span>{getTagLabel(tag)}</span>
                        {selectedTags.includes(tag.key) && (
                          <Check size={16} className="text-blue-600" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 새 태그 추가 버튼 */}
            <div className="border-t border-gray-200 p-2">
              <button
                type="button"
                onClick={() => {
                  setShowDropdown(false)
                  setShowAddModal(true)
                }}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                <Plus size={16} />
                <span>새 태그 추가</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 새 태그 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">새 태그 추가</h3>
            <input
              type="text"
              value={newTagKey}
              onChange={(e) => setNewTagKey(e.target.value)}
              placeholder="예: my_custom_tag"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddNewTag()
                }
              }}
            />
            <div className="flex space-x-3">
              <button
                onClick={handleAddNewTag}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewTagKey('')
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
