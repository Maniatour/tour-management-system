'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Save, Globe, FileText, Users, Info, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { createClientSupabase } from '@/lib/supabase'
import LightRichEditor from '@/components/LightRichEditor'

interface Product {
  id: string
  name_ko: string
  name_en: string | null
  category: string | null
  sub_category: string | null
  base_price: number | null
  duration: string | null
  max_participants: number | null
  status: string | null
  tags: string[] | null
}

interface ProductDetails {
  id: string
  product_id: string
  slogan1: string
  slogan2: string
  slogan3: string
  description: string
  included: string
  not_included: string
  pickup_drop_info: string
  luggage_info: string
  tour_operation_info: string
  preparation_info: string
  small_group_info: string
  companion_info: string
  exclusive_booking_info: string
  cancellation_policy: string
  chat_announcement: string
}

export default function ProductDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('common')
  const tD = useTranslations('products.detailsPage')
  const productId = params.id as string
  const supabase = createClientSupabase()

  const [product, setProduct] = useState<Product | null>(null)
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<ProductDetails>({
    id: '',
    product_id: '',
    included: '',
    not_included: '',
    slogan1: '',
    slogan2: '',
    slogan3: '',
    description: '',
    pickup_drop_info: '',
    luggage_info: '',
    tour_operation_info: '',
    preparation_info: '',
    small_group_info: '',
    companion_info: '',
    exclusive_booking_info: '',
    cancellation_policy: '',
    chat_announcement: ''
  })

  useEffect(() => {
    if (productId) {
      loadProduct()
    }
  }, [productId])

  const loadProduct = async () => {
    try {
      setLoading(true)
      setError(null)

      // 상품 기본 정보 로드
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (productError) {
        throw productError
      }

      if (productData) {
        setProduct(productData)

        // 상품 세부정보 로드
        // 한국어 데이터를 기본으로 로드
        // channel_id가 NULL인 공통 정보를 우선적으로 가져오기
        let detailsData: any = null
        
        // 먼저 channel_id가 NULL인 공통 정보 조회
        const { data: commonDetails, error: commonError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('language_code', 'ko')
          .is('channel_id', null)
          .limit(1)
        
        if (!commonError && commonDetails && commonDetails.length > 0) {
          detailsData = commonDetails[0]
        } else {
          // 공통 정보가 없으면 channel_id가 있는 것 중 첫 번째 가져오기
          const { data: channelDetails, error: channelError } = await supabase
            .from('product_details_multilingual')
            .select('*')
            .eq('product_id', productId)
            .eq('language_code', 'ko')
            .limit(1)
          
          if (!channelError && channelDetails && channelDetails.length > 0) {
            detailsData = channelDetails[0]
          } else if (channelError && channelError.code !== 'PGRST116') {
            throw channelError
          }
        }

        if (detailsData) {
          setProductDetails(detailsData)
          setFormData({
            id: detailsData.id || '',
            product_id: detailsData.product_id || '',
            included: detailsData.included || '',
            not_included: detailsData.not_included || '',
            slogan1: detailsData.slogan1 || '',
            slogan2: detailsData.slogan2 || '',
            slogan3: detailsData.slogan3 || '',
            description: detailsData.description || '',
            pickup_drop_info: detailsData.pickup_drop_info || '',
            luggage_info: detailsData.luggage_info || '',
            tour_operation_info: detailsData.tour_operation_info || '',
            preparation_info: detailsData.preparation_info || '',
            small_group_info: detailsData.small_group_info || '',
            companion_info: detailsData.companion_info || '',
            exclusive_booking_info: detailsData.exclusive_booking_info || '',
            cancellation_policy: detailsData.cancellation_policy || '',
            chat_announcement: detailsData.chat_announcement || ''
          })
        } else {
          // 세부정보가 없으면 기본값으로 설정
          setFormData(prev => ({
            ...prev,
            product_id: productId
          }))
        }
      }
    } catch (error) {
      console.error('Error loading product:', error)
      setError(tD('loadError'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (productDetails) {
        // 기존 세부정보 업데이트 (한국어)
        const { error } = await supabase
          .from('product_details_multilingual')
          .update({
            ...formData,
            language_code: 'ko'
          })
          .eq('product_id', productId)
          .eq('language_code', 'ko')

        if (error) {
          throw error
        }
      } else {
        // 새로운 세부정보 생성 (한국어)
        const { error } = await supabase
          .from('product_details_multilingual')
          .insert({
            ...formData,
            language_code: 'ko'
          })

        if (error) {
          throw error
        }
      }

      alert('상품 정보가 성공적으로 저장되었습니다.')
      router.push(`/admin/products`)
    } catch (error) {
      console.error('Error saving product:', error)
      setError(tD('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof ProductDetails, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{tD('loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
          <Link href="/admin/products" className="mt-4 inline-block text-blue-600 hover:underline">
            {tD('backToList')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href="/admin/products"
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              {tD('productList')}
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {tD('pageTitle')}
          </h1>
          <p className="mt-2 text-gray-600">
            {product?.name_ko || product?.name_en || tD('productInfo')}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">{tD('sectionDetailInfo')}</h2>
          </div>

          <div className="p-6 space-y-8">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                {tD('sectionBasicInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('slogan1')}
                  </label>
                  <input
                    type="text"
                    value={formData.slogan1}
                    onChange={(e) => handleInputChange('slogan1', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderSlogan1')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('slogan2')}
                  </label>
                  <input
                    type="text"
                    value={formData.slogan2}
                    onChange={(e) => handleInputChange('slogan2', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderSlogan2')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('slogan3')}
                  </label>
                  <input
                    type="text"
                    value={formData.slogan3}
                    onChange={(e) => handleInputChange('slogan3', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderSlogan3')}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tD('description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={tD('placeholderDescription')}
              />
            </div>

            {/* Included/Not Included */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tD('included')}
                </label>
                <LightRichEditor
                  value={formData.included}
                  onChange={(value) => handleInputChange('included', value || '')}
                  height={150}
                  placeholder={tD('placeholderIncluded')}
                  enableResize={false}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tD('notIncluded')}
                </label>
                <LightRichEditor
                  value={formData.not_included}
                  onChange={(value) => handleInputChange('not_included', value || '')}
                  height={150}
                  placeholder={tD('placeholderNotIncluded')}
                  enableResize={false}
                />
              </div>
            </div>

            {/* Tour Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Info className="h-5 w-5 mr-2" />
                {tD('sectionTourInfo')}
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('pickupDropInfo')}
                  </label>
                  <textarea
                    value={formData.pickup_drop_info}
                    onChange={(e) => handleInputChange('pickup_drop_info', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderPickupDrop')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('luggageInfo')}
                  </label>
                  <textarea
                    value={formData.luggage_info}
                    onChange={(e) => handleInputChange('luggage_info', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderLuggage')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('tourOperationInfo')}
                  </label>
                  <textarea
                    value={formData.tour_operation_info}
                    onChange={(e) => handleInputChange('tour_operation_info', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderTourOperation')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('preparationInfo')}
                  </label>
                  <textarea
                    value={formData.preparation_info}
                    onChange={(e) => handleInputChange('preparation_info', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderPreparation')}
                  />
                </div>
              </div>
            </div>

            {/* Group Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                {tD('sectionGroupInfo')}
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('smallGroupInfo')}
                  </label>
                  <textarea
                    value={formData.small_group_info}
                    onChange={(e) => handleInputChange('small_group_info', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderSmallGroup')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('companionInfo')}
                  </label>
                  <textarea
                    value={formData.companion_info}
                    onChange={(e) => handleInputChange('companion_info', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderCompanion')}
                  />
                </div>
              </div>
            </div>

            {/* Booking and Policy Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Globe className="h-5 w-5 mr-2" />
                {tD('sectionBookingPolicy')}
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('exclusiveBookingInfo')}
                  </label>
                  <textarea
                    value={formData.exclusive_booking_info}
                    onChange={(e) => handleInputChange('exclusive_booking_info', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderExclusiveBooking')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tD('cancellationPolicy')}
                  </label>
                  <textarea
                    value={formData.cancellation_policy}
                    onChange={(e) => handleInputChange('cancellation_policy', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={tD('placeholderCancellation')}
                  />
                </div>
              </div>
            </div>

            {/* Chat Announcement */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {tD('sectionChatAnnouncement')}
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tD('chatAnnouncementLabel')}
                </label>
                <textarea
                  value={formData.chat_announcement}
                  onChange={(e) => handleInputChange('chat_announcement', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={tD('placeholderChatAnnouncement')}
                />
                <p className="mt-2 text-sm text-gray-500">
                  {tD('chatAnnouncementHint')}
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
