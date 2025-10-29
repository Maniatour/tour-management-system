'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

interface Translation {
  id: string
  namespace: string
  key_path: string
  is_system: boolean
  values: {
    [locale: string]: {
      value: string
      notes?: string
    }
  }
}

interface TranslationManagerProps {
  locale: string
}

export default function TranslationManager({ locale }: TranslationManagerProps) {
  const t = useTranslations('tagTranslations')
  const [translations, setTranslations] = useState<Translation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all')
  const [editingTranslation, setEditingTranslation] = useState<string | null>(null)
  const [editingLocale, setEditingLocale] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newNamespace, setNewNamespace] = useState('')
  const [newKeyPath, setNewKeyPath] = useState('')
  const [newTranslations, setNewTranslations] = useState<{ [locale: string]: string }>({})
  const [collapsedNamespaces, setCollapsedNamespaces] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchTranslations()
  }, [])

  const fetchTranslations = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('translations')
        .select(`
          id,
          namespace,
          key_path,
          is_system,
          translation_values (
            locale,
            value,
            notes
          )
        `)
        .order('namespace', { ascending: true })
        .order('key_path', { ascending: true })

      if (error) {
        console.error('Error fetching translations:', error)
        return
      }

      // 데이터 구조 변환
      const translationsWithValues = (data || []).map((trans: any) => ({
        ...trans,
        values: (trans.translation_values || []).reduce((acc: any, val: any) => {
          acc[val.locale] = {
            value: val.value,
            notes: val.notes
          }
          return acc
        }, {})
      }))

      setTranslations(translationsWithValues)
    } catch (error) {
      console.error('Error fetching translations:', error)
    } finally {
      setLoading(false)
    }
  }

  const namespaces = ['all', ...Array.from(new Set(translations.map(t => t.namespace))).sort()]
  const locales = ['ko', 'en', 'ja', 'zh', 'es']

  const filteredTranslations = translations.filter(t => {
    const matchesSearch = 
      t.namespace.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.key_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Object.values(t.values).some(v => v.value.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesNamespace = selectedNamespace === 'all' || t.namespace === selectedNamespace
    
    return matchesSearch && matchesNamespace
  })

  // 네임스페이스별로 그룹화
  const groupedTranslations = filteredTranslations.reduce((acc, translation) => {
    const ns = translation.namespace
    if (!acc[ns]) {
      acc[ns] = []
    }
    acc[ns].push(translation)
    return acc
  }, {} as Record<string, Translation[]>)

  const namespaceGroups = Object.keys(groupedTranslations).sort()

  const toggleNamespace = (namespace: string) => {
    setCollapsedNamespaces(prev => {
      const newSet = new Set(prev)
      if (newSet.has(namespace)) {
        newSet.delete(namespace)
      } else {
        newSet.add(namespace)
      }
      return newSet
    })
  }

  const startEdit = (translationId: string, loc: string) => {
    const translation = translations.find(t => t.id === translationId)
    const value = translation?.values[loc]
    
    setEditingTranslation(translationId)
    setEditingLocale(loc)
    setEditingValue(value?.value || '')
  }

  const cancelEdit = () => {
    setEditingTranslation(null)
    setEditingLocale(null)
    setEditingValue('')
  }

  const saveTranslation = async (translationId: string, loc: string) => {
    try {
      const translation = translations.find(t => t.id === translationId)
      if (!translation) return

      const { data: transValueData, error: checkError } = await supabase
        .from('translation_values')
        .select('id')
        .eq('translation_id', translation.id)
        .eq('locale', loc)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking translation:', checkError)
        return
      }

      if (transValueData) {
        const { error: updateError } = await (supabase as any)
          .from('translation_values')
          .update({
            value: editingValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', (transValueData as any).id)

        if (updateError) {
          console.error('Error updating translation:', updateError)
          alert(t('saveError'))
          return
        }
      } else {
        const { error: insertError } = await (supabase as any)
          .from('translation_values')
          .insert({
            id: crypto.randomUUID(),
            translation_id: translation.id,
            locale: loc,
            value: editingValue
          })

        if (insertError) {
          console.error('Error inserting translation:', insertError)
          alert(t('saveError'))
          return
        }
      }

      await fetchTranslations()
      cancelEdit()
    } catch (error) {
      console.error('Error saving translation:', error)
      alert(t('saveError'))
    }
  }

  const deleteTranslation = async (translationId: string, loc: string) => {
    if (!confirm(t('deleteConfirm'))) return

    try {
      const translation = translations.find(t => t.id === translationId)
      if (!translation) return

      const { error } = await supabase
        .from('translation_values')
        .delete()
        .eq('translation_id', translation.id)
        .eq('locale', loc)

      if (error) {
        console.error('Error deleting translation:', error)
        return
      }

      await fetchTranslations()
    } catch (error) {
      console.error('Error deleting translation:', error)
    }
  }

  const handleAddTranslation = async () => {
    if (!newNamespace.trim() || !newKeyPath.trim()) {
      alert('네임스페이스와 키를 입력해주세요.')
      return
    }

    try {
      // 새 번역 키 추가
      const { data: newTranslation, error: transError } = await (supabase as any)
        .from('translations')
        .insert({
          id: crypto.randomUUID(),
          namespace: newNamespace.trim(),
          key_path: newKeyPath.trim(),
          is_system: false
        })
        .select()
        .single()

      if (transError) {
        if (transError.code === '23505') {
          alert('이미 존재하는 번역 키입니다.')
          return
        }
        console.error('Error adding translation:', transError)
        alert('번역 키 추가 중 오류가 발생했습니다.')
        return
      }

      // 번역 값들 추가
      const translationsToInsert = Object.entries(newTranslations)
        .filter(([_, value]) => value.trim())
        .map(([locale, value]) => ({
          id: crypto.randomUUID(),
          translation_id: (newTranslation as any).id,
          locale,
          value: value.trim()
        }))

      if (translationsToInsert.length > 0) {
        const { error: translationError } = await (supabase as any)
          .from('translation_values')
          .insert(translationsToInsert)

        if (translationError) {
          console.error('Error inserting translations:', translationError)
          alert('번역 추가 중 오류가 발생했습니다.')
          return
        }
      }

      alert('번역 키가 추가되었습니다.')
      setShowAddModal(false)
      setNewNamespace('')
      setNewKeyPath('')
      setNewTranslations({})
      await fetchTranslations()
    } catch (error) {
      console.error('Error adding translation:', error)
      alert('번역 키 추가 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">번역 관리</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>새 번역 키 추가</span>
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="네임스페이스, 키, 내용으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={selectedNamespace}
          onChange={(e) => setSelectedNamespace(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {namespaces.map(ns => (
            <option key={ns} value={ns}>{ns === 'all' ? '전체' : ns}</option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        {namespaceGroups.map((namespace) => {
          const isCollapsed = collapsedNamespaces.has(namespace)
          return (
            <div key={namespace} className="bg-white rounded-lg shadow overflow-hidden">
              <button
                onClick={() => toggleNamespace(namespace)}
                className="w-full bg-gray-100 px-6 py-3 border-b border-gray-200 hover:bg-gray-200 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  {isCollapsed ? (
                    <ChevronRight size={20} className="text-gray-600" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-600" />
                  )}
                  <div className="text-left">
                    <h4 className="text-lg font-semibold text-gray-900">{namespace}</h4>
                    <p className="text-sm text-gray-500">{groupedTranslations[namespace].length}개의 번역</p>
                  </div>
                </div>
              </button>
              {!isCollapsed && (
                <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">키</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시스템</th>
                    {locales.map(loc => (
                      <th key={loc} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{loc.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groupedTranslations[namespace].map((translation) => (
                    <tr key={translation.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {translation.key_path}
                      </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {translation.is_system ? '✓' : '-'}
                  </td>
                  {locales.map(loc => {
                    const isEditing = editingTranslation === translation.id && editingLocale === loc
                    const value = translation.values[loc]

                    return (
                      <td key={loc} className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => saveTranslation(translation.id, loc)}
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
                          <div className="flex items-center justify-between">
                            <span className="truncate">{value?.value || t('noTranslation')}</span>
                            <div className="flex space-x-1 ml-2 flex-shrink-0">
                              <button
                                onClick={() => startEdit(translation.id, loc)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit2 size={14} />
                              </button>
                              {value && (
                                <button
                                  onClick={() => deleteTranslation(translation.id, loc)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
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
              )}
            </div>
          )
        })}
        </div>

      {/* 새 번역 키 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">새 번역 키 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">네임스페이스</label>
                <input
                  type="text"
                  value={newNamespace}
                  onChange={(e) => setNewNamespace(e.target.value)}
                  placeholder="예: common, options"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">키</label>
                <input
                  type="text"
                  value={newKeyPath}
                  onChange={(e) => setNewKeyPath(e.target.value)}
                  placeholder="예: myNewKey, form.title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">번역 추가</h4>
                <div className="space-y-3">
                  {locales.map(loc => (
                    <div key={loc} className="flex items-center space-x-2">
                      <div className="w-12 text-sm font-medium text-gray-700">{loc.toUpperCase()}:</div>
                      <input
                        type="text"
                        value={newTranslations[loc] || ''}
                        onChange={(e) => setNewTranslations(prev => ({
                          ...prev,
                          [loc]: e.target.value
                        }))}
                        placeholder={`${loc.toUpperCase()} 번역 입력`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  번역 키를 먼저 추가한 후, 필요에 따라 각 언어별 번역을 추가할 수 있습니다.
                </p>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddTranslation}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewNamespace('')
                  setNewKeyPath('')
                  setNewTranslations({})
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

