'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Filter, Edit, Trash2, Eye, Calendar, Wrench, DollarSign, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

type VehicleMaintenance = Database['public']['Tables']['vehicle_maintenance']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

interface VehicleMaintenanceFormData {
  vehicle_id: string
  maintenance_date: string
  mileage: string
  maintenance_type: string
  category: string
  subcategory: string
  description: string
  total_cost: string
  labor_cost: string
  parts_cost: string
  other_cost: string
  service_provider: string
  service_provider_contact: string
  service_provider_address: string
  warranty_period: string
  warranty_notes: string
  is_scheduled_maintenance: boolean
  next_maintenance_date: string
  next_maintenance_mileage: string
  maintenance_interval: string
  mileage_interval: string
  parts_replaced: string[]
  quality_rating: string
  satisfaction_rating: string
  issues_found: string[]
  recommendations: string[]
  photos: string[]
  receipts: string[]
  documents: string[]
  notes: string
  technician_notes: string
  status: string
  payment_method: string
  uploaded_files: File[]
}

export default function VehicleMaintenanceManager() {
  const t = useTranslations('vehicleMaintenance')
  const { user } = useAuth()
  const [maintenances, setMaintenances] = useState<VehicleMaintenance[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState<VehicleMaintenance | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  const [formData, setFormData] = useState<VehicleMaintenanceFormData>({
    vehicle_id: '',
    maintenance_date: new Date().toISOString().split('T')[0],
    mileage: '',
    maintenance_type: '',
    category: '',
    subcategory: '',
    description: '',
    total_cost: '',
    labor_cost: '',
    parts_cost: '',
    other_cost: '',
    service_provider: '',
    service_provider_contact: '',
    service_provider_address: '',
    warranty_period: '',
    warranty_notes: '',
    is_scheduled_maintenance: false,
    next_maintenance_date: '',
    next_maintenance_mileage: '',
    maintenance_interval: '',
    mileage_interval: '',
    parts_replaced: [],
    quality_rating: '',
    satisfaction_rating: '',
    issues_found: [],
    recommendations: [],
    photos: [],
    receipts: [],
    documents: [],
    notes: '',
    technician_notes: '',
    status: 'completed',
    payment_method: '',
    uploaded_files: []
  })

  const loadMaintenances = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (searchTerm) params.append('search', searchTerm)
      if (vehicleFilter && vehicleFilter !== 'all') params.append('vehicle_id', vehicleFilter)
      if (maintenanceTypeFilter && maintenanceTypeFilter !== 'all') params.append('maintenance_type', maintenanceTypeFilter)
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      
      const response = await fetch(`/api/vehicle-maintenance?${params.toString()}`)
      const result = await response.json()
      
      if (response.ok) {
        setMaintenances(result.data || [])
      } else {
        toast.error(result.error || '정비 기록을 불러올 수 없습니다.')
      }
    } catch (error) {
      console.error('정비 기록 로드 오류:', error)
      toast.error('정비 기록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, vehicleFilter, maintenanceTypeFilter, categoryFilter, statusFilter])

  const loadVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('vehicle_number')
      
      if (error) throw error
      setVehicles(data || [])
    } catch (error) {
      console.error('차량 목록 로드 오류:', error)
    }
  }, [supabase])

  useEffect(() => {
    loadMaintenances()
    loadVehicles()
  }, [loadMaintenances, loadVehicles])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.vehicle_id || !formData.maintenance_date || !formData.maintenance_type || !formData.category || !formData.description || !formData.total_cost) {
      toast.error('필수 필드를 모두 입력해주세요.')
      return
    }

    try {
      setSaving(true)
      
           // 파일 업로드 처리
           let uploadedFileUrls: string[] = []
           if (formData.uploaded_files.length > 0) {
             setIsUploading(true)
             try {
               const uploadFormData = new FormData()
               uploadFormData.append('bucketType', 'maintenance')
               formData.uploaded_files.forEach(file => {
                 uploadFormData.append('files', file)
               })
               
               const uploadResponse = await fetch('/api/upload', {
                 method: 'POST',
                 body: uploadFormData
               })
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            uploadedFileUrls = uploadResult.urls
            toast.success(`${uploadedFileUrls.length}개 파일이 업로드되었습니다.`)
          } else {
            console.error('파일 업로드 실패')
            toast.error('파일 업로드에 실패했습니다.')
          }
        } finally {
          setIsUploading(false)
        }
      }
      
      // 정비 데이터 준비
      const submitData = {
        ...formData,
        photos: [...formData.photos, ...uploadedFileUrls],
        receipts: [...formData.receipts, ...uploadedFileUrls], // 인보이스/영수증으로 분류
        uploaded_files: undefined // 서버로 전송하지 않음
      }
      
      const url = editingMaintenance ? `/api/vehicle-maintenance/${editingMaintenance.id}` : '/api/vehicle-maintenance'
      const method = editingMaintenance ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success(editingMaintenance ? t('messages.maintenanceUpdated') : t('messages.maintenanceAdded'))
        
        // 연동된 회사 지출 정보 표시
        if (result.companyExpenseId) {
          toast.success('회사 지출도 자동으로 생성되었습니다.')
        }
        
        setIsDialogOpen(false)
        setEditingMaintenance(null)
        resetForm()
        loadMaintenances()
      } else {
        toast.error(result.error || '정비 기록 저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('정비 기록 저장 오류:', error)
      toast.error('정비 기록 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (maintenance: VehicleMaintenance) => {
    setEditingMaintenance(maintenance)
    setFormData({
      vehicle_id: maintenance.vehicle_id,
      maintenance_date: maintenance.maintenance_date,
      mileage: maintenance.mileage?.toString() || '',
      maintenance_type: maintenance.maintenance_type,
      category: maintenance.category,
      subcategory: maintenance.subcategory || '',
      description: maintenance.description,
      total_cost: maintenance.total_cost.toString(),
      labor_cost: maintenance.labor_cost?.toString() || '',
      parts_cost: maintenance.parts_cost?.toString() || '',
      other_cost: maintenance.other_cost?.toString() || '',
      service_provider: maintenance.service_provider || '',
      service_provider_contact: maintenance.service_provider_contact || '',
      service_provider_address: maintenance.service_provider_address || '',
      warranty_period: maintenance.warranty_period?.toString() || '',
      warranty_notes: maintenance.warranty_notes || '',
      is_scheduled_maintenance: maintenance.is_scheduled_maintenance,
      next_maintenance_date: maintenance.next_maintenance_date || '',
      next_maintenance_mileage: maintenance.next_maintenance_mileage?.toString() || '',
      maintenance_interval: maintenance.maintenance_interval?.toString() || '',
      mileage_interval: maintenance.mileage_interval?.toString() || '',
      parts_replaced: maintenance.parts_replaced || [],
      quality_rating: maintenance.quality_rating?.toString() || '',
      satisfaction_rating: maintenance.satisfaction_rating?.toString() || '',
      issues_found: maintenance.issues_found || [],
      recommendations: maintenance.recommendations || [],
      photos: maintenance.photos || [],
      receipts: maintenance.receipts || [],
      documents: maintenance.documents || [],
      notes: maintenance.notes || '',
      technician_notes: maintenance.technician_notes || '',
      status: maintenance.status,
      payment_method: '', // 기존 데이터에는 없으므로 빈 값
      uploaded_files: []
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/vehicle-maintenance/${id}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success(t('messages.maintenanceDeleted'))
        loadMaintenances()
      } else {
        toast.error(result.error || '정비 기록 삭제 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('정비 기록 삭제 오류:', error)
      toast.error('정비 기록 삭제 중 오류가 발생했습니다.')
    }
  }

  const resetForm = () => {
    setFormData({
      vehicle_id: '',
      maintenance_date: new Date().toISOString().split('T')[0],
      mileage: '',
      maintenance_type: '',
      category: '',
      subcategory: '',
      description: '',
      total_cost: '',
      labor_cost: '',
      parts_cost: '',
      other_cost: '',
      service_provider: '',
      service_provider_contact: '',
      service_provider_address: '',
      warranty_period: '',
      warranty_notes: '',
      is_scheduled_maintenance: false,
      next_maintenance_date: '',
      next_maintenance_mileage: '',
      maintenance_interval: '',
      mileage_interval: '',
      parts_replaced: [],
      quality_rating: '',
      satisfaction_rating: '',
      issues_found: [],
      recommendations: [],
      photos: [],
      receipts: [],
      documents: [],
      notes: '',
      technician_notes: '',
      status: 'completed',
      payment_method: '',
      uploaded_files: []
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { color: 'bg-blue-100 text-blue-800', icon: Calendar },
      in_progress: { color: 'bg-yellow-100 text-yellow-800', icon: Wrench },
      completed: { color: 'bg-green-100 text-green-800', icon: DollarSign },
      cancelled: { color: 'bg-red-100 text-red-800', icon: AlertTriangle }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.completed
    const Icon = config.icon
    
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {t(`status.${status}`)}
      </Badge>
    )
  }

  const maintenanceTypes = [
    { value: 'maintenance', label: t('maintenanceTypes.maintenance') },
    { value: 'repair', label: t('maintenanceTypes.repair') },
    { value: 'service', label: t('maintenanceTypes.service') },
    { value: 'inspection', label: t('maintenanceTypes.inspection') },
    { value: 'emergency', label: t('maintenanceTypes.emergency') }
  ]

  const categories = [
    { value: 'engine', label: t('categories.engine') },
    { value: 'transmission', label: t('categories.transmission') },
    { value: 'brakes', label: t('categories.brakes') },
    { value: 'tires', label: t('categories.tires') },
    { value: 'electrical', label: t('categories.electrical') },
    { value: 'air_conditioning', label: t('categories.air_conditioning') },
    { value: 'body', label: t('categories.body') },
    { value: 'interior', label: t('categories.interior') },
    { value: 'exterior', label: t('categories.exterior') },
    { value: 'other', label: t('categories.other') }
  ]

  const paymentMethods = [
    { value: 'cash', label: '현금' },
    { value: 'card', label: '카드' },
    { value: 'bank_transfer', label: '계좌이체' },
    { value: 'check', label: '수표' },
    { value: 'other', label: '기타' }
  ]

  // 파일 업로드 핸들러
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setFormData(prev => ({
      ...prev,
      uploaded_files: [...prev.uploaded_files, ...files]
    }))
  }

  // 파일 제거 핸들러
  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      uploaded_files: prev.uploaded_files.filter((_, i) => i !== index)
    }))
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })
    
    if (validFiles.length !== files.length) {
      toast.error('일부 파일이 지원되지 않는 형식이거나 크기가 너무 큽니다.')
    }
    
    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...validFiles]
      }))
      toast.success(`${validFiles.length}개 파일이 추가되었습니다.`)
    }
  }

  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []
    
    items.forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
          if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            files.push(file)
          }
        }
      }
    })
    
    if (files.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...files]
      }))
      toast.success(`${files.length}개 파일이 붙여넣기되었습니다.`)
    }
  }

  const subcategories = [
    { value: 'oil_change', label: t('subcategories.oil_change') },
    { value: 'tire_rotation', label: t('subcategories.tire_rotation') },
    { value: 'brake_pad', label: t('subcategories.brake_pad') },
    { value: 'battery', label: t('subcategories.battery') },
    { value: 'filter', label: t('subcategories.filter') },
    { value: 'belt', label: t('subcategories.belt') },
    { value: 'spark_plug', label: t('subcategories.spark_plug') },
    { value: 'alignment', label: t('subcategories.alignment') },
    { value: 'car_wash', label: t('subcategories.car_wash') },
    { value: 'windshield_wiper', label: t('subcategories.windshield_wiper') },
    { value: 'other', label: t('subcategories.other') }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('maintenanceList')}</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm()
              setEditingMaintenance(null)
            }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('addMaintenance')}
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMaintenance ? t('buttons.edit') : t('addMaintenance')}
              </DialogTitle>
              <DialogDescription>
                {editingMaintenance ? '정비 기록을 수정하세요.' : '새로운 정비 기록을 등록하세요.'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicle_id">{t('form.vehicleId')} *</Label>
                  <Select value={formData.vehicle_id} onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="차량 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.vehicle_number || vehicle.vehicle_type || 'Unknown'} ({vehicle.vehicle_category || 'N/A'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="maintenance_date">{t('form.maintenanceDate')} *</Label>
                  <Input
                    id="maintenance_date"
                    type="date"
                    value={formData.maintenance_date}
                    onChange={(e) => setFormData({ ...formData, maintenance_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="mileage">{t('form.mileage')}</Label>
                  <Input
                    id="mileage"
                    type="number"
                    value={formData.mileage}
                    onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="maintenance_type">{t('form.maintenanceType')} *</Label>
                  <Select value={formData.maintenance_type} onValueChange={(value) => setFormData({ ...formData, maintenance_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="정비 유형 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {maintenanceTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="category">{t('form.category')} *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="subcategory">{t('form.subcategory')}</Label>
                <Select value={formData.subcategory} onValueChange={(value) => setFormData({ ...formData, subcategory: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="하위 카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((subcategory) => (
                      <SelectItem key={subcategory.value} value={subcategory.value}>
                        {subcategory.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="description">{t('form.description')} *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="total_cost">{t('form.totalCost')} *</Label>
                  <Input
                    id="total_cost"
                    type="number"
                    step="0.01"
                    value={formData.total_cost}
                    onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="labor_cost">{t('form.laborCost')}</Label>
                  <Input
                    id="labor_cost"
                    type="number"
                    step="0.01"
                    value={formData.labor_cost}
                    onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="parts_cost">{t('form.partsCost')}</Label>
                  <Input
                    id="parts_cost"
                    type="number"
                    step="0.01"
                    value={formData.parts_cost}
                    onChange={(e) => setFormData({ ...formData, parts_cost: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="other_cost">{t('form.otherCost')}</Label>
                  <Input
                    id="other_cost"
                    type="number"
                    step="0.01"
                    value={formData.other_cost}
                    onChange={(e) => setFormData({ ...formData, other_cost: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="payment_method">결제 방법 *</Label>
                  <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="결제 방법 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="service_provider">{t('form.serviceProvider')}</Label>
                  <Input
                    id="service_provider"
                    value={formData.service_provider}
                    onChange={(e) => setFormData({ ...formData, service_provider: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="service_provider_address">{t('form.serviceProviderAddress')}</Label>
                <Textarea
                  id="service_provider_address"
                  value={formData.service_provider_address}
                  onChange={(e) => setFormData({ ...formData, service_provider_address: e.target.value })}
                />
              </div>
              
              {/* 파일 업로드 섹션 */}
              <div>
                <Label htmlFor="file_upload">인보이스/영수증 첨부</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                    isUploading 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                      : isDragOver 
                        ? 'border-blue-500 bg-blue-100 scale-105 cursor-pointer' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                  }`}
                  onDragOver={!isUploading ? handleDragOver : undefined}
                  onDragEnter={!isUploading ? handleDragEnter : undefined}
                  onDragLeave={!isUploading ? handleDragLeave : undefined}
                  onDrop={!isUploading ? handleDrop : undefined}
                  onPaste={!isUploading ? handlePaste : undefined}
                  tabIndex={!isUploading ? 0 : -1}
                  onClick={!isUploading ? () => document.getElementById('file_upload')?.click() : undefined}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isUploading 
                        ? 'bg-blue-100' 
                        : isDragOver 
                          ? 'bg-blue-200' 
                          : 'bg-gray-100'
                    }`}>
                      {isUploading ? (
                        <div className="animate-spin">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                      ) : isDragOver ? (
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium transition-colors ${
                        isDragOver ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {isUploading 
                          ? '파일 업로드 중...' 
                          : isDragOver 
                            ? '파일을 여기에 놓으세요' 
                            : '파일을 드래그하여 놓거나 클릭하여 선택하세요'
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        또는 클립보드에서 붙여넣기 (Ctrl+V)
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      지원 형식: JPG, PNG, GIF, PDF, DOC, DOCX (최대 10MB)
                    </div>
                  </div>
                  
                  <input
                    id="file_upload"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  {/* 업로드된 파일 목록 */}
                  {formData.uploaded_files.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium mb-3 text-gray-900">업로드된 파일 ({formData.uploaded_files.length}개)</h4>
                      <div className="space-y-2">
                        {formData.uploaded_files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                {file.type.startsWith('image/') ? (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFile(index)
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="warranty_period">{t('form.warrantyPeriod')}</Label>
                  <Input
                    id="warranty_period"
                    type="number"
                    value={formData.warranty_period}
                    onChange={(e) => setFormData({ ...formData, warranty_period: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="next_maintenance_date">{t('form.nextMaintenanceDate')}</Label>
                  <Input
                    id="next_maintenance_date"
                    type="date"
                    value={formData.next_maintenance_date}
                    onChange={(e) => setFormData({ ...formData, next_maintenance_date: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quality_rating">{t('form.qualityRating')}</Label>
                  <Select value={formData.quality_rating} onValueChange={(value) => setFormData({ ...formData, quality_rating: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="품질 평가" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - 매우 나쁨</SelectItem>
                      <SelectItem value="2">2 - 나쁨</SelectItem>
                      <SelectItem value="3">3 - 보통</SelectItem>
                      <SelectItem value="4">4 - 좋음</SelectItem>
                      <SelectItem value="5">5 - 매우 좋음</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="satisfaction_rating">{t('form.satisfactionRating')}</Label>
                  <Select value={formData.satisfaction_rating} onValueChange={(value) => setFormData({ ...formData, satisfaction_rating: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="만족도 평가" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - 매우 불만족</SelectItem>
                      <SelectItem value="2">2 - 불만족</SelectItem>
                      <SelectItem value="3">3 - 보통</SelectItem>
                      <SelectItem value="4">4 - 만족</SelectItem>
                      <SelectItem value="5">5 - 매우 만족</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="notes">{t('form.notes')}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="technician_notes">{t('form.technicianNotes')}</Label>
                <Textarea
                  id="technician_notes"
                  value={formData.technician_notes}
                  onChange={(e) => setFormData({ ...formData, technician_notes: e.target.value })}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_scheduled_maintenance"
                  checked={formData.is_scheduled_maintenance}
                  onChange={(e) => setFormData({ ...formData, is_scheduled_maintenance: e.target.checked })}
                />
                <Label htmlFor="is_scheduled_maintenance">{t('form.isScheduledMaintenance')}</Label>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('buttons.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? '저장 중...' : t('buttons.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="search">{t('filters.search')}</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t('filters.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="vehicle">{t('filters.vehicle')}</Label>
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="차량" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicle_number || vehicle.vehicle_type || 'Unknown'} ({vehicle.vehicle_category || 'N/A'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="maintenance_type">{t('filters.maintenanceType')}</Label>
              <Select value={maintenanceTypeFilter} onValueChange={setMaintenanceTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="정비 유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  {maintenanceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="category">{t('filters.category')}</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status">{t('filters.status')}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  <SelectItem value="scheduled">{t('status.scheduled')}</SelectItem>
                  <SelectItem value="in_progress">{t('status.in_progress')}</SelectItem>
                  <SelectItem value="completed">{t('status.completed')}</SelectItem>
                  <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => {
              setSearchTerm('')
              setVehicleFilter('')
              setMaintenanceTypeFilter('')
              setCategoryFilter('')
              setStatusFilter('')
            }}>
              {t('buttons.resetFilters')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 정비 기록 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('maintenanceList')}</CardTitle>
          <CardDescription>
            총 {maintenances.length}개의 정비 기록이 등록되어 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">{t('loading')}</div>
          ) : maintenances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noMaintenance')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>차량</TableHead>
                    <TableHead>정비일</TableHead>
                    <TableHead>마일리지</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead>총 비용</TableHead>
                    <TableHead>정비소</TableHead>
                    <TableHead>회사지출</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenances.map((maintenance) => (
                    <TableRow key={maintenance.id}>
                      <TableCell>
                        {maintenance.vehicles?.vehicle_number || maintenance.vehicles?.vehicle_type || 'Unknown'} ({maintenance.vehicles?.vehicle_category || 'N/A'})
                      </TableCell>
                      <TableCell>
                        {new Date(maintenance.maintenance_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {maintenance.mileage ? maintenance.mileage.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {t(`maintenanceTypes.${maintenance.maintenance_type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {t(`categories.${maintenance.category}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {maintenance.description}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₩{parseFloat(maintenance.total_cost.toString()).toLocaleString()}
                      </TableCell>
                      <TableCell>{maintenance.service_provider || '-'}</TableCell>
                      <TableCell>
                        {maintenance.company_expense_id ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            연동됨
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            미연동
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(maintenance.status)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(maintenance)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>정비 기록 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('messages.confirmDelete')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(maintenance.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
