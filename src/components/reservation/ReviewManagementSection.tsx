'use client'

import React, { useState, useEffect } from 'react'
import { Star, Plus, Edit, Trash2, MessageSquare, Image as ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Review {
  id: string
  reservation_id: string
  platform: string
  rating: number
  content: string | null
  has_photo: boolean
  created_at: string
  updated_at: string
}

interface ReviewManagementSectionProps {
  reservationId: string
}

export default function ReviewManagementSection({ reservationId }: ReviewManagementSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [formData, setFormData] = useState({
    platform: '',
    rating: 5,
    content: '',
    has_photo: false
  })

  // 후기 목록 조회
  const fetchReviews = async () => {
    if (!reservationId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('reservation_reviews')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('후기 조회 오류:', error)
        return
      }

      setReviews(data || [])
    } catch (error) {
      console.error('후기 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [reservationId])

  // 후기 추가/수정
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.platform || !formData.rating) {
      alert('플랫폼과 별점을 입력해주세요.')
      return
    }

    try {
      if (editingReview) {
        // 수정
        const { error } = await supabase
          .from('reservation_reviews')
          .update({
            platform: formData.platform,
            rating: formData.rating,
            content: formData.content || null,
            has_photo: formData.has_photo,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingReview.id)

        if (error) throw error
      } else {
        // 추가
        const { error } = await supabase
          .from('reservation_reviews')
          .insert({
            reservation_id: reservationId,
            platform: formData.platform,
            rating: formData.rating,
            content: formData.content || null,
            has_photo: formData.has_photo
          })

        if (error) throw error
      }

      // 폼 초기화
      setFormData({
        platform: '',
        rating: 5,
        content: '',
        has_photo: false
      })
      setShowAddForm(false)
      setEditingReview(null)
      fetchReviews()
    } catch (error: any) {
      console.error('후기 저장 오류:', error)
      alert('후기 저장 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    }
  }

  // 후기 삭제
  const handleDelete = async (reviewId: string) => {
    if (!confirm('이 후기를 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('reservation_reviews')
        .delete()
        .eq('id', reviewId)

      if (error) throw error

      fetchReviews()
    } catch (error: any) {
      console.error('후기 삭제 오류:', error)
      alert('후기 삭제 중 오류가 발생했습니다.')
    }
  }

  // 수정 모드로 전환
  const handleEdit = (review: Review) => {
    setEditingReview(review)
    setFormData({
      platform: review.platform,
      rating: review.rating,
      content: review.content || '',
      has_photo: review.has_photo
    })
    setShowAddForm(true)
  }

  // 폼 취소
  const handleCancel = () => {
    setShowAddForm(false)
    setEditingReview(null)
    setFormData({
      platform: '',
      rating: 5,
      content: '',
      has_photo: false
    })
  }

  // 별점 표시
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center flex-wrap gap-0.5 sm:gap-1">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-3 h-3 sm:w-4 sm:h-4 ${
                star <= rating
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          ))}
        </div>
        <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-600 whitespace-nowrap">({rating}점)</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
          후기 관리
        </h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-2 py-1.5 sm:px-3 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            후기 추가
          </button>
        )}
      </div>

      {/* 후기 추가/수정 폼 */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                플랫폼 *
              </label>
              <input
                type="text"
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                placeholder="예: 구글, TripAdvisor 등"
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                별점 *
              </label>
              <div className="flex items-center flex-wrap gap-1 sm:gap-2">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="focus:outline-none p-0.5 sm:p-1"
                    >
                      <Star
                        className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 ${
                          star <= formData.rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        } hover:text-yellow-400 transition-colors`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs sm:text-sm text-gray-600 ml-1 sm:ml-2 whitespace-nowrap">({formData.rating}점)</span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                후기 내용
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="후기 내용을 입력하세요..."
                rows={3}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.has_photo}
                  onChange={(e) => setFormData({ ...formData, has_photo: e.target.checked })}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-xs sm:text-sm text-gray-700 flex items-center">
                  <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  사진 첨부됨
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 mt-3 sm:mt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {editingReview ? '수정' : '추가'}
            </button>
          </div>
        </form>
      )}

      {/* 후기 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm">등록된 후기가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="p-3 sm:p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-2 sm:gap-0">
                <div className="flex-1 w-full sm:w-auto min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="text-xs sm:text-sm font-medium text-gray-900 break-words">
                        {review.platform}
                      </span>
                      {renderStars(review.rating)}
                      {review.has_photo && (
                        <span className="flex items-center text-xs text-blue-600 whitespace-nowrap">
                          <ImageIcon className="w-3 h-3 mr-1" />
                          사진
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(review.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  {review.content && (
                    <p className="text-xs sm:text-sm text-gray-700 mt-2 whitespace-pre-wrap break-words">
                      {review.content}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2 sm:ml-4 flex-shrink-0 self-start sm:self-center">
                  <button
                    onClick={() => handleEdit(review)}
                    className="p-1 sm:p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="수정"
                  >
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(review.id)}
                    className="p-1 sm:p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
