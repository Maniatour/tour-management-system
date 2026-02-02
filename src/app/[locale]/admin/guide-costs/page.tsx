'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Calendar, DollarSign, Save, X, History, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import GuideCostHistory from '@/components/GuideCostHistory'

interface GuideCost {
  id: string
  product_id: string
  team_type: '1_guide' | '2_guides' | 'guide_driver'
  guide_fee: number
  assistant_fee: number
  driver_fee: number
  effective_from: string
  effective_to: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Product {
  id: string
  name: string
  sub_category: string
  product_guide_costs: GuideCost[]
}

interface GuideCostFormData {
  productId: string
  teamType: '1_guide' | '2_guides' | 'guide_driver'
  guideFee: number
  assistantFee: number
  driverFee: number
  effectiveFrom: string
  effectiveTo: string
}

export default function GuideCostManagementPage() {
  const { authUser } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCost, setEditingCost] = useState<GuideCost | null>(null)
  const [formData, setFormData] = useState<GuideCostFormData>({
    productId: '',
    teamType: '1_guide',
    guideFee: 0,
    assistantFee: 0,
    driverFee: 0,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: ''
  })
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [inlineEditData, setInlineEditData] = useState<Partial<GuideCost>>({})
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [rowEditData, setRowEditData] = useState<{
    '1_guide': Partial<GuideCost>
    '2_guides': Partial<GuideCost>
    'guide_driver': Partial<GuideCost>
  }>({
    '1_guide': {},
    '2_guides': {},
    'guide_driver': {}
  })
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false)
  const [globalEditData, setGlobalEditData] = useState<Record<string, {
    '1_guide': Partial<GuideCost>
    '2_guides': Partial<GuideCost>
    'guide_driver': Partial<GuideCost>
  }>>({})
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<{id: string, name: string} | null>(null)
  const [note, setNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  // 권한 체크
  const checkAdminPermission = async () => {
    if (!authUser?.email) return
    
    try {
      const { data: teamData, error } = await supabase
        .from('team')
        .select('position')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .maybeSingle()
      
      if (error || !teamData) {
        setIsAdmin(false)
        return
      }
      
      const position = (teamData as any).position?.toLowerCase()
      const isAdminUser = position === 'super' || position === 'admin' || position === 'op'
      
      setIsAdmin(isAdminUser)
    } catch (error) {
      console.error('권한 체크 오류:', error)
      setIsAdmin(false)
    }
  }

  // 상품 목록 로드
  const loadProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/guide-costs')
      const data = await response.json()
      
      if (!response.ok) {
        console.error('API 응답 오류:', response.status, data)
        throw new Error(data.error || `HTTP ${response.status} 오류`)
      }
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setProducts(data.products || [])
    } catch (error) {
      console.error('상품 목록 로드 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      alert(`상품 목록을 불러오는 중 오류가 발생했습니다.\n\n오류 내용: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // 노트 로드
  const loadNote = async () => {
    try {
      const response = await fetch('/api/guide-costs/notes')
      const data = await response.json()
      
      if (!response.ok) {
        console.error('노트 로드 오류:', response.status, data)
        return
      }
      
      if (data.error) {
        console.error('노트 로드 오류:', data.error)
        return
      }
      
      setNote(data.note || '')
    } catch (error) {
      console.error('노트 로드 오류:', error)
    }
  }

  // 노트 저장
  const saveNote = async () => {
    try {
      setNoteSaving(true)
      const response = await fetch('/api/guide-costs/notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note })
      })

      const data = await response.json()
      
      if (!response.ok || data.error) {
        const errorMessage = data.error || '노트 저장 중 오류가 발생했습니다.'
        const errorDetails = data.details ? `\n\n상세: ${data.details}` : ''
        throw new Error(errorMessage + errorDetails)
      }

      alert('노트가 저장되었습니다.')
    } catch (error) {
      console.error('노트 저장 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '노트 저장 중 오류가 발생했습니다.'
      alert(`노트 저장 실패\n\n${errorMessage}\n\n데이터베이스 마이그레이션이 실행되었는지 확인해주세요.`)
    } finally {
      setNoteSaving(false)
    }
  }

  // 가이드비 저장
  const handleSave = async () => {
    try {
      setSaving(true)
      
      const url = editingCost ? '/api/guide-costs' : '/api/guide-costs'
      const method = editingCost ? 'PUT' : 'POST'
      
      const body = editingCost 
        ? {
            id: editingCost.id,
            guideFee: formData.guideFee,
            assistantFee: formData.assistantFee,
            driverFee: formData.driverFee,
            effectiveFrom: formData.effectiveFrom,
            effectiveTo: formData.effectiveTo || null
          }
        : {
            productId: formData.productId,
            teamType: formData.teamType,
            guideFee: formData.guideFee,
            assistantFee: formData.assistantFee,
            driverFee: formData.driverFee,
            effectiveFrom: formData.effectiveFrom,
            effectiveTo: formData.effectiveTo || null
          }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      alert(editingCost ? '가이드비가 수정되었습니다.' : '가이드비가 설정되었습니다.')
      setShowModal(false)
      setEditingCost(null)
      resetForm()
      loadProducts()
    } catch (error) {
      console.error('가이드비 저장 오류:', error)
      alert('가이드비 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 가이드비 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 가이드비 설정을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/guide-costs?id=${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      alert('가이드비가 삭제되었습니다.')
      loadProducts()
    } catch (error) {
      console.error('가이드비 삭제 오류:', error)
      alert('가이드비 삭제 중 오류가 발생했습니다.')
    }
  }

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      productId: '',
      teamType: '1_guide',
      guideFee: 0,
      assistantFee: 0,
      driverFee: 0,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: ''
    })
  }

  // 편집 모드 열기
  const openEditModal = (cost: GuideCost) => {
    setEditingCost(cost)
    setFormData({
      productId: cost.product_id,
      teamType: cost.team_type,
      guideFee: cost.guide_fee,
      assistantFee: cost.assistant_fee,
      driverFee: cost.driver_fee,
      effectiveFrom: cost.effective_from,
      effectiveTo: cost.effective_to || ''
    })
    setShowModal(true)
  }

  // 새 가이드비 모달 열기
  const openNewModal = (productId: string) => {
    resetForm()
    setFormData(prev => ({ ...prev, productId }))
    setEditingCost(null)
    setShowModal(true)
  }

  // 인라인 편집 시작
  const startInlineEdit = (cost: GuideCost) => {
    setEditingRow(cost.id)
    setInlineEditData({
      guide_fee: cost.guide_fee,
      assistant_fee: cost.assistant_fee,
      driver_fee: cost.driver_fee,
      effective_from: cost.effective_from,
      effective_to: cost.effective_to
    })
  }

  // 인라인 편집 취소
  const cancelInlineEdit = () => {
    setEditingRow(null)
    setInlineEditData({})
  }

  // 인라인 편집 저장
  const saveInlineEdit = async (costId: string) => {
    try {
      setSaving(true)
      
      const response = await fetch('/api/guide-costs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: costId,
          guideFee: inlineEditData.guide_fee,
          assistantFee: inlineEditData.assistant_fee,
          driverFee: inlineEditData.driver_fee,
          effectiveFrom: inlineEditData.effective_from,
          effectiveTo: inlineEditData.effective_to || null
        })
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      alert('가이드비가 수정되었습니다.')
      setEditingRow(null)
      setInlineEditData({})
      loadProducts()
    } catch (error) {
      console.error('가이드비 수정 오류:', error)
      alert('가이드비 수정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 행 편집 시작
  const startRowEdit = (productId: string, costsByType: any) => {
    setEditingProductId(productId)
    setRowEditData({
      '1_guide': costsByType['1_guide'] ? {
        guide_fee: costsByType['1_guide'].guide_fee,
        effective_from: costsByType['1_guide'].effective_from,
        effective_to: costsByType['1_guide'].effective_to
      } : {
        guide_fee: 0,
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: null
      },
      '2_guides': costsByType['2_guides'] ? {
        guide_fee: costsByType['2_guides'].guide_fee,
        assistant_fee: costsByType['2_guides'].assistant_fee,
        effective_from: costsByType['2_guides'].effective_from,
        effective_to: costsByType['2_guides'].effective_to
      } : {
        guide_fee: 0,
        assistant_fee: 0,
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: null
      },
      'guide_driver': costsByType['guide_driver'] ? {
        guide_fee: costsByType['guide_driver'].guide_fee,
        driver_fee: costsByType['guide_driver'].driver_fee,
        effective_from: costsByType['guide_driver'].effective_from,
        effective_to: costsByType['guide_driver'].effective_to
      } : {
        guide_fee: 0,
        driver_fee: 0,
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: null
      }
    })
  }

  // 행 편집 취소
  const cancelRowEdit = () => {
    setEditingProductId(null)
    setRowEditData({
      '1_guide': {},
      '2_guides': {},
      'guide_driver': {}
    })
  }

  // 행 편집 저장
  const saveRowEdit = async () => {
    if (!editingProductId) return

    try {
      setSaving(true)
      
      // 각 팀 타입별로 저장
      const savePromises = []
      
      // 1가이드 저장
      if (rowEditData['1_guide'].guide_fee !== undefined) {
        const existingCost = products.find(p => p.id === editingProductId)
          ?.product_guide_costs?.find(c => c.team_type === '1_guide')
        
        if (existingCost) {
          // 기존 가이드비 수정
          savePromises.push(
            fetch('/api/guide-costs', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: existingCost.id,
                guideFee: rowEditData['1_guide'].guide_fee,
                assistantFee: 0,
                driverFee: 0,
                effectiveFrom: rowEditData['1_guide'].effective_from,
                effectiveTo: rowEditData['1_guide'].effective_to || null
              })
            })
          )
        } else if (rowEditData['1_guide'].guide_fee! > 0) {
          // 새 가이드비 생성
          savePromises.push(
            fetch('/api/guide-costs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: editingProductId,
                teamType: '1_guide',
                guideFee: rowEditData['1_guide'].guide_fee,
                assistantFee: 0,
                driverFee: 0,
                effectiveFrom: rowEditData['1_guide'].effective_from,
                effectiveTo: rowEditData['1_guide'].effective_to || null
              })
            })
          )
        }
      }

      // 2가이드 저장
      if (rowEditData['2_guides'].guide_fee !== undefined) {
        const existingCost = products.find(p => p.id === editingProductId)
          ?.product_guide_costs?.find(c => c.team_type === '2_guides')
        
        if (existingCost) {
          // 기존 가이드비 수정
          savePromises.push(
            fetch('/api/guide-costs', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: existingCost.id,
                guideFee: rowEditData['2_guides'].guide_fee,
                assistantFee: rowEditData['2_guides'].assistant_fee,
                driverFee: 0,
                effectiveFrom: rowEditData['2_guides'].effective_from,
                effectiveTo: rowEditData['2_guides'].effective_to || null
              })
            })
          )
        } else if (rowEditData['2_guides'].guide_fee! > 0 || rowEditData['2_guides'].assistant_fee! > 0) {
          // 새 가이드비 생성
          savePromises.push(
            fetch('/api/guide-costs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: editingProductId,
                teamType: '2_guides',
                guideFee: rowEditData['2_guides'].guide_fee,
                assistantFee: rowEditData['2_guides'].assistant_fee,
                driverFee: 0,
                effectiveFrom: rowEditData['2_guides'].effective_from,
                effectiveTo: rowEditData['2_guides'].effective_to || null
              })
            })
          )
        }
      }

      // 가이드+드라이버 저장
      if (rowEditData['guide_driver'].guide_fee !== undefined) {
        const existingCost = products.find(p => p.id === editingProductId)
          ?.product_guide_costs?.find(c => c.team_type === 'guide_driver')
        
        if (existingCost) {
          // 기존 가이드비 수정
          savePromises.push(
            fetch('/api/guide-costs', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: existingCost.id,
                guideFee: rowEditData['guide_driver'].guide_fee,
                assistantFee: 0,
                driverFee: rowEditData['guide_driver'].driver_fee,
                effectiveFrom: rowEditData['guide_driver'].effective_from,
                effectiveTo: rowEditData['guide_driver'].effective_to || null
              })
            })
          )
        } else if (rowEditData['guide_driver'].guide_fee! > 0 || rowEditData['guide_driver'].driver_fee! > 0) {
          // 새 가이드비 생성
          savePromises.push(
            fetch('/api/guide-costs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: editingProductId,
                teamType: 'guide_driver',
                guideFee: rowEditData['guide_driver'].guide_fee,
                assistantFee: 0,
                driverFee: rowEditData['guide_driver'].driver_fee,
                effectiveFrom: rowEditData['guide_driver'].effective_from,
                effectiveTo: rowEditData['guide_driver'].effective_to || null
              })
            })
          )
        }
      }

      // 모든 저장 작업 실행
      const responses = await Promise.all(savePromises)
      
      // 응답 확인
      for (const response of responses) {
        const data = await response.json()
        if (data.error) {
          throw new Error(data.error)
        }
      }

      alert('가이드비가 저장되었습니다.')
      cancelRowEdit()
      loadProducts()
    } catch (error) {
      console.error('가이드비 저장 오류:', error)
      alert('가이드비 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 전체 테이블 편집 시작
  const startGlobalEdit = () => {
    const initialData: Record<string, {
      '1_guide': Partial<GuideCost>
      '2_guides': Partial<GuideCost>
      'guide_driver': Partial<GuideCost>
    }> = {}

    products.forEach(product => {
      const costsByType = {
        '1_guide': product.product_guide_costs?.find(c => c.team_type === '1_guide'),
        '2_guides': product.product_guide_costs?.find(c => c.team_type === '2_guides'),
        'guide_driver': product.product_guide_costs?.find(c => c.team_type === 'guide_driver')
      }

      initialData[product.id] = {
        '1_guide': costsByType['1_guide'] ? {
          guide_fee: costsByType['1_guide'].guide_fee,
          effective_from: costsByType['1_guide'].effective_from,
          effective_to: costsByType['1_guide'].effective_to
        } : {
          guide_fee: 0,
          effective_from: new Date().toISOString().split('T')[0],
          effective_to: null
        },
        '2_guides': costsByType['2_guides'] ? {
          guide_fee: costsByType['2_guides'].guide_fee,
          assistant_fee: costsByType['2_guides'].assistant_fee,
          effective_from: costsByType['2_guides'].effective_from,
          effective_to: costsByType['2_guides'].effective_to
        } : {
          guide_fee: 0,
          assistant_fee: 0,
          effective_from: new Date().toISOString().split('T')[0],
          effective_to: null
        },
        'guide_driver': costsByType['guide_driver'] ? {
          guide_fee: costsByType['guide_driver'].guide_fee,
          driver_fee: costsByType['guide_driver'].driver_fee,
          effective_from: costsByType['guide_driver'].effective_from,
          effective_to: costsByType['guide_driver'].effective_to
        } : {
          guide_fee: 0,
          driver_fee: 0,
          effective_from: new Date().toISOString().split('T')[0],
          effective_to: null
        }
      }
    })

    setGlobalEditData(initialData)
    setIsGlobalEditMode(true)
  }

  // 전체 테이블 편집 취소
  const cancelGlobalEdit = () => {
    setIsGlobalEditMode(false)
    setGlobalEditData({})
  }

  // 전체 테이블 저장
  const saveGlobalEdit = async () => {
    try {
      setSaving(true)
      
      const savePromises = []
      
      // 모든 상품의 모든 팀 타입별로 저장
      Object.entries(globalEditData).forEach(([productId, productData]) => {
        // 1가이드 저장
        if (productData['1_guide'].guide_fee !== undefined) {
          const existingCost = products.find(p => p.id === productId)
            ?.product_guide_costs?.find(c => c.team_type === '1_guide')
          
          if (existingCost) {
            // 기존 가이드비 수정
            savePromises.push(
              fetch('/api/guide-costs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: existingCost.id,
                  guideFee: productData['1_guide'].guide_fee,
                  assistantFee: 0,
                  driverFee: 0,
                  effectiveFrom: productData['1_guide'].effective_from,
                  effectiveTo: productData['1_guide'].effective_to || null
                })
              })
            )
          } else if (productData['1_guide'].guide_fee! > 0) {
            // 새 가이드비 생성
            savePromises.push(
              fetch('/api/guide-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: productId,
                  teamType: '1_guide',
                  guideFee: productData['1_guide'].guide_fee,
                  assistantFee: 0,
                  driverFee: 0,
                  effectiveFrom: productData['1_guide'].effective_from,
                  effectiveTo: productData['1_guide'].effective_to || null
                })
              })
            )
          }
        }

        // 2가이드 저장
        if (productData['2_guides'].guide_fee !== undefined) {
          const existingCost = products.find(p => p.id === productId)
            ?.product_guide_costs?.find(c => c.team_type === '2_guides')
          
          if (existingCost) {
            // 기존 가이드비 수정
            savePromises.push(
              fetch('/api/guide-costs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: existingCost.id,
                  guideFee: productData['2_guides'].guide_fee,
                  assistantFee: productData['2_guides'].assistant_fee,
                  driverFee: 0,
                  effectiveFrom: productData['2_guides'].effective_from,
                  effectiveTo: productData['2_guides'].effective_to || null
                })
              })
            )
          } else if (productData['2_guides'].guide_fee! > 0 || productData['2_guides'].assistant_fee! > 0) {
            // 새 가이드비 생성
            savePromises.push(
              fetch('/api/guide-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: productId,
                  teamType: '2_guides',
                  guideFee: productData['2_guides'].guide_fee,
                  assistantFee: productData['2_guides'].assistant_fee,
                  driverFee: 0,
                  effectiveFrom: productData['2_guides'].effective_from,
                  effectiveTo: productData['2_guides'].effective_to || null
                })
              })
            )
          }
        }

        // 가이드+드라이버 저장
        if (productData['guide_driver'].guide_fee !== undefined) {
          const existingCost = products.find(p => p.id === productId)
            ?.product_guide_costs?.find(c => c.team_type === 'guide_driver')
          
          if (existingCost) {
            // 기존 가이드비 수정
            savePromises.push(
              fetch('/api/guide-costs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: existingCost.id,
                  guideFee: productData['guide_driver'].guide_fee,
                  assistantFee: 0,
                  driverFee: productData['guide_driver'].driver_fee,
                  effectiveFrom: productData['guide_driver'].effective_from,
                  effectiveTo: productData['guide_driver'].effective_to || null
                })
              })
            )
          } else if (productData['guide_driver'].guide_fee! > 0 || productData['guide_driver'].driver_fee! > 0) {
            // 새 가이드비 생성
            savePromises.push(
              fetch('/api/guide-costs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: productId,
                  teamType: 'guide_driver',
                  guideFee: productData['guide_driver'].guide_fee,
                  assistantFee: 0,
                  driverFee: productData['guide_driver'].driver_fee,
                  effectiveFrom: productData['guide_driver'].effective_from,
                  effectiveTo: productData['guide_driver'].effective_to || null
                })
              })
            )
          }
        }
      })

      // 모든 저장 작업 실행
      const responses = await Promise.all(savePromises)
      
      // 응답 확인
      for (const response of responses) {
        const data = await response.json()
        if (data.error) {
          throw new Error(data.error)
        }
      }

      alert('전체 가이드비가 저장되었습니다.')
      cancelGlobalEdit()
      loadProducts()
    } catch (error) {
      console.error('전체 가이드비 저장 오류:', error)
      alert('전체 가이드비 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 팀 타입별 라벨
  const getTeamTypeLabel = (teamType: string) => {
    switch (teamType) {
      case '1_guide': return '1가이드'
      case '2_guides': return '2가이드'
      case 'guide_driver': return '가이드+드라이버'
      default: return teamType
    }
  }

  // 팀 타입별 색상
  const getTeamTypeColor = (teamType: string) => {
    switch (teamType) {
      case '1_guide': return 'bg-blue-100 text-blue-800'
      case '2_guides': return 'bg-green-100 text-green-800'
      case 'guide_driver': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 변경 이력 모달 열기
  const openHistoryModal = (productId: string, productName: string) => {
    setSelectedProductForHistory({ id: productId, name: productName })
    setShowHistoryModal(true)
  }

  // 변경 이력 모달 닫기
  const closeHistoryModal = () => {
    setShowHistoryModal(false)
    setSelectedProductForHistory(null)
  }

  useEffect(() => {
    checkAdminPermission()
    loadProducts()
    loadNote()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-none mx-auto p-2">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">가이드비 관리</h1>
            <p className="text-gray-600">Mania Tour/Mania Service 상품의 가이드비를 설정하고 관리합니다.</p>
          </div>
          <div className="flex space-x-3">
            {/* 변경 이력 버튼 (모든 사용자에게 표시) */}
            <button
              onClick={() => {
                // 첫 번째 상품의 변경 이력을 보여줌 (전체 이력)
                if (products.length > 0) {
                  openHistoryModal(products[0].id, '전체 상품')
                }
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <History size={16} />
              <span>변경 이력</span>
            </button>

            {isAdmin && (
              <>
                {isGlobalEditMode ? (
                  <>
                    <button
                      onClick={saveGlobalEdit}
                      disabled={saving}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Save size={16} />
                      <span>전체 저장</span>
                    </button>
                    <button
                      onClick={cancelGlobalEdit}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <X size={16} />
                      <span>취소</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startGlobalEdit}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Edit size={16} />
                    <span>전체 편집</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {!isAdmin && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">관리자 권한이 필요합니다. 수정 및 삭제 기능이 제한됩니다.</p>
          </div>
        )}
        {isGlobalEditMode && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">전체 편집 모드입니다. 모든 상품의 가이드비를 한 번에 수정할 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* 노트 섹션 */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center space-x-2 mb-3">
          <FileText size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">가이드비 관리 노트</h2>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          가이드비 변경 사항이나 특이사항을 기록해두세요.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="가이드비 변경 사항이나 특이사항을 입력하세요..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[100px]"
          rows={4}
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={saveNote}
            disabled={noteSaving}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} />
            <span>{noteSaving ? '저장 중...' : '노트 저장'}</span>
          </button>
        </div>
      </div>

      {/* 테이블 뷰 */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1300px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px]">
                  상품명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">
                  1가이드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px]">
                  2가이드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px]">
                  가이드+드라이버
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">
                  시작일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">
                  종료일
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => {
                // 각 상품별로 팀 타입별 가이드비 정리
                const costsByType = {
                  '1_guide': product.product_guide_costs?.find(c => c.team_type === '1_guide'),
                  '2_guides': product.product_guide_costs?.find(c => c.team_type === '2_guides'),
                  'guide_driver': product.product_guide_costs?.find(c => c.team_type === 'guide_driver')
                }

                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap w-[200px]">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.sub_category}</div>
                        </div>
                        <button
                          onClick={() => openHistoryModal(product.id, product.name)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="변경 이력 보기"
                        >
                          <History size={14} />
                        </button>
                      </div>
                    </td>
                    
                    {/* 1가이드 */}
                    <td className="px-6 py-4 whitespace-nowrap w-[120px]">
                      {isGlobalEditMode ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={globalEditData[product.id]?.['1_guide']?.guide_fee || 0}
                            onChange={(e) => setGlobalEditData(prev => ({ 
                              ...prev, 
                              [product.id]: {
                                ...prev[product.id],
                                '1_guide': { 
                                  ...prev[product.id]?.['1_guide'], 
                                  guide_fee: Number(e.target.value) 
                                }
                              }
                            }))}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ) : editingProductId === product.id ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rowEditData['1_guide'].guide_fee || 0}
                            onChange={(e) => setRowEditData(prev => ({ 
                              ...prev, 
                              '1_guide': { ...prev['1_guide'], guide_fee: Number(e.target.value) }
                            }))}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ) : costsByType['1_guide'] ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900">
                            ${costsByType['1_guide'].guide_fee}
                          </span>
                          {isAdmin && !isGlobalEditMode && (
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleDelete(costsByType['1_guide']!.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="삭제"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">미설정</span>
                      )}
                    </td>

                    {/* 2가이드 */}
                    <td className="px-6 py-4 whitespace-nowrap w-[200px]">
                      {isGlobalEditMode ? (
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-600">가이드:</span>
                            <span className="text-sm text-gray-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={globalEditData[product.id]?.['2_guides']?.guide_fee || 0}
                              onChange={(e) => setGlobalEditData(prev => ({ 
                                ...prev, 
                                [product.id]: {
                                  ...prev[product.id],
                                  '2_guides': { 
                                    ...prev[product.id]?.['2_guides'], 
                                    guide_fee: Number(e.target.value) 
                                  }
                                }
                              }))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-600">어시스턴트:</span>
                            <span className="text-sm text-gray-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={globalEditData[product.id]?.['2_guides']?.assistant_fee || 0}
                              onChange={(e) => setGlobalEditData(prev => ({ 
                                ...prev, 
                                [product.id]: {
                                  ...prev[product.id],
                                  '2_guides': { 
                                    ...prev[product.id]?.['2_guides'], 
                                    assistant_fee: Number(e.target.value) 
                                  }
                                }
                              }))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="text-xs font-medium text-green-600">
                            총합: ${(globalEditData[product.id]?.['2_guides']?.guide_fee || 0) + (globalEditData[product.id]?.['2_guides']?.assistant_fee || 0)}
                          </div>
                        </div>
                      ) : editingProductId === product.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">가이드:</span>
                            <span className="text-sm text-gray-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rowEditData['2_guides'].guide_fee || 0}
                              onChange={(e) => setRowEditData(prev => ({ 
                                ...prev, 
                                '2_guides': { ...prev['2_guides'], guide_fee: Number(e.target.value) }
                              }))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">어시스턴트:</span>
                            <span className="text-sm text-gray-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rowEditData['2_guides'].assistant_fee || 0}
                              onChange={(e) => setRowEditData(prev => ({ 
                                ...prev, 
                                '2_guides': { ...prev['2_guides'], assistant_fee: Number(e.target.value) }
                              }))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="text-xs font-medium text-green-600">
                            총합: ${(rowEditData['2_guides'].guide_fee || 0) + (rowEditData['2_guides'].assistant_fee || 0)}
                          </div>
                        </div>
                      ) : costsByType['2_guides'] ? (
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-900">
                            <div>가이드: ${costsByType['2_guides'].guide_fee}</div>
                            <div>어시스턴트: ${costsByType['2_guides'].assistant_fee}</div>
                            <div className="font-medium text-green-600">
                              총합: ${costsByType['2_guides'].guide_fee + costsByType['2_guides'].assistant_fee}
                            </div>
                          </div>
                          {isAdmin && !isGlobalEditMode && (
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleDelete(costsByType['2_guides']!.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="삭제"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">미설정</span>
                      )}
                    </td>

                    {/* 가이드+드라이버 */}
                    <td className="px-6 py-4 whitespace-nowrap w-[200px]">
                      {isGlobalEditMode ? (
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-600">가이드:</span>
                            <span className="text-sm text-gray-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={globalEditData[product.id]?.['guide_driver']?.guide_fee || 0}
                              onChange={(e) => setGlobalEditData(prev => ({ 
                                ...prev, 
                                [product.id]: {
                                  ...prev[product.id],
                                  'guide_driver': { 
                                    ...prev[product.id]?.['guide_driver'], 
                                    guide_fee: Number(e.target.value) 
                                  }
                                }
                              }))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-600">드라이버:</span>
                            <span className="text-sm text-gray-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={globalEditData[product.id]?.['guide_driver']?.driver_fee || 0}
                              onChange={(e) => setGlobalEditData(prev => ({ 
                                ...prev, 
                                [product.id]: {
                                  ...prev[product.id],
                                  'guide_driver': { 
                                    ...prev[product.id]?.['guide_driver'], 
                                    driver_fee: Number(e.target.value) 
                                  }
                                }
                              }))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="text-xs font-medium text-green-600">
                            총합: ${(globalEditData[product.id]?.['guide_driver']?.guide_fee || 0) + (globalEditData[product.id]?.['guide_driver']?.driver_fee || 0)}
                          </div>
                        </div>
                      ) : editingProductId === product.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">가이드:</span>
                            <span className="text-sm text-gray-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rowEditData['guide_driver'].guide_fee || 0}
                              onChange={(e) => setRowEditData(prev => ({ 
                                ...prev, 
                                'guide_driver': { ...prev['guide_driver'], guide_fee: Number(e.target.value) }
                              }))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">드라이버:</span>
                            <span className="text-sm text-gray-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rowEditData['guide_driver'].driver_fee || 0}
                              onChange={(e) => setRowEditData(prev => ({ 
                                ...prev, 
                                'guide_driver': { ...prev['guide_driver'], driver_fee: Number(e.target.value) }
                              }))}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="text-xs font-medium text-green-600">
                            총합: ${(rowEditData['guide_driver'].guide_fee || 0) + (rowEditData['guide_driver'].driver_fee || 0)}
                          </div>
                        </div>
                      ) : costsByType['guide_driver'] ? (
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-900">
                            <div>가이드: ${costsByType['guide_driver'].guide_fee}</div>
                            <div>드라이버: ${costsByType['guide_driver'].driver_fee}</div>
                            <div className="font-medium text-green-600">
                              총합: ${costsByType['guide_driver'].guide_fee + costsByType['guide_driver'].driver_fee}
                            </div>
                          </div>
                          {isAdmin && !isGlobalEditMode && (
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleDelete(costsByType['guide_driver']!.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="삭제"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">미설정</span>
                      )}
                    </td>

                    {/* 시작일 */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-[120px]">
                      {isGlobalEditMode ? (
                        <input
                          type="date"
                          value={globalEditData[product.id]?.['1_guide']?.effective_from || ''}
                          onChange={(e) => {
                            const newDate = e.target.value
                            setGlobalEditData(prev => ({ 
                              ...prev, 
                              [product.id]: {
                                ...prev[product.id],
                                '1_guide': { ...prev[product.id]?.['1_guide'], effective_from: newDate },
                                '2_guides': { ...prev[product.id]?.['2_guides'], effective_from: newDate },
                                'guide_driver': { ...prev[product.id]?.['guide_driver'], effective_from: newDate }
                              }
                            }))
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : editingProductId === product.id ? (
                        <input
                          type="date"
                          value={rowEditData['1_guide'].effective_from || ''}
                          onChange={(e) => setRowEditData(prev => ({ 
                            ...prev, 
                            '1_guide': { ...prev['1_guide'], effective_from: e.target.value },
                            '2_guides': { ...prev['2_guides'], effective_from: e.target.value },
                            'guide_driver': { ...prev['guide_driver'], effective_from: e.target.value }
                          }))}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="flex items-center space-x-1">
                          <Calendar size={12} className="text-gray-400" />
                          <span>{costsByType['1_guide']?.effective_from || '-'}</span>
                        </div>
                      )}
                    </td>

                    {/* 종료일 */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-[120px]">
                      {isGlobalEditMode ? (
                        <input
                          type="date"
                          value={globalEditData[product.id]?.['1_guide']?.effective_to || ''}
                          onChange={(e) => {
                            const newDate = e.target.value
                            setGlobalEditData(prev => ({ 
                              ...prev, 
                              [product.id]: {
                                ...prev[product.id],
                                '1_guide': { ...prev[product.id]?.['1_guide'], effective_to: newDate },
                                '2_guides': { ...prev[product.id]?.['2_guides'], effective_to: newDate },
                                'guide_driver': { ...prev[product.id]?.['guide_driver'], effective_to: newDate }
                              }
                            }))
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : editingProductId === product.id ? (
                        <input
                          type="date"
                          value={rowEditData['1_guide'].effective_to || ''}
                          onChange={(e) => setRowEditData(prev => ({ 
                            ...prev, 
                            '1_guide': { ...prev['1_guide'], effective_to: e.target.value },
                            '2_guides': { ...prev['2_guides'], effective_to: e.target.value },
                            'guide_driver': { ...prev['guide_driver'], effective_to: e.target.value }
                          }))}
                          className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="flex items-center space-x-1">
                          <Calendar size={12} className="text-gray-400" />
                          <span>{costsByType['1_guide']?.effective_to || '-'}</span>
                        </div>
                      )}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 가이드비 설정/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCost ? '가이드비 수정' : '가이드비 설정'}
            </h3>

            <div className="space-y-4">
              {/* 팀 타입 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">팀 타입</label>
                <select
                  value={formData.teamType}
                  onChange={(e) => setFormData(prev => ({ ...prev, teamType: e.target.value as '1_guide' | '2_guides' | 'guide_driver' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!!editingCost}
                >
                  <option value="1_guide">1가이드</option>
                  <option value="2_guides">2가이드</option>
                  <option value="guide_driver">가이드+드라이버</option>
                </select>
              </div>

              {/* 가이드비 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">가이드비 ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.guideFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, guideFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* 어시스턴트비 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">어시스턴트비 ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.assistantFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, assistantFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 드라이버비 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">드라이버비 ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.driverFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, driverFee: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 유효 기간 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일 (선택)</label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingCost(null)
                  resetForm()
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : (editingCost ? '수정' : '설정')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 변경 이력 모달 */}
      {showHistoryModal && selectedProductForHistory && (
        <GuideCostHistory
          isOpen={showHistoryModal}
          onClose={closeHistoryModal}
          productId={selectedProductForHistory.id}
          productName={selectedProductForHistory.name}
        />
      )}
    </div>
  )
}
