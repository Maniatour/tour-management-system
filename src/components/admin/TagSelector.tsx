'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Check, X, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('tagTranslations')
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTagKey, setNewTagKey] = useState('')
  const [newTagTranslations, setNewTagTranslations] = useState<{ [locale: string]: { label: string; pronunciation?: string } }>({})
  const locales = ['ko', 'en'] // 지원하는 언어 목록

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
      // 발음에서 | 또는 쉼표로 구분된 첫 번째 발음 사용
      const pronunciation = translation.pronunciation || ''
      if (pronunciation) {
        return pronunciation.split(/[|,]/)[0].trim() || translation.label
      }
      return translation.label
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
    if (!newTagKey.trim()) {
      alert('태그 키를 입력해주세요.')
      return
    }

    const keyPattern = /^[a-z][a-z0-9_]*$/
    const trimmedKey = newTagKey.trim()
    
    // 태그 키 형식 검증
    if (!keyPattern.test(trimmedKey)) {
      alert('태그 키는 영문 소문자로 시작하고, 숫자와 언더스코어(_)만 사용할 수 있습니다.\n예: my_custom_tag, las_vegas')
      return
    }

    const normalizedKey = trimmedKey

    try {
      // 먼저 태그가 이미 존재하는지 확인
      const { data: existingTag, error: checkError } = await supabase
        .from('tags')
        .select('id, key')
        .eq('key', normalizedKey)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('태그 확인 오류:', checkError)
        alert('태그 확인 중 오류가 발생했습니다.')
        return
      }

      // 이미 존재하는 태그인 경우
      if (existingTag) {
        // 선택된 태그 목록에 이미 추가되어 있지 않으면 추가
        if (!selectedTags.includes(normalizedKey)) {
          onTagsChange([...selectedTags, normalizedKey])
          alert('이미 존재하는 태그입니다. 선택 목록에 추가되었습니다.')
        } else {
          alert('이미 존재하고 선택된 태그입니다.')
        }
        setNewTagKey('')
        setNewTagTranslations({})
        setShowAddModal(false)
        await fetchTags()
        return
      }

      // 태그가 없으면 새로 추가
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
          // 중복 키 오류가 발생한 경우 (다른 프로세스에서 동시에 추가된 경우)
          // 기존 태그를 다시 확인하여 선택 목록에 추가
          const { data: existingTagAfter } = await supabase
            .from('tags')
            .select('id, key')
            .eq('key', normalizedKey)
            .maybeSingle()

          if (existingTagAfter && !selectedTags.includes(normalizedKey)) {
            onTagsChange([...selectedTags, normalizedKey])
            alert('태그가 추가되었습니다. (다른 사용자가 동시에 추가한 경우 선택 목록에 추가되었습니다)')
          } else {
            alert('이미 존재하는 태그입니다.')
          }
          setNewTagKey('')
          setNewTagTranslations({})
          setShowAddModal(false)
          await fetchTags()
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

      // 번역 추가
      const translationsToInsert = Object.entries(newTagTranslations)
        .filter(([, trans]) => trans.label.trim()) // 번역이 있는 것만
        .map(([loc, trans]) => {
          // 발음에서 쉼표를 |로 변환하여 일관성 유지
          let pronunciation = trans.pronunciation?.trim() || null
          if (pronunciation) {
            pronunciation = pronunciation.replace(/,/g, '|')
          }
          return {
            id: crypto.randomUUID(),
            tag_id: newTag.id,
            locale: loc,
            label: trans.label.trim(),
            pronunciation: pronunciation
          }
        })

      if (translationsToInsert.length > 0) {
        const { error: translationError } = await supabase
          .from('tag_translations')
          .insert(translationsToInsert)

        if (translationError && translationError.code !== '23505') {
          console.error('태그 번역 추가 오류:', translationError)
        }
      }

      // 선택된 태그 목록에 추가
      onTagsChange([...selectedTags, normalizedKey])

      alert('태그가 추가되었습니다.')
      setNewTagKey('')
      setNewTagTranslations({})
      setShowAddModal(false)
      await fetchTags()
    } catch (error) {
      console.error('Error adding tag:', error)
      alert('태그 추가 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="space-y-2">
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

      {/* 새 태그 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{t('addTag') || '새 태그 추가'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('tagKey') || '태그 키'} ({t('tagKeyDescription') || '영어 소문자, 언더스코어만 허용'}) *
                </label>
                <input
                  type="text"
                  value={newTagKey}
                  onChange={(e) => {
                    const value = e.target.value
                    // 실시간으로 잘못된 문자 입력 제한 (선택사항)
                    setNewTagKey(value)
                  }}
                  placeholder={t('tagKeyPlaceholder') || '예: my_custom_tag'}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    newTagKey.trim() && !/^[a-z][a-z0-9_]*$/.test(newTagKey.trim())
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                  }`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('tagKeyDescription') || '영문 소문자로 시작, 숫자와 언더스코어(_)만 사용 가능합니다.'}
                </p>
                {newTagKey.trim() && !/^[a-z][a-z0-9_]*$/.test(newTagKey.trim()) && (
                  <p className="text-xs text-red-600 mt-1">
                    올바른 형식이 아닙니다. 영문 소문자로 시작하고, 숫자와 언더스코어(_)만 사용하세요.
                  </p>
                )}
              </div>

              {/* 언어별 번역 입력 */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">{t('translationAdd') || '번역 추가 (선택사항)'}</h4>
                <div className="space-y-3">
                  {locales.map(loc => (
                    <div key={loc} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="text-sm font-medium text-gray-700 flex items-center">
                        {loc.toUpperCase()}:
                      </div>
                      <div>
                        <input
                          type="text"
                          value={newTagTranslations[loc]?.label || ''}
                          onChange={(e) => {
                            setNewTagTranslations(prev => ({
                              ...prev,
                              [loc]: {
                                ...prev[loc],
                                label: e.target.value
                              }
                            }))
                          }}
                          placeholder={t('tagLabel') || '태그 이름'}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={newTagTranslations[loc]?.pronunciation || ''}
                          onChange={(e) => {
                            setNewTagTranslations(prev => ({
                              ...prev,
                              [loc]: {
                                ...prev[loc],
                                pronunciation: e.target.value
                              }
                            }))
                          }}
                          placeholder={t('pronunciationPlaceholder') || '발음 (선택사항)'}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {t('pronunciationInfo') || '발음은 여러 가지를 쉼표(,) 또는 |로 구분하여 입력할 수 있습니다. 예: "라스베이거스,라스베가스" 또는 "라스베이거스|라스베가스"'}
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddNewTag}
                disabled={!newTagKey.trim() || !/^[a-z][a-z0-9_]*$/.test(newTagKey.trim())}
                className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                  !newTagKey.trim() || !/^[a-z][a-z0-9_]*$/.test(newTagKey.trim())
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {t('add') || '추가'}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewTagKey('')
                  setNewTagTranslations({})
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                {t('cancel') || '취소'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
