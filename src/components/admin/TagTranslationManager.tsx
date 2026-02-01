'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, Save, X, Upload, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import TranslationManager from './TranslationManager'
import JsonSyncManager from './JsonSyncManager'
import Image from 'next/image'

interface Tag {
  id: string
  key: string
  is_system: boolean
  icon_url?: string
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
  const t = useTranslations('tagTranslations')
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tags' | 'translations' | 'json'>('tags')
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
  const [newTagIconUrl, setNewTagIconUrl] = useState('')
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)
  const [unmigratedTags, setUnmigratedTags] = useState<string[]>([])
  const [showUnmigratedTags, setShowUnmigratedTags] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [editingIconTagId, setEditingIconTagId] = useState<string | null>(null)

  useEffect(() => {
    fetchTags()
    fetchUnmigratedTags()
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
          icon_url,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tagsWithTranslations = (tagsData || []).map((tag: any) => ({
        ...tag,
        icon_url: tag.icon_url,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        translations: ((tag.tag_translations as any[]) || []).reduce((acc: any, trans: any) => {
          acc[trans.locale] = {
            label: trans.label,
            pronunciation: trans.pronunciation,
            notes: trans.notes
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

      // 발음에서 쉼표를 |로 변환하여 일관성 유지
      let pronunciation = editingValues.pronunciation?.trim() || null
      if (pronunciation) {
        pronunciation = pronunciation.replace(/,/g, '|')
      }

      if (tagTransData) {
        // 업데이트
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from('tag_translations')
          .update({
            label: editingValues.label,
            pronunciation: pronunciation,
            notes: editingValues.notes || null
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .eq('id', (tagTransData as any).id)

        if (updateError) {
          console.error('Error updating translation:', updateError)
          return
        }
      } else {
        // 새로 생성
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase as any)
          .from('tag_translations')
          .insert({
            id: crypto.randomUUID(),
            tag_id: tag.id,
            locale: locale,
            label: editingValues.label,
            pronunciation: pronunciation,
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
    if (!confirm(t('deleteConfirm'))) return

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

  // 아이콘 업로드 함수
  const handleIconUpload = async (file: File, tagId?: string) => {
    if (!file) return null

    // 이미지 파일 검증
    if (!file.type.startsWith('image/')) {
      alert(t('imageOnly'))
      return null
    }

    // 파일 크기 제한 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert(t('fileSizeMax'))
      return null
    }

    setUploadingIcon(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${tagId || `new_${Date.now()}`}_${Date.now()}.${fileExt}`
      const filePath = `tag-icons/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('tag-icons')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Icon upload error:', uploadError)
        alert(t('iconUploadError'))
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('tag-icons')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Icon upload error:', error)
      alert(t('iconUploadError'))
      return null
    } finally {
      setUploadingIcon(false)
    }
  }

  // 새 태그용 아이콘 선택 핸들러
  const handleNewTagIconSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 미리보기 생성
    const reader = new FileReader()
    reader.onloadend = () => {
      setIconPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    const iconUrl = await handleIconUpload(file)
    if (iconUrl) {
      setNewTagIconUrl(iconUrl)
    }
  }

  // 기존 태그 아이콘 업데이트
  const handleUpdateTagIcon = async (tagId: string, file: File) => {
    const iconUrl = await handleIconUpload(file, tagId)
    if (!iconUrl) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('tags')
        .update({ icon_url: iconUrl })
        .eq('id', tagId)

      if (error) {
        console.error('Error updating tag icon:', error)
        alert(t('iconUpdateError'))
        return
      }

      await fetchTags()
      setEditingIconTagId(null)
      alert(t('iconUpdated'))
    } catch (error) {
      console.error('Error updating tag icon:', error)
    }
  }

  // 태그 아이콘 삭제
  const handleDeleteTagIcon = async (tagId: string) => {
    if (!confirm(t('deleteIconConfirm'))) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('tags')
        .update({ icon_url: null })
        .eq('id', tagId)

      if (error) {
        console.error('Error deleting tag icon:', error)
        alert(t('iconDeleteError'))
        return
      }

      await fetchTags()
      alert(t('iconDeleted'))
    } catch (error) {
      console.error('Error deleting tag icon:', error)
    }
  }

  const handleAddTag = async () => {
    if (!newTagKey.trim()) {
      alert(t('tagKeyRequired'))
      return
    }

    // 키 검증 (영어 소문자, 언더스코어만 허용)
    const keyPattern = /^[a-z][a-z0-9_]*$/
    if (!keyPattern.test(newTagKey.trim())) {
      alert(t('tagKeyInvalid'))
      return
    }

    try {
      // 태그 생성
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newTag, error: tagError } = await (supabase as any)
        .from('tags')
        .insert({
          id: crypto.randomUUID(),
          key: newTagKey.trim(),
          is_system: newTagIsSystem,
          icon_url: newTagIconUrl || null
        })
        .select()
        .single()

      if (tagError) {
        if (tagError.code === '23505') { // unique violation
          alert(t('tagExists'))
          return
        }
        console.error('Error adding tag:', tagError)
        return
      }

      // 번역 추가
      const translationsToInsert = Object.entries(newTagTranslations)
        .filter(([, trans]) => trans.label.trim()) // 번역이 있는 것만
        .map(([locale, trans]) => {
          // 발음에서 쉼표를 |로 변환하여 일관성 유지
          let pronunciation = trans.pronunciation?.trim() || null
          if (pronunciation) {
            pronunciation = pronunciation.replace(/,/g, '|')
          }
          return {
            id: crypto.randomUUID(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tag_id: (newTag as any).id,
            locale,
            label: trans.label.trim(),
            pronunciation: pronunciation,
            notes: trans.notes?.trim() || null
          }
        })

      if (translationsToInsert.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: translationError } = await (supabase as any)
          .from('tag_translations')
          .insert(translationsToInsert)

        if (translationError) {
          console.error('Error adding translations:', translationError)
          alert(t('noTranslationAdded'))
        }
      }

      alert(translationsToInsert.length > 0 
        ? t('addSuccess')
        : t('addTagSuccess'))
      
      setShowAddTagModal(false)
      setNewTagKey('')
      setNewTagIsSystem(false)
      setNewTagTranslations({})
      setNewTagIconUrl('')
      setIconPreview(null)
      await fetchTags()
      await fetchUnmigratedTags()
    } catch (error) {
      console.error('Error adding tag:', error)
      alert(t('addError'))
    }
  }

  // 기존 상품 태그 가져오기
  const fetchUnmigratedTags = async () => {
    try {
      // 모든 상품의 tags 배열에서 고유 태그 추출
      const { data: products, error } = await supabase
        .from('products')
        .select('tags')
        .not('tags', 'is', null)

      if (error) {
        console.error('Error fetching products:', error)
        return
      }

      // 모든 태그를 평탄화하고 중복 제거
      const allProductTags = new Set<string>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products?.forEach((product: any) => {
        if (product.tags && Array.isArray(product.tags)) {
          product.tags.forEach((tag: string) => {
            if (tag && typeof tag === 'string') {
              allProductTags.add(tag)
            }
          })
        }
      })

      // tags 테이블에 이미 존재하는 태그 키 가져오기
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingTags } = await (supabase as any)
        .from('tags')
        .select('key')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingTagKeys = new Set((existingTags || []).map((t: any) => t.key))

      // 마이그레이션되지 않은 태그만 필터링
      const unmigrated = Array.from(allProductTags).filter(tag => !existingTagKeys.has(tag))
      setUnmigratedTags(unmigrated)
    } catch (error) {
      console.error('Error fetching unmigrated tags:', error)
    }
  }

  // 기존 상품 태그를 tags 테이블로 마이그레이션
  const migrateProductTags = async () => {
    if (unmigratedTags.length === 0) {
      alert(t('noTagsToMigrate'))
      return
    }

    if (!confirm(t('migrateConfirm', { count: unmigratedTags.length }))) {
      return
    }

    setMigrating(true)
    try {
      let successCount = 0
      let errorCount = 0

      for (const tagKey of unmigratedTags) {
        // 태그 키 정규화
        const keyPattern = /^[a-z][a-z0-9_]*$/
        let normalizedKey = tagKey
        
        if (!keyPattern.test(tagKey)) {
          normalizedKey = tagKey
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^[^a-z]/, 'tag_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
          
          if (!normalizedKey) {
            normalizedKey = `tag_${Date.now()}`
          }
        }

        try {
          // 태그가 이미 존재하는지 확인
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: existingTag } = await (supabase as any)
            .from('tags')
            .select('id')
            .eq('key', normalizedKey)
            .maybeSingle()

          if (!existingTag) {
            // 태그 생성
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: newTag, error: tagError } = await (supabase as any)
              .from('tags')
              .insert({
                id: crypto.randomUUID(),
                key: normalizedKey,
                is_system: false
              })
              .select()
              .single()

            if (tagError) {
              if (tagError.code !== '23505') { // unique violation은 무시
                console.error(`태그 ${tagKey} 생성 오류:`, tagError)
                errorCount++
                continue
              }
            } else if (newTag) {
              // 원본 태그가 한글이거나 다른 형식인 경우 한국어 번역 추가
              if (tagKey !== normalizedKey) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error: translationError } = await (supabase as any)
                  .from('tag_translations')
                  .insert({
                    id: crypto.randomUUID(),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tag_id: (newTag as any).id,
                    locale: 'ko',
                    label: tagKey
                  })

                if (translationError && translationError.code !== '23505') {
                  console.error(`태그 ${tagKey} 번역 추가 오류:`, translationError)
                }
              }

              successCount++
            }
          } else {
            // 이미 존재하는 태그는 성공으로 간주
            successCount++
          }
        } catch (error) {
          console.error(`태그 ${tagKey} 처리 오류:`, error)
          errorCount++
        }
      }

      alert(t('migrateDone', { success: successCount, error: errorCount }))
      await fetchTags()
      await fetchUnmigratedTags()
    } catch (error) {
      console.error('마이그레이션 오류:', error)
      alert(t('migrateError'))
    } finally {
      setMigrating(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">{t('loading')}</div>
  }

  const locales = ['ko', 'en', 'ja', 'zh', 'es'] // 지원 언어

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold mb-4">{t('title')}</h2>
        
        {/* 탭 네비게이션 */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('tags')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'tags'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('tabTags')}
            </button>
            <button
              onClick={() => setActiveTab('translations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'translations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('tabTranslations')}
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'json'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('tabJsonSync')}
            </button>
          </nav>
        </div>
      </div>

      {/* 태그 관리 탭 */}
      {activeTab === 'tags' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">{t('title')}</h3>
            <div className="flex items-center space-x-2">
              {unmigratedTags.length > 0 && (
                <button
                  onClick={() => setShowUnmigratedTags(!showUnmigratedTags)}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 flex items-center space-x-2"
                >
                  <span>{t('unmigratedCount', { count: unmigratedTags.length })}</span>
                </button>
              )}
              <button
                onClick={() => setShowAddTagModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Plus size={20} />
                <span>{t('addTag')}</span>
              </button>
            </div>
          </div>

          {/* 기존 상품 태그 표시 */}
          {showUnmigratedTags && unmigratedTags.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-yellow-800">
                  {t('unmigratedTitle', { count: unmigratedTags.length })}
                </h4>
                <button
                  onClick={migrateProductTags}
                  disabled={migrating}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {migrating ? t('migrating') : t('migrateAll')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {unmigratedTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                {t('unmigratedDescription')}
              </p>
            </div>
          )}

          {/* 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 whitespace-pre-line">
              {t('pronunciationTooltip')}
            </p>
          </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('icon')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tagKey')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('system')} Tag
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
                  {/* 아이콘 셀 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {tag.icon_url ? (
                        <div className="relative group">
                          <Image
                            src={tag.icon_url}
                            alt={`${tag.key} icon`}
                            width={32}
                            height={32}
                            className="w-8 h-8 object-contain rounded"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                            <button
                              onClick={() => setEditingIconTagId(tag.id)}
                              className="text-white p-1 hover:text-blue-300"
                              title={t('iconChange')}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteTagIcon(tag.id)}
                              className="text-white p-1 hover:text-red-300"
                              title={t('iconDelete')}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingIconTagId(tag.id)}
                          className="w-8 h-8 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
                          title={t('iconAdd')}
                        >
                          <ImageIcon size={16} />
                        </button>
                      )}
                      {/* 아이콘 업로드 입력 */}
                      {editingIconTagId === tag.id && (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUpdateTagIcon(tag.id, file)
                          }}
                          className="text-xs w-24"
                        />
                      )}
                    </div>
                  </td>
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
                              placeholder="Translation"
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                            <input
                              type="text"
                              value={editingValues.pronunciation || ''}
                              onChange={(e) => setEditingValues({ ...editingValues, pronunciation: e.target.value })}
                              placeholder={t('pronunciationPlaceholder')}
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
                              <span>{translation?.label || t('noTranslation')}</span>
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
                                {t('pronunciation')}: {translation.pronunciation}
                              </div>
                            )}
                            {translation?.notes && (
                              <div className="text-xs text-gray-400">
                                {t('notes')}: {translation.notes}
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
            <h3 className="text-xl font-bold mb-4">{t('addTag')}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('tagKey')} ({t('tagKeyDescription')})
                </label>
                <input
                  type="text"
                  value={newTagKey}
                  onChange={(e) => setNewTagKey(e.target.value)}
                  placeholder={t('tagKeyPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('tagKeyDescription')}
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
                    <span className="font-medium text-gray-700">{t('systemTag')}</span>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('systemTagDescription1')}<br />
                      {t('systemTagDescription2')}<br />
                      {t('systemTagDescription3')}
                    </p>
                  </label>
                </div>
              </div>

              {/* 아이콘 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('tagIconOptional')}
                </label>
                <div className="flex items-center space-x-4">
                  {/* 미리보기 */}
                  <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                    {iconPreview || newTagIconUrl ? (
                      <Image
                        src={iconPreview || newTagIconUrl}
                        alt="Icon preview"
                        width={64}
                        height={64}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  
                  {/* 업로드 버튼 */}
                  <div className="flex-1">
                    <input
                      ref={iconInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleNewTagIconSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => iconInputRef.current?.click()}
                      disabled={uploadingIcon}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <Upload size={16} />
                      <span>{uploadingIcon ? t('uploading') : t('iconUpload')}</span>
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('iconFormatHint')}
                    </p>
                    {newTagIconUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewTagIconUrl('')
                          setIconPreview(null)
                        }}
                        className="text-xs text-red-600 hover:text-red-700 mt-1"
                      >
                        {t('removeIcon')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 언어별 번역 입력 */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">{t('translationAdd')}</h4>
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
                          placeholder={t('tagKey')}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={newTagTranslations[loc]?.pronunciation || ''}
                          onChange={(e) => updateNewTagTranslation(loc, 'pronunciation', e.target.value)}
                          placeholder={t('pronunciationPlaceholder')}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {t('pronunciationInfo')}
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddTag}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                {t('add')}
              </button>
              <button
                onClick={() => {
                  setShowAddTagModal(false)
                  setNewTagKey('')
                  setNewTagIsSystem(false)
                  setNewTagTranslations({})
                  setNewTagIconUrl('')
                  setIconPreview(null)
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* 번역 관리 탭 */}
      {activeTab === 'translations' && (
        <TranslationManager locale={locale} />
      )}

      {/* JSON 동기화 탭 */}
      {activeTab === 'json' && (
        <JsonSyncManager locale={locale} />
      )}
    </div>
  )
}
