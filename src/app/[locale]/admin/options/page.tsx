'use client'

import { useState, use, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Settings, DollarSign, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Option = Database['public']['Tables']['options']['Row']
type OptionInsert = Database['public']['Tables']['options']['Insert']
type OptionUpdate = Database['public']['Tables']['options']['Update']

interface AdminOptionsProps {
  params: Promise<{ locale: string }>
}

export default function AdminOptions({ params }: AdminOptionsProps) {
  const { locale } = use(params)
  const t = useTranslations('options')
  const tCommon = useTranslations('common')
  
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingOption, setEditingOption] = useState<Option | null>(null)

  // Supabase에서 옵션 데이터 가져오기
  useEffect(() => {
    fetchOptions()
  }, [])

  const fetchOptions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching options:', error)
        return
      }

      setOptions(data || [])
    } catch (error) {
      console.error('Error fetching options:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (option.tags && option.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  )

  const handleAddOption = async (option: Omit<Option, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('options')
        .insert([option])
        .select()

      if (error) {
        console.error('Error adding option:', error)
        return
      }

      if (data) {
        setOptions([data[0], ...options])
      }
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding option:', error)
    }
  }

  const handleEditOption = async (option: Omit<Option, 'id' | 'created_at'>) => {
    if (editingOption) {
      try {
        const { error } = await supabase
          .from('options')
          .update(option)
          .eq('id', editingOption.id)

        if (error) {
          console.error('Error updating option:', error)
          return
        }

        setOptions(options.map(o => o.id === editingOption.id ? { ...o, ...option } : o))
        setEditingOption(null)
      } catch (error) {
        console.error('Error updating option:', error)
      }
    }
  }

  const handleDeleteOption = async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      try {
        const { error } = await supabase
          .from('options')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting option:', error)
          return
        }

        setOptions(options.filter(o => o.id !== id))
      } catch (error) {
        console.error('Error deleting option:', error)
      }
    }
  }

  const getCategoryLabel = (category: string) => {
    return t(`options.categories.${category}`)
  }

  const getPriceTypeLabel = (priceType: string) => {
    return t(`options.priceTypes.${priceType}`)
  }

  const getStatusLabel = (status: string) => {
    return t(`options.status.${status}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'seasonal': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'guide': return 'bg-blue-100 text-blue-800'
      case 'transportation': return 'bg-green-100 text-green-800'
      case 'meal': return 'bg-orange-100 text-orange-800'
      case 'insurance': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{tCommon('loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>{t('addOption')}</span>
        </button>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* 옵션 목록 */}
      <div className="bg-white rounded-lg shadow-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.name')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.category')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.description')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.price')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.priceType')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.quantity')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('columns.tags')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOptions.map((option) => (
                <tr key={option.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Settings className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{option.name}</div>
                        <div className="text-sm text-gray-500">ID: {option.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(option.category)}`}>
                      {getCategoryLabel(option.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate" title={option.description}>
                      {option.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm">
                        <DollarSign className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">가격:</span>
                        <span className="text-gray-900">${option.base_price}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-gray-600">가격 유형:</span>
                        <span className="text-gray-900">{option.price_type}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {getPriceTypeLabel(option.price_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {option.min_quantity} - {option.max_quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(option.status)}`}>
                      {getStatusLabel(option.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {option.tags && option.tags.length > 0 ? (
                        option.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm">태그 없음</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingOption(option)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteOption(option.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 옵션 추가/편집 모달 */}
      {(showAddForm || editingOption) && (
        <OptionForm
          option={editingOption}
          onSubmit={editingOption ? handleEditOption : handleAddOption}
          onCancel={() => {
            setShowAddForm(false)
            setEditingOption(null)
          }}
        />
      )}
    </div>
  )
}

interface OptionFormProps {
  option?: Option | null
  onSubmit: (option: Omit<Option, 'id' | 'created_at'>) => void
  onCancel: () => void
}

function OptionForm({ option, onSubmit, onCancel }: OptionFormProps) {
  const t = useTranslations('options')
  const tCommon = useTranslations('common')
  
  const [formData, setFormData] = useState({
    name: option?.name || '',
    category: option?.category || 'guide',
    description: option?.description || '',
    base_price: option?.base_price || 0,
    price_type: option?.price_type || 'perPerson' as 'perPerson' | 'perTour' | 'perHour' | 'fixed',
    min_quantity: option?.min_quantity || 1,
    max_quantity: option?.max_quantity || 10,
    status: option?.status || 'active' as 'active' | 'inactive' | 'seasonal',
    tags: option?.tags || []
  })

  const [newTag, setNewTag] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      })
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {option ? t('form.editTitle') : t('form.title')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.category')}</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="guide">{t('categories.guide')}</option>
                <option value="transportation">{t('categories.transportation')}</option>
                <option value="meal">{t('categories.meal')}</option>
                <option value="insurance">{t('categories.insurance')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 가격 설정 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.basePrice')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.base_price}
                  onChange={(e) => setFormData({
                      ...formData,
                      base_price: Number(e.target.value)
                    })}
                    min="0"
                    step="0.01"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.priceType')}</label>
              <select
                value={formData.price_type}
                                  onChange={(e) => setFormData({ ...formData, price_type: e.target.value as 'perPerson' | 'perTour' | 'perHour' | 'fixed' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="perPerson">{t('priceTypes.perPerson')}</option>
                <option value="perTour">{t('priceTypes.perTour')}</option>
                <option value="perHour">{t('priceTypes.perHour')}</option>
                <option value="fixed">{t('priceTypes.fixed')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.minQuantity')}</label>
              <input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: Number(e.target.value) })}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.maxQuantity')}</label>
              <input
                type="number"
                value={formData.max_quantity}
                onChange={(e) => setFormData({ ...formData, max_quantity: Number(e.target.value) })}
                min={formData.min_quantity}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.status')}</label>
            <select
              value={formData.status}
                              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'seasonal' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">{t('status.active')}</option>
              <option value="inactive">{t('status.inactive')}</option>
              <option value="seasonal">{t('status.seasonal')}</option>
            </select>
          </div>

          {/* 태그 관리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.tags')}</label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('form.addTagPlaceholder')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('form.addTag')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {option ? tCommon('edit') : tCommon('add')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
