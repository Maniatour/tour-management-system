'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Tag {
  id: string
  key: string
  is_system: boolean
  translations: {
    [locale: string]: {
      label: string
      pronunciation?: string
      notes?: string
    }
  }
}

interface TagTranslationManagerProps {
  locale: string
}

export default function TagTranslationManager({ locale }: TagTranslationManagerProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editingLocale, setEditingLocale] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<{ label: string; pronunciation?: string; notes?: string }>({
    label: '',
    pronunciation: '',
    notes: ''
  })
  const [showAddTagModal, setShowAddTagModal] = useState(false)
  const [newTagKey, setNewTagKey] = useState('')
  const [newTagIsSystem, setNewTagIsSystem] = useState(false)
  const [newTagTranslations, setNewTagTranslations] = useState<{ [locale: string]: { label: string; pronunciation?: string; notes?: string } }>({})

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    try {
      setLoading(true)
      const { data: tagsData, error } = await supabase
        .from('tags')
        .select(`
          id,
          key,
          is_system,
          tag_translations (
            locale,
            label,
            pronunciation,
            notes
          )
        `)
        .order('key', { ascending: true })

      if (error) {
        console.error('Error fetching tags:', error)
        return
      }

      // 데이터 구조 변환
      const tagsWithTranslations = tagsData?.map(tag => ({
        ...tag,
        translations: (tag.tag_translations as any[]).reduce((acc, trans) => {
          acc[trans.locale] = {
            label: trans.label,
            pronunciation: trans.pronunciation,
            notes: trans.notes
          }
          return acc
        }, {})
      })) || []

      setTags(tagsWithTranslations)
    } catch (error) {
      console.error('Error fetching tags:', error)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (tagKey: string, locale: string) => {
    const tag = tags.find(t => t.key === tagKey)
    const translation = tag?.translations[locale]
    
    setEditingTag(tagKey)
    setEditingLocale(locale)
    setEditingValues({
      label: translation?.label || '',
      pronunciation: translation?.pronunciation || '',
      notes: translation?.notes || ''
    })
  }

  const cancelEdit = () => {
    setEditingTag(null)
    setEditingLocale(null)
    setEditingValues({ label: '', pronunciation: '', notes: '' })
  }

  const saveTranslation = async (tagKey: string, locale: string) => {
    try {
      const tag = tags.find(t => t.key === tagKey)
      if (!tag) return

      const { data: tagTransData, error: checkError } = await supabase
        .from('tag_translations')
        .select('id')
        .eq('tag_id', tag.id)
        .eq('locale', locale)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking translation:', checkError)
        return
      }

      if (tagTransData) {
        // 업데이트
        const { error: updateError } = await supabase
          .from('tag_translations')
          .update({
            label: editingValues.label,
            pronunciation: editingValues.pronunciation || null,
            notes: editingValues.notes || null
          })
          .eq('id', tagTransData.id)

        if (updateError) {
          console.error('Error updating translation:', updateError)
          return
        }
      } else {
        // 새로 생성
        const { error: insertError } = await supabase
          .from('tag_translations')
          .insert({
            id: crypto.randomUUID(),
            tag_id: tag.id,
            locale: locale,
            label: editingValues.label,
            pronunciation: editingValues.pronunciation || null,
            notes: editingValues.notes || null
          })

        if (insertError) {
          console.error('Error inserting translation:', insertError)
          return
        }
      }

      await fetchTags()
      cancelEdit()
    } catch (error) {
      console.error('Error saving translation:', error)
    }
  }

  const deleteTranslation = async (tagKey: string, locale: string) => {
    if (!confirm('이 번역을 삭제하시겠습니까?')) return

    try {
      const tag = tags.find(t => t.key === tagKey)
      if (!tag) return

      const { error } = await supabase
        .from('tag_translations')
        .delete()
        .eq('tag_id', tag.id)
        .eq('locale', locale)

      if (error) {
        console.error('Error deleting translation:', error)
        return
      }

      await fetchTags()
    } catch (error) {
      console.error('Error deleting translation:', error)
    }
  }

  const updateNewTagTranslation = (locale: string, field: 'label' | 'pronunciation' | 'notes', value: string) => {
    setNewTagTranslations(prev => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        [field]: value
      }
    }))
  }

  const handleAddTag = async () => {
    if (!newTagKey.trim()) {
      alert('태그 키를 입력해주세요.')
      return
    }

    // 키 검증 (영어 소문자, 언더스코어만 허용)
    const keyPattern = /^[a-z][a-z0-9_]*$/
    if (!keyPattern.test(newTagKey.trim())) {
      alert('태그 키는 영어 소문자로 시작하고, 숫자와 언더스코어(_)만 사용할 수 있습니다.\n예: my_new_tag, las_vegas')
      return
    }

    try {
      // 태그 생성
      const { data: newTag, error: tagError } = await supabase
        .from('tags')
        .insert({
          id: crypto.randomUUID(),
          key: newTagKey.trim(),
          is_system: newTagIsSystem
        })
        .select()
        .single()

      if (tagError) {
        if (tagError.code === '23505') { // unique violation
          alert('이미 존재하는 태그 키입니다.')
          return
        }
        console.error('Error adding tag:', tagError)
        return
      }

      // 번역 추가
      const translationsToInsert = Object.entries(newTagTranslations)
        .filter(([_, trans]) => trans.label.trim()) // 번역이 있는 것만
        .map(([locale, trans]) => ({
          id: crypto.randomUUID(),
          tag_id: newTag.id,
          locale,
          label: trans.label.trim(),
          pronunciation: trans.pronunciation?.trim() || null,
          notes: trans.notes?.trim() || null
        }))

      if (translationsToInsert.length > 0) {
        const { error: translationError } = await supabase
          .from('tag_translations')
          .insert(translationsToInsert)

        if (translationError) {
          console.error('Error adding translations:', translationError)
          alert('태그는 추가되었지만 번역 추가 중 오류가 발생했습니다.')
        }
      }

      alert(translationsToInsert.length > 0 
        ? '태그와 번역이 성공적으로 추가되었습니다.' 
        : '태그가 추가되었습니다. 번역을 추가할 수 있습니다.')
      
      setShowAddTagModal(false)
      setNewTagKey('')
      setNewTagIsSystem(false)
      setNewTagTranslations({})
      await fetchTags()
    } catch (error) {
      console.error('Error adding tag:', error)
      alert('태그 추가 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>
  }

  const locales = ['ko', 'en', 'ja', 'zh', 'es'] // 지원 언어

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">태그 번역 관리</h2>
        <button
          onClick={() => setShowAddTagModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>새 태그 추가</span>
        </button>
      </div>

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>발음(pronunciation)</strong> 필드에는 여러 발음을 세로바(|)로 구분하여 입력할 수 있습니다.<br />
          예: "라스베가스|라스베이거스" 또는 "그랜드 캐니언|그랜드 캐니온"
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  태그 키
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  시스템 태그
                </th>
                {locales.map(loc => (
                  <th key={loc} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {loc.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tags.map((tag) => (
                <tr key={tag.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tag.key}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {tag.is_system ? '✓' : '-'}
                  </td>
                  {locales.map(loc => {
                    const translation = tag.translations[loc]
                    const isEditing = editingTag === tag.key && editingLocale === loc

                    return (
                      <td key={loc} className="px-6 py-4 text-sm text-gray-500">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingValues.label}
                              onChange={(e) => setEditingValues({ ...editingValues, label: e.target.value })}
                              placeholder="번역 입력"
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                            <input
                              type="text"
                              value={editingValues.pronunciation || ''}
                              onChange={(e) => setEditingValues({ ...editingValues, pronunciation: e.target.value })}
                              placeholder="발음 (선택) 예: 라스베가스|라스베이거스"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => saveTranslation(tag.key, loc)}
                                className="p-1 text-green-600 hover:text-green-900"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span>{translation?.label || '-'}</span>
                              <button
                                onClick={() => startEdit(tag.key, loc)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit2 size={14} />
                              </button>
                              {translation && (
                                <button
                                  onClick={() => deleteTranslation(tag.key, loc)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            {translation?.pronunciation && (
                              <div className="text-xs text-gray-400">
                                발음: {translation.pronunciation}
                              </div>
                            )}
                            {translation?.notes && (
                              <div className="text-xs text-gray-400">
                                메모: {translation.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 새 태그 추가 모달 */}
      {showAddTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">새 태그 추가</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  태그 키 (영어 소문자, 언더스코어 사용)
                </label>
                <input
                  type="text"
                  value={newTagKey}
                  onChange={(e) => setNewTagKey(e.target.value)}
                  placeholder="예: my_custom_tag"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  영문 소문자로 시작, 숫자와 언더스코어(_)만 사용 가능
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="isSystem"
                    checked={newTagIsSystem}
                    onChange={(e) => setNewTagIsSystem(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  />
                  <label htmlFor="isSystem" className="ml-2 block text-sm">
                    <span className="font-medium text-gray-700">시스템 태그로 만들기</span>
                    <p className="text-xs text-gray-600 mt-1">
                      ✓ 시스템 태그: 자동 생성되는 기본 태그 (예: popular, new, recommended)<br />
                      ✓ 사용자 태그: 사용자가 직접 만드는 커스텀 태그<br />
                      ✓ 현재 기능상 차이는 없으며, 구분을 위한 마킹 목적입니다.
                    </p>
                  </label>
                </div>
              </div>

              {/* 언어별 번역 입력 */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">번역 추가 (선택사항)</h4>
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
                          onChange={(e) => updateNewTagTranslation(loc, 'label', e.target.value)}
                          placeholder={`${loc.toUpperCase()} 번역`}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={newTagTranslations[loc]?.pronunciation || ''}
                          onChange={(e) => updateNewTagTranslation(loc, 'pronunciation', e.target.value)}
                          placeholder="발음 (예: 발음1|발음2)"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 번역은 나중에 추가할 수도 있습니다. 꼭 입력하지 않아도 됩니다.
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddTag}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
              <button
                onClick={() => {
                  setShowAddTagModal(false)
                  setNewTagKey('')
                  setNewTagIsSystem(false)
                  setNewTagTranslations({})
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
