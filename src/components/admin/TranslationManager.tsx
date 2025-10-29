'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, Search } from 'lucide-react'
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
        const { error: updateError } = await supabase
          .from('translation_values')
          .update({
            value: editingValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', transValueData.id)

        if (updateError) {
          console.error('Error updating translation:', updateError)
          alert(t('saveError'))
          return
        }
      } else {
        const { error: insertError } = await supabase
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

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">번역 관리</h3>
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">네임스페이스</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">키</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시스템</th>
                {locales.map(loc => (
                  <th key={loc} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{loc.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTranslations.map((translation) => (
                <tr key={translation.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {translation.namespace}
                  </td>
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
      </div>
    </div>
  )
}

