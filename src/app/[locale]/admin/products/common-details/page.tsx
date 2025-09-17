'use client'

import React, { useEffect, useState } from 'react'
import { use } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import Link from 'next/link'
import { Save, Plus, Trash2, ArrowLeft } from 'lucide-react'

interface CommonDetailsRow {
  id?: string
  sub_category: string
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

interface PageProps {
  params: Promise<{ locale: string }>
}

export default function CommonDetailsAdminPage({ params }: PageProps) {
  const { locale } = use(params)
  // const router = useRouter()
  const supabase = createClientSupabase()

  const [rows, setRows] = useState<CommonDetailsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>('')

  const fetchRows = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('product_details_common')
        .select('*')
        .order('sub_category', { ascending: true })

      if (error) throw error
      type Row = Partial<CommonDetailsRow> & { id: string; sub_category: string }
      setRows(
        (data as Row[] | null || []).map((r) => ({
          id: r.id,
          sub_category: r.sub_category || '',
          slogan1: r.slogan1 || '',
          slogan2: r.slogan2 || '',
          slogan3: r.slogan3 || '',
          description: r.description || '',
          included: r.included || '',
          not_included: r.not_included || '',
          pickup_drop_info: r.pickup_drop_info || '',
          luggage_info: r.luggage_info || '',
          tour_operation_info: r.tour_operation_info || '',
          preparation_info: r.preparation_info || '',
          small_group_info: r.small_group_info || '',
          companion_info: r.companion_info || '',
          exclusive_booking_info: r.exclusive_booking_info || '',
          cancellation_policy: r.cancellation_policy || '',
          chat_announcement: r.chat_announcement || '',
        }))
      )
    } catch (e: unknown) {
      const err = e as { message?: string }
      setMessage(`불러오기 실패: ${err?.message || '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        sub_category: '',
        slogan1: '',
        slogan2: '',
        slogan3: '',
        description: '',
        included: '',
        not_included: '',
        pickup_drop_info: '',
        luggage_info: '',
        tour_operation_info: '',
        preparation_info: '',
        small_group_info: '',
        companion_info: '',
        exclusive_booking_info: '',
        cancellation_policy: '',
        chat_announcement: ''
      }
    ])
  }

  const updateField = (index: number, field: keyof CommonDetailsRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const removeRow = async (index: number) => {
    const row = rows[index]
    try {
      if (row.id) {
        const { error } = await supabase
          .from('product_details_common')
          .delete()
          .eq('id', row.id)
        if (error) throw error
      }
      setRows(prev => prev.filter((_, i) => i !== index))
    } catch (e: unknown) {
      const err = e as { message?: string }
      setMessage(`삭제 실패: ${err?.message || '알 수 없는 오류'}`)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      // sub_category 유니크 보장: 공백 제외 중복 검증
      const seen = new Set<string>()
      for (const r of rows) {
        const key = (r.sub_category || '').trim()
        if (!key) throw new Error('sub_category는 필수입니다.')
        if (seen.has(key)) throw new Error(`중복된 sub_category: ${key}`)
        seen.add(key)
      }

      // upsert 처리: id 있으면 update, 없으면 insert
      for (const r of rows) {
        const payload = {
          sub_category: r.sub_category.trim(),
          slogan1: r.slogan1,
          slogan2: r.slogan2,
          slogan3: r.slogan3,
          description: r.description,
          included: r.included,
          not_included: r.not_included,
          pickup_drop_info: r.pickup_drop_info,
          luggage_info: r.luggage_info,
          tour_operation_info: r.tour_operation_info,
          preparation_info: r.preparation_info,
          small_group_info: r.small_group_info,
          companion_info: r.companion_info,
          exclusive_booking_info: r.exclusive_booking_info,
          cancellation_policy: r.cancellation_policy,
          chat_announcement: r.chat_announcement
        }

        if (r.id) {
          const { error } = await supabase
            .from('product_details_common')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', r.id)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('product_details_common')
            .insert([payload])
            .select()
            .single()
          if (error) throw error
          r.id = data?.id
        }
      }

      setMessage('저장되었습니다.')
      setTimeout(() => setMessage(''), 2000)
    } catch (e: unknown) {
      const err = e as { message?: string }
      setMessage(`저장 실패: ${err?.message || '알 수 없는 오류'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href={`/${locale}/admin/products`} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="inline h-5 w-5 mr-1" />
            뒤로가기
          </Link>
          <h1 className="text-2xl font-bold">공통 세부정보 관리</h1>
        </div>
        <div className="flex items-center space-x-2">
          {message && <span className="text-sm text-gray-600">{message}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            <Save className="inline h-4 w-4 mr-1" /> 저장
          </button>
          <button
            onClick={addRow}
            className="px-3 py-2 bg-gray-100 rounded-lg"
          >
            <Plus className="inline h-4 w-4 mr-1" /> 추가
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">불러오는 중...</div>
      ) : (
        <div className="space-y-6">
          {rows.map((row, idx) => (
            <div key={row.id || idx} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">sub_category</label>
                  <input
                    type="text"
                    value={row.sub_category}
                    onChange={(e) => updateField(idx, 'sub_category', e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="예: daytour, admission, private"
                  />
                </div>
                <button onClick={() => removeRow(idx)} className="text-red-600 px-2 py-2">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">슬로건 1</label>
                  <input type="text" value={row.slogan1} onChange={(e) => updateField(idx, 'slogan1', e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">슬로건 2</label>
                  <input type="text" value={row.slogan2} onChange={(e) => updateField(idx, 'slogan2', e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">슬로건 3</label>
                  <input type="text" value={row.slogan3} onChange={(e) => updateField(idx, 'slogan3', e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품 설명</label>
                <textarea value={row.description} onChange={(e) => updateField(idx, 'description', e.target.value)} className="w-full px-3 py-2 border rounded" rows={3} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">포함 사항</label>
                  <textarea value={row.included} onChange={(e) => updateField(idx, 'included', e.target.value)} className="w-full px-3 py-2 border rounded" rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">불포함 사항</label>
                  <textarea value={row.not_included} onChange={(e) => updateField(idx, 'not_included', e.target.value)} className="w-full px-3 py-2 border rounded" rows={3} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">픽업/드롭 정보</label>
                  <textarea value={row.pickup_drop_info} onChange={(e) => updateField(idx, 'pickup_drop_info', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">수하물 정보</label>
                  <textarea value={row.luggage_info} onChange={(e) => updateField(idx, 'luggage_info', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">투어 운영 정보</label>
                  <textarea value={row.tour_operation_info} onChange={(e) => updateField(idx, 'tour_operation_info', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">준비 사항</label>
                  <textarea value={row.preparation_info} onChange={(e) => updateField(idx, 'preparation_info', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">소그룹 정보</label>
                  <textarea value={row.small_group_info} onChange={(e) => updateField(idx, 'small_group_info', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">동반자 정보</label>
                  <textarea value={row.companion_info} onChange={(e) => updateField(idx, 'companion_info', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">독점 예약 정보</label>
                  <textarea value={row.exclusive_booking_info} onChange={(e) => updateField(idx, 'exclusive_booking_info', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">취소 정책</label>
                  <textarea value={row.cancellation_policy} onChange={(e) => updateField(idx, 'cancellation_policy', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">채팅 공지사항</label>
                <textarea value={row.chat_announcement} onChange={(e) => updateField(idx, 'chat_announcement', e.target.value)} className="w-full px-3 py-2 border rounded" rows={2} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


