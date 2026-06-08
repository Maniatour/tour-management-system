'use client'

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { fetchUploadApi } from '@/lib/uploadClient'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UnifiedStandardLeafPicker } from '@/components/company-expense/UnifiedStandardLeafPicker'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import type { PaymentMethodOption } from '@/hooks/usePaymentMethodOptions'
import {
  buildLastServiceDateMapForVehicle,
  catalogItemLabel,
  groupCatalogItems,
  normalizeSubcategoriesToCatalogCodes,
  resolveCatalogIntervalDisplay,
  type VehicleMaintenanceCatalogRow,
  type VehicleMaintenanceScheduleRow,
} from '@/lib/vehicleMaintenanceCatalog'
import { catalogAppliesToVehicle } from '@/lib/vehicleMaintenanceApplicability'
import { inferMaintenanceTypeFromCatalogCodes } from '@/lib/vehicleMaintenanceType'
import { toast } from 'sonner'
import enMessages from '@/i18n/locales/en.json'
import {
  buildVehicleMaintenanceStandardGroups,
  categoryValueForMaintenanceForm,
  parseVehicleMaintenanceSubcategories,
  serializeVehicleMaintenanceSubcategories,
  VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID,
} from '@/lib/vehicleMaintenanceStandardCategory'
import VehicleMaintenanceWorkTypePicker from '@/components/vehicle-maintenance/VehicleMaintenanceWorkTypePicker'
import {
  createEmptyMaintenanceFormData,
  formatMaintenanceStatsDate,
  resolveStoredPaymentMethodId,
  vehicleDisplayLabel,
  type VehicleMaintenanceFormData,
} from '@/components/vehicle-maintenance/vehicleMaintenanceFormShared'

type VehicleMaintenance = Database['public']['Tables']['vehicle_maintenance']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']

type VehicleMaintenanceWithVehicle = VehicleMaintenance & {
  company_expenses?:
    | { payment_method: string | null }
    | { payment_method: string | null }[]
    | null
}

function extractLinkedExpensePaymentMethod(maintenance: VehicleMaintenanceWithVehicle): string {
  const linked = maintenance.company_expenses
  if (!linked) return ''
  if (Array.isArray(linked)) return linked[0]?.payment_method ?? ''
  return linked.payment_method ?? ''
}

type StandardGroups = ReturnType<typeof buildVehicleMaintenanceStandardGroups>

export type VehicleMaintenanceFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingMaintenance: VehicleMaintenance | null
  onSaved: () => void
  activeCompanyVehicles: Vehicle[]
  vehicleById: Map<string, Vehicle>
  maintenanceCatalog: VehicleMaintenanceCatalogRow[]
  maintenances: VehicleMaintenance[]
  vehicleStandardGroups: StandardGroups
  expenseStandardCategories: ExpenseStandardCategoryPickRow[]
  paymentMethodOptions: PaymentMethodOption[]
  locale: string
}

export default function VehicleMaintenanceFormDialog({
  open,
  onOpenChange,
  editingMaintenance,
  onSaved,
  activeCompanyVehicles,
  vehicleById,
  maintenanceCatalog,
  maintenances,
  vehicleStandardGroups,
  expenseStandardCategories,
  paymentMethodOptions,
  locale,
}: VehicleMaintenanceFormDialogProps) {
  const t = useTranslations('vehicleMaintenance')

  const [formData, setFormData] = useState<VehicleMaintenanceFormData>(createEmptyMaintenanceFormData)
  const [formVehicleSchedules, setFormVehicleSchedules] = useState<VehicleMaintenanceScheduleRow[]>([])
  const [saving, setSaving] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const editPaymentMethodRawRef = useRef('')
  const editLoadIdRef = useRef<string | null>(null)
  const formDetailsRef = useRef<FormDetailsHandle>(null)

  const resetForm = useCallback(() => {
    editPaymentMethodRawRef.current = ''
    editLoadIdRef.current = null
    setFormData(createEmptyMaintenanceFormData())
    setFormVehicleSchedules([])
  }, [])

  const loadEditForm = useCallback(
    async (maintenance: VehicleMaintenanceWithVehicle) => {
      let storedPaymentMethod = extractLinkedExpensePaymentMethod(maintenance)
      if (!storedPaymentMethod && maintenance.company_expense_id) {
        try {
          const { data } = await supabase
            .from('company_expenses')
            .select('payment_method')
            .eq('id', maintenance.company_expense_id)
            .maybeSingle()
          storedPaymentMethod = data?.payment_method ?? ''
        } catch {
          storedPaymentMethod = ''
        }
      }

      editPaymentMethodRawRef.current = storedPaymentMethod

      setFormData({
        vehicle_id: maintenance.vehicle_id ?? '',
        maintenance_date: maintenance.maintenance_date,
        mileage: maintenance.mileage?.toString() || '',
        category: categoryValueForMaintenanceForm(maintenance.category, expenseStandardCategories),
        subcategories:
          maintenanceCatalog.length > 0
            ? normalizeSubcategoriesToCatalogCodes(maintenance.subcategory, maintenanceCatalog)
            : parseVehicleMaintenanceSubcategories(maintenance.subcategory),
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
        is_scheduled_maintenance: maintenance.is_scheduled_maintenance ?? false,
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
        status: maintenance.status ?? 'completed',
        payment_method: resolveStoredPaymentMethodId(storedPaymentMethod, paymentMethodOptions),
        uploaded_files: [],
      })
    },
    [expenseStandardCategories, maintenanceCatalog, paymentMethodOptions]
  )

  useEffect(() => {
    if (!open) return
    if (!editingMaintenance) {
      resetForm()
      return
    }
    if (editLoadIdRef.current === editingMaintenance.id) return
    editLoadIdRef.current = editingMaintenance.id
    void loadEditForm(editingMaintenance as VehicleMaintenanceWithVehicle)
  }, [open, editingMaintenance, loadEditForm, resetForm])

  useEffect(() => {
    if (!open || !editPaymentMethodRawRef.current || paymentMethodOptions.length === 0) return
    const resolved = resolveStoredPaymentMethodId(editPaymentMethodRawRef.current, paymentMethodOptions)
    if (!resolved) return
    setFormData((prev) => (prev.payment_method === resolved ? prev : { ...prev, payment_method: resolved }))
  }, [open, paymentMethodOptions])

  useEffect(() => {
    if (!open || !formData.vehicle_id) {
      setFormVehicleSchedules([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/vehicle-maintenance/schedules?vehicle_id=${encodeURIComponent(formData.vehicle_id)}`,
          { headers: apiBearerAuthHeaders() }
        )
        const json = await res.json()
        if (!cancelled && res.ok) {
          setFormVehicleSchedules((json.data ?? []) as VehicleMaintenanceScheduleRow[])
        }
      } catch {
        if (!cancelled) setFormVehicleSchedules([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, formData.vehicle_id])

  useEffect(() => {
    if (!open || !formData.vehicle_id || maintenanceCatalog.length === 0) return
    const vehicle = vehicleById.get(formData.vehicle_id)
    if (!vehicle) return
    setFormData((prev) => {
      const valid = prev.subcategories.filter((code) => {
        const item = maintenanceCatalog.find((c) => c.code === code)
        return item != null && catalogAppliesToVehicle(item, vehicle)
      })
      if (valid.length === prev.subcategories.length) return prev
      return { ...prev, subcategories: valid }
    })
  }, [open, formData.vehicle_id, maintenanceCatalog, vehicleById])

  const patchForm = useCallback(
    (patch: Partial<VehicleMaintenanceFormData>) => {
      setFormData((prev) => ({ ...prev, ...patch }))
    },
    []
  )

  const toggleFormSubcategory = useCallback((code: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      subcategories: checked
        ? [...prev.subcategories, code]
        : prev.subcategories.filter((value) => value !== code),
    }))
  }, [])

  const formSelectedVehicle = useMemo(
    () => (formData.vehicle_id ? vehicleById.get(formData.vehicle_id) : undefined),
    [formData.vehicle_id, vehicleById]
  )

  const formScheduleByCode = useMemo(
    () => new Map(formVehicleSchedules.map((s) => [s.catalog_code, s])),
    [formVehicleSchedules]
  )

  const formApplicableCatalog = useMemo(() => {
    if (!formSelectedVehicle) return []
    return maintenanceCatalog.filter((item) => catalogAppliesToVehicle(item, formSelectedVehicle))
  }, [maintenanceCatalog, formSelectedVehicle])

  const catalogGroupedForForm = useMemo(() => {
    if (!formSelectedVehicle) return new Map<string, VehicleMaintenanceCatalogRow[]>()
    return groupCatalogItems(formApplicableCatalog)
  }, [formApplicableCatalog, formSelectedVehicle])

  const formLastServiceByCode = useMemo(() => {
    if (!formData.vehicle_id || maintenanceCatalog.length === 0) {
      return new Map<string, string>()
    }
    return buildLastServiceDateMapForVehicle({
      catalog: maintenanceCatalog,
      vehicleId: formData.vehicle_id,
      maintenances,
      schedulesByCode: formScheduleByCode,
      applicableCatalog: formApplicableCatalog,
    })
  }, [
    formData.vehicle_id,
    maintenanceCatalog,
    maintenances,
    formScheduleByCode,
    formApplicableCatalog,
  ])

  const formIntervalDisplayByCode = useMemo(() => {
    const map = new Map<
      string,
      { miles: string | null; months: string | null; inspectionOnly: boolean }
    >()
    if (!formSelectedVehicle) return map
    for (const item of formApplicableCatalog) {
      const schedule = formScheduleByCode.get(item.code) ?? null
      const { miles, months, isInspectionOnly } = resolveCatalogIntervalDisplay(
        item,
        schedule,
        formSelectedVehicle.engine_oil_change_cycle,
        formSelectedVehicle.maintenance_duty_preset ?? 'standard'
      )
      map.set(item.code, {
        miles:
          miles != null ? t('schedule.intervalMiles', { miles: miles.toLocaleString() }) : null,
        months: months != null ? t('schedule.intervalMonths', { months }) : null,
        inspectionOnly: isInspectionOnly,
      })
    }
    return map
  }, [formApplicableCatalog, formScheduleByCode, formSelectedVehicle, t])

  const legacySubcategoryOptions = useMemo(() => {
    if (maintenanceCatalog.length > 0) {
      return maintenanceCatalog.map((item) => ({
        value: item.code,
        label: catalogItemLabel(item, locale),
        group: item.category_group,
      }))
    }
    const WORK_SUBCATEGORY_LABELS_EN = enMessages.vehicleMaintenance.subcategories as Record<
      string,
      string
    >
    return (
      [
        'oil_change',
        'tire_rotation',
        'brake_pad',
        'battery',
        'filter',
        'belt',
        'spark_plug',
        'alignment',
        'car_wash',
        'windshield_wiper',
        'other',
      ] as const
    ).map((value) => ({
      value,
      label: WORK_SUBCATEGORY_LABELS_EN[value] ?? value,
      group: 'legacy',
    }))
  }, [maintenanceCatalog, locale])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const mergedFormData: VehicleMaintenanceFormData = {
      ...formData,
      ...(formDetailsRef.current?.flushTextFields() ?? {}),
    }

    const mileageValue = parseInt(mergedFormData.mileage, 10)
    if (
      !mergedFormData.vehicle_id ||
      !mergedFormData.maintenance_date ||
      !mergedFormData.category ||
      !mergedFormData.description ||
      !mergedFormData.total_cost ||
      !Number.isFinite(mileageValue) ||
      mileageValue <= 0
    ) {
      toast.error('필수 필드를 모두 입력해주세요.')
      return
    }

    try {
      setSaving(true)

      let uploadedFileUrls: string[] = []
      if (mergedFormData.uploaded_files.length > 0) {
        setIsUploading(true)
        try {
          const uploadFormData = new FormData()
          uploadFormData.append('bucketType', 'maintenance')
          mergedFormData.uploaded_files.forEach((file) => {
            uploadFormData.append('files', file)
          })

          const uploadResponse = await fetchUploadApi(uploadFormData)

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

      const { subcategories, uploaded_files: _uploadedFiles, ...formRest } = mergedFormData
      const maintenance_type = inferMaintenanceTypeFromCatalogCodes(subcategories, maintenanceCatalog)
      const submitData = {
        ...formRest,
        maintenance_type,
        subcategory: serializeVehicleMaintenanceSubcategories(subcategories),
        photos: [...mergedFormData.photos, ...uploadedFileUrls],
        receipts: [...mergedFormData.receipts, ...uploadedFileUrls],
        uploaded_files: undefined,
      }

      const url = editingMaintenance
        ? `/api/vehicle-maintenance/${editingMaintenance.id}`
        : '/api/vehicle-maintenance'
      const method = editingMaintenance ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          ...apiBearerAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(
          editingMaintenance ? t('messages.maintenanceUpdated') : t('messages.maintenanceAdded')
        )
        if (result.companyExpenseId) {
          toast.success('회사 지출도 자동으로 생성되었습니다.')
        }
        onOpenChange(false)
        resetForm()
        onSaved()
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setFormData((prev) => ({
      ...prev,
      uploaded_files: [...prev.uploaded_files, ...files],
    }))
  }

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      uploaded_files: prev.uploaded_files.filter((_, i) => i !== index),
    }))
  }

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
    const validFiles = files.filter((file) => {
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]
      return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })

    if (validFiles.length !== files.length) {
      toast.error('일부 파일이 지원되지 않는 형식이거나 크기가 너무 큽니다.')
    }

    if (validFiles.length > 0) {
      setFormData((prev) => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...validFiles],
      }))
      toast.success(`${validFiles.length}개 파일이 추가되었습니다.`)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []

    items.forEach((item) => {
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
      setFormData((prev) => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...files],
      }))
      toast.success(`${files.length}개 파일이 붙여넣기되었습니다.`)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>{editingMaintenance ? t('buttons.edit') : t('addMaintenance')}</DialogTitle>
          <DialogDescription>
            {editingMaintenance ? '정비 기록을 수정하세요.' : '새로운 정비 기록을 등록하세요.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 border-t">
          <div className="px-6 py-3 border-b shrink-0 grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] gap-4 items-end">
            <div className="w-full max-w-[11rem]">
              <Label htmlFor="vehicle_id">{t('form.vehicleId')} *</Label>
              <Select
                value={formData.vehicle_id}
                onValueChange={(value) => patchForm({ vehicle_id: value })}
              >
                <SelectTrigger id="vehicle_id" className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="차량 선택" />
                </SelectTrigger>
                <SelectContent>
                  {activeCompanyVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicleDisplayLabel(vehicle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label htmlFor="category">{t('form.category')} *</Label>
              <UnifiedStandardLeafPicker
                groups={vehicleStandardGroups}
                value={formData.category}
                onPick={(leafId) =>
                  patchForm({
                    category: leafId || VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID,
                  })
                }
                allowClear={false}
                compact
                placeholderWhenEmpty={t('form.standardCategoryPlaceholder')}
                parentOpen={open}
                disabled={vehicleStandardGroups.length === 0}
                className="mt-1 space-y-0"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(400px,480px)_1fr] flex-1 min-h-0">
            <VehicleMaintenanceWorkTypePicker
              hasSelectedVehicle={Boolean(formSelectedVehicle)}
              hasCatalog={maintenanceCatalog.length > 0}
              groupedCatalog={catalogGroupedForForm}
              selectedSubcategories={formData.subcategories}
              onToggleSubcategory={toggleFormSubcategory}
              lastServiceByCode={formLastServiceByCode}
              intervalDisplayByCode={formIntervalDisplayByCode}
              legacyOptions={legacySubcategoryOptions}
              formatDate={formatMaintenanceStatsDate}
            />

            <VehicleMaintenanceFormDetails
              ref={formDetailsRef}
              formData={formData}
              patchForm={patchForm}
              saving={saving}
              isDragOver={isDragOver}
              isUploading={isUploading}
              paymentMethodOptions={paymentMethodOptions}
              onFileUpload={handleFileUpload}
              onRemoveFile={removeFile}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onPaste={handlePaste}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type FormDetailsHandle = {
  flushTextFields: () => Pick<
    VehicleMaintenanceFormData,
    'description' | 'notes' | 'technician_notes' | 'service_provider_address'
  >
}

type FormDetailsProps = {
  formData: VehicleMaintenanceFormData
  patchForm: (patch: Partial<VehicleMaintenanceFormData>) => void
  saving: boolean
  isDragOver: boolean
  isUploading: boolean
  paymentMethodOptions: PaymentMethodOption[]
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (index: number) => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnter: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onPaste: (e: React.ClipboardEvent) => void
  onCancel: () => void
}

/** 긴 텍스트 필드는 로컬 state — 타이핑 시 작업 구분 패널 리렌더 방지 */
const VehicleMaintenanceFormDetails = React.memo(
  React.forwardRef<FormDetailsHandle, FormDetailsProps>(function VehicleMaintenanceFormDetails(
    {
      formData,
      patchForm,
      saving,
      isDragOver,
      isUploading,
      paymentMethodOptions,
      onFileUpload,
      onRemoveFile,
      onDragOver,
      onDragEnter,
      onDragLeave,
      onDrop,
      onPaste,
      onCancel,
    },
    ref
  ) {
  const t = useTranslations('vehicleMaintenance')

  const [description, setDescription] = useState(formData.description)
  const [notes, setNotes] = useState(formData.notes)
  const [technicianNotes, setTechnicianNotes] = useState(formData.technician_notes)
  const [serviceProviderAddress, setServiceProviderAddress] = useState(
    formData.service_provider_address
  )

  useEffect(() => {
    setDescription(formData.description)
    setNotes(formData.notes)
    setTechnicianNotes(formData.technician_notes)
    setServiceProviderAddress(formData.service_provider_address)
  }, [
    formData.description,
    formData.notes,
    formData.technician_notes,
    formData.service_provider_address,
    formData.vehicle_id,
  ])

  useImperativeHandle(
    ref,
    () => ({
      flushTextFields: () => ({
        description,
        notes,
        technician_notes: technicianNotes,
        service_provider_address: serviceProviderAddress,
      }),
    }),
    [description, notes, serviceProviderAddress, technicianNotes]
  )

  const syncTextFields = useCallback(() => {
    patchForm({
      description,
      notes,
      technician_notes: technicianNotes,
      service_provider_address: serviceProviderAddress,
    })
  }, [description, notes, patchForm, serviceProviderAddress, technicianNotes])

  return (
    <div className="overflow-y-auto px-6 py-4 space-y-4 min-h-0 max-h-[min(65vh,680px)]">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="maintenance_date">{t('form.maintenanceDate')} *</Label>
          <Input
            id="maintenance_date"
            type="date"
            value={formData.maintenance_date}
            onChange={(e) => patchForm({ maintenance_date: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="mileage">{t('form.mileage')} *</Label>
          <Input
            id="mileage"
            type="number"
            min={1}
            step={1}
            value={formData.mileage}
            onChange={(e) => patchForm({ mileage: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">{t('form.description')} *</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={syncTextFields}
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
            onChange={(e) => patchForm({ total_cost: e.target.value })}
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
            onChange={(e) => patchForm({ labor_cost: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="parts_cost">{t('form.partsCost')}</Label>
          <Input
            id="parts_cost"
            type="number"
            step="0.01"
            value={formData.parts_cost}
            onChange={(e) => patchForm({ parts_cost: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="other_cost">{t('form.otherCost')}</Label>
          <Input
            id="other_cost"
            type="number"
            step="0.01"
            value={formData.other_cost}
            onChange={(e) => patchForm({ other_cost: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment_method">{t('form.paymentMethod')}</Label>
          <PaymentMethodAutocomplete
            options={paymentMethodOptions}
            valueId={formData.payment_method || ''}
            onChange={(id) => patchForm({ payment_method: id })}
            disabled={saving}
            pleaseSelectLabel={t('form.paymentMethodPlaceholder')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground mt-1">{t('form.paymentMethodHint')}</p>
          {!formData.payment_method && (
            <p className="text-xs font-medium text-amber-700 mt-1">{t('list.paymentPending')}</p>
          )}
        </div>
        <div>
          <Label htmlFor="service_provider">{t('form.serviceProvider')}</Label>
          <Input
            id="service_provider"
            value={formData.service_provider}
            onChange={(e) => patchForm({ service_provider: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="service_provider_address">{t('form.serviceProviderAddress')}</Label>
        <Textarea
          id="service_provider_address"
          value={serviceProviderAddress}
          onChange={(e) => setServiceProviderAddress(e.target.value)}
          onBlur={syncTextFields}
        />
      </div>

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
          onDragOver={!isUploading ? onDragOver : undefined}
          onDragEnter={!isUploading ? onDragEnter : undefined}
          onDragLeave={!isUploading ? onDragLeave : undefined}
          onDrop={!isUploading ? onDrop : undefined}
          onPaste={!isUploading ? onPaste : undefined}
          tabIndex={!isUploading ? 0 : -1}
          onClick={!isUploading ? () => document.getElementById('file_upload')?.click() : undefined}
        >
          <div className="flex flex-col items-center space-y-2">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isUploading ? 'bg-blue-100' : isDragOver ? 'bg-blue-200' : 'bg-gray-100'
              }`}
            >
              {isUploading ? (
                <div className="animate-spin">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              )}
            </div>
            <div>
              <p className={`text-sm font-medium ${isDragOver ? 'text-blue-900' : 'text-gray-900'}`}>
                {isUploading
                  ? '파일 업로드 중...'
                  : isDragOver
                    ? '파일을 여기에 놓으세요'
                    : '파일을 드래그하여 놓거나 클릭하여 선택하세요'}
              </p>
              <p className="text-xs text-gray-500 mt-1">또는 클립보드에서 붙여넣기 (Ctrl+V)</p>
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
            onChange={onFileUpload}
            className="hidden"
          />

          {formData.uploaded_files.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium mb-3 text-gray-900">
                업로드된 파일 ({formData.uploaded_files.length}개)
              </h4>
              <div className="space-y-2">
                {formData.uploaded_files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFile(index)
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
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
            onChange={(e) => patchForm({ warranty_period: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="next_maintenance_date">{t('form.nextMaintenanceDate')}</Label>
          <Input
            id="next_maintenance_date"
            type="date"
            value={formData.next_maintenance_date}
            onChange={(e) => patchForm({ next_maintenance_date: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quality_rating">{t('form.qualityRating')}</Label>
          <Select
            value={formData.quality_rating}
            onValueChange={(value) => patchForm({ quality_rating: value })}
          >
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
          <Select
            value={formData.satisfaction_rating}
            onValueChange={(value) => patchForm({ satisfaction_rating: value })}
          >
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
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={syncTextFields}
        />
      </div>

      <div>
        <Label htmlFor="technician_notes">{t('form.technicianNotes')}</Label>
        <Textarea
          id="technician_notes"
          value={technicianNotes}
          onChange={(e) => setTechnicianNotes(e.target.value)}
          onBlur={syncTextFields}
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_scheduled_maintenance"
          checked={formData.is_scheduled_maintenance}
          onChange={(e) => patchForm({ is_scheduled_maintenance: e.target.checked })}
        />
        <Label htmlFor="is_scheduled_maintenance">{t('form.isScheduledMaintenance')}</Label>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('buttons.cancel')}
        </Button>
        <Button type="submit" disabled={saving} onPointerDown={syncTextFields}>
          {saving ? '저장 중...' : t('buttons.save')}
        </Button>
      </div>
    </div>
  )
  })
)
