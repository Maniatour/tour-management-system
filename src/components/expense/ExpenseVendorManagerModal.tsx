'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GitMerge, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  deleteOrphanExpenseVendors,
  expenseVendorUsageLabel,
  fetchExpensesForVendorPaidTo,
  fetchPaidToNamesInUse,
  formatVendorExpenseAmount,
  formatVendorExpensePaidFor,
  mergePaidToNamesAcrossExpenseTables,
  replacePaidToAcrossExpenseTables,
  vendorLinkedExpenseEditKey,
  vendorLinkedExpenseSourceTable,
  vendorLinkedExpenseToEditDraft,
  vendorLinkedExpenseToUnifiedRow,
  vendorLinkedExpenseSourceLabel,
  type ExpenseVendorRecord,
  type ExpenseVendorUsageType,
  type VendorLinkedExpenseRow,
} from '@/lib/expenseVendors'
import { UnifiedExpenseInlineEditForm } from '@/components/reconciliation/UnifiedExpenseInlineEditForm'
import { saveUnifiedExpenseEdit, type UnifiedExpenseEditDraft } from '@/lib/unified-expense-edit'
import VendorLinkedExpenseDetailCard from '@/components/expense/VendorLinkedExpenseDetailCard'

export type { ExpenseVendorRecord }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

function expenseStatusLabel(status: string | null): string {
  if (status === 'approved') return '승인됨'
  if (status === 'pending') return '대기중'
  if (status === 'rejected') return '거부됨'
  return status ?? '—'
}

function expenseStatusClass(status: string | null): string {
  if (status === 'approved') return 'bg-green-100 text-green-800'
  if (status === 'pending') return 'bg-yellow-100 text-yellow-800'
  if (status === 'rejected') return 'bg-red-100 text-red-800'
  return 'bg-muted text-muted-foreground'
}

export default function ExpenseVendorManagerModal({ open, onOpenChange, onUpdated }: Props) {
  const [vendors, setVendors] = useState<ExpenseVendorRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUsageType, setNewUsageType] = useState<ExpenseVendorUsageType>('reusable')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUsageType, setEditUsageType] = useState<ExpenseVendorUsageType>('reusable')
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeNameMode, setMergeNameMode] = useState<'existing' | 'custom'>('existing')
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [mergeCustomName, setMergeCustomName] = useState('')
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [linkedExpenses, setLinkedExpenses] = useState<VendorLinkedExpenseRow[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [orphanCount, setOrphanCount] = useState(0)
  const [orphanVendors, setOrphanVendors] = useState<ExpenseVendorRecord[]>([])
  const [orphansExpanded, setOrphansExpanded] = useState(false)
  const [cleaningOrphans, setCleaningOrphans] = useState(false)
  const [editingExpenseKey, setEditingExpenseKey] = useState<string | null>(null)
  const [expenseEditDraft, setExpenseEditDraft] = useState<UnifiedExpenseEditDraft | null>(null)
  const [expenseEditSaving, setExpenseEditSaving] = useState(false)

  const selectedVendor = useMemo(
    () => (selectedVendorId ? vendors.find((v) => v.id === selectedVendorId) ?? null : null),
    [vendors, selectedVendorId]
  )

  const loadExpensesForVendor = useCallback(async (vendor: ExpenseVendorRecord) => {
    setSelectedVendorId(vendor.id)
    setLoadingExpenses(true)
    setLinkedExpenses([])
    setEditingExpenseKey(null)
    setExpenseEditDraft(null)
    try {
      const rows = await fetchExpensesForVendorPaidTo(supabase, vendor.name)
      setLinkedExpenses(rows)
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('결제처 지출 조회 오류:', error)
        alert('지출 내역을 불러오지 못했습니다.')
      }
    } finally {
      setLoadingExpenses(false)
    }
  }, [])

  const clearSelectedVendor = () => {
    setSelectedVendorId(null)
    setLinkedExpenses([])
    setLoadingExpenses(false)
    setEditingExpenseKey(null)
    setExpenseEditDraft(null)
  }

  const cancelExpenseEdit = () => {
    setEditingExpenseKey(null)
    setExpenseEditDraft(null)
  }

  const startExpenseEdit = (row: VendorLinkedExpenseRow) => {
    setEditingExpenseKey(vendorLinkedExpenseEditKey(row))
    setExpenseEditDraft(vendorLinkedExpenseToEditDraft(row))
  }

  const saveExpenseEdit = async (row: VendorLinkedExpenseRow) => {
    if (!expenseEditDraft || !selectedVendor) return
    setExpenseEditSaving(true)
    try {
      await saveUnifiedExpenseEdit(vendorLinkedExpenseSourceTable(row.source), row.id, expenseEditDraft)
      cancelExpenseEdit()
      await loadExpensesForVendor(selectedVendor)
      await loadVendors()
      onUpdated?.()
    } catch (error) {
      console.error('지출 수정 오류:', error)
      alert(error instanceof Error ? error.message : '지출 수정에 실패했습니다.')
    } finally {
      setExpenseEditSaving(false)
    }
  }

  const loadVendors = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data, error }, paidToInUse] = await Promise.all([
        supabase.from('expense_vendors').select('id, name, usage_type, created_at').order('name'),
        fetchPaidToNamesInUse(supabase),
      ])
      if (error) throw error

      const all = ((data ?? []) as Array<{ id: string; name: string; usage_type?: string | null }>).map(
        (row) => ({
          id: row.id,
          name: row.name,
          usage_type: row.usage_type === 'one_time' ? 'one_time' : 'reusable',
        })
      ) as ExpenseVendorRecord[]

      const linked = all.filter((v) => paidToInUse.has(v.name.trim()))
      const orphans = all.filter((v) => !paidToInUse.has(v.name.trim()))
      setOrphanCount(orphans.length)
      setOrphanVendors(orphans)
      if (orphans.length === 0) setOrphansExpanded(false)
      setVendors(linked)
      setSelectedVendorId((prev) => {
        if (prev && !linked.some((v) => v.id === prev)) {
          setLinkedExpenses([])
          setLoadingExpenses(false)
          return null
        }
        return prev
      })
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('결제처 목록 로드 오류:', error)
        alert('결제처 목록을 불러오지 못했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void loadVendors()
      setSelectedIds(new Set())
      setMergeOpen(false)
    } else {
      clearSelectedVendor()
      setOrphansExpanded(false)
    }
  }, [open, loadVendors])

  const selectedVendors = useMemo(
    () => vendors.filter((v) => selectedIds.has(v.id)),
    [vendors, selectedIds]
  )

  const mergeTargetName = useMemo(() => {
    if (mergeNameMode === 'custom') return mergeCustomName.trim()
    return vendors.find((v) => v.id === mergeTargetId)?.name.trim() ?? ''
  }, [mergeNameMode, mergeCustomName, mergeTargetId, vendors])

  const mergePreviewNames = useMemo(() => {
    const target = mergeTargetName
    if (!target) return []
    return selectedVendors.map((v) => v.name.trim()).filter((name) => name && name !== target)
  }, [selectedVendors, mergeTargetName])

  const canConfirmMerge =
    mergeNameMode === 'existing' ? Boolean(mergeTargetId) : Boolean(mergeCustomName.trim())

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    if (vendors.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      alert('이미 같은 이름의 결제처가 있습니다.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('expense_vendors').insert({ name, usage_type: newUsageType })
      if (error) throw error
      setNewName('')
      setNewUsageType('reusable')
      await loadVendors()
      onUpdated?.()
      alert('결제처를 추가했습니다. 지출에 사용되면 이 정리 목록에 표시됩니다.')
    } catch (error) {
      console.error('결제처 추가 오류:', error)
      alert('결제처 추가에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (vendor: ExpenseVendorRecord) => {
    setEditingId(vendor.id)
    setEditName(vendor.name)
    setEditUsageType(vendor.usage_type)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditUsageType('reusable')
  }

  const saveEdit = async () => {
    if (!editingId) return
    const name = editName.trim()
    if (!name) return
    const prev = vendors.find((v) => v.id === editingId)
    if (!prev) return
    if (vendors.some((v) => v.id !== editingId && v.name.toLowerCase() === name.toLowerCase())) {
      alert('이미 같은 이름의 결제처가 있습니다.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('expense_vendors')
        .update({ name, usage_type: editUsageType })
        .eq('id', editingId)
      if (error) throw error
      if (prev.name !== name) {
        await replacePaidToAcrossExpenseTables(supabase, prev.name, name)
      }
      cancelEdit()
      await loadVendors()
      if (selectedVendorId === editingId) {
        const updated = { ...prev, name, usage_type: editUsageType }
        void loadExpensesForVendor(updated)
      }
      onUpdated?.()
    } catch (error) {
      console.error('결제처 수정 오류:', error)
      alert('결제처 수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const updateUsageType = async (vendor: ExpenseVendorRecord, usage_type: ExpenseVendorUsageType) => {
    if (vendor.usage_type === usage_type) return
    setSaving(true)
    try {
      const { error } = await supabase.from('expense_vendors').update({ usage_type }).eq('id', vendor.id)
      if (error) throw error
      setVendors((prev) => prev.map((v) => (v.id === vendor.id ? { ...v, usage_type } : v)))
      onUpdated?.()
    } catch (error) {
      console.error('결제처 유형 변경 오류:', error)
      alert('결제처 유형 변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (vendor: ExpenseVendorRecord) => {
    if (
      !confirm(
        `"${vendor.name}" 결제처를 목록에서 삭제할까요?\n\n기존 지출 기록의 결제처 텍스트는 그대로 유지됩니다.`
      )
    ) {
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('expense_vendors').delete().eq('id', vendor.id)
      if (error) throw error
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(vendor.id)
        return next
      })
      if (selectedVendorId === vendor.id) clearSelectedVendor()
      await loadVendors()
      onUpdated?.()
    } catch (error) {
      console.error('결제처 삭제 오류:', error)
      alert('결제처 삭제에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const openMergeDialog = () => {
    if (selectedVendors.length < 2) {
      alert('병합할 결제처를 2개 이상 선택하세요.')
      return
    }
    setMergeNameMode('existing')
    setMergeTargetId(selectedVendors[0]?.id ?? '')
    setMergeCustomName('')
    setMergeOpen(true)
  }

  const handleMerge = async () => {
    const targetName = mergeTargetName
    if (!targetName) {
      alert('병합 후 사용할 이름을 선택하거나 입력하세요.')
      return
    }

    const sourceNames = mergePreviewNames
    if (sourceNames.length === 0) {
      alert('병합할 다른 항목이 없습니다. 다른 이름을 선택하거나 입력하세요.')
      return
    }

    const msg = [
      `아래 결제처를 "${targetName}"(으)로 병합합니다.`,
      '',
      '변경될 항목:',
      ...sourceNames.map((n) => `· ${n} → ${targetName}`),
      '',
      '회사·예약·투어 지출의 결제처(paid_to)도 함께 갱신됩니다.',
      '계속할까요?',
    ].join('\n')
    if (!confirm(msg)) return

    setSaving(true)
    try {
      await mergePaidToNamesAcrossExpenseTables(supabase, sourceNames, targetName)

      const { data: vendorRows, error: vendorFetchErr } = await supabase
        .from('expense_vendors')
        .select('id, name, usage_type')
      if (vendorFetchErr) throw vendorFetchErr

      const existingTarget =
        vendorRows?.find((v) => v.name.trim().toLowerCase() === targetName.toLowerCase()) ?? null

      let keepVendorId = existingTarget?.id ?? null
      if (!keepVendorId) {
        const usageType = selectedVendors.some((v) => v.usage_type === 'reusable')
          ? 'reusable'
          : (selectedVendors[0]?.usage_type ?? 'reusable')
        const { data: inserted, error: insertErr } = await supabase
          .from('expense_vendors')
          .insert({ name: targetName, usage_type: usageType })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        keepVendorId = inserted.id
      }

      const idsToDelete = selectedVendors.map((v) => v.id).filter((id) => id !== keepVendorId)
      if (idsToDelete.length > 0) {
        const { error: delErr } = await supabase.from('expense_vendors').delete().in('id', idsToDelete)
        if (delErr) throw delErr
      }

      setSelectedIds(new Set(keepVendorId ? [keepVendorId] : []))
      setMergeOpen(false)
      setMergeCustomName('')
      await loadVendors()

      const mergedVendor: ExpenseVendorRecord = {
        id: keepVendorId!,
        name: targetName,
        usage_type:
          existingTarget?.usage_type === 'one_time'
            ? 'one_time'
            : selectedVendors.some((v) => v.usage_type === 'reusable')
              ? 'reusable'
              : 'one_time',
      }

      if (selectedVendorId && selectedVendors.some((v) => v.id === selectedVendorId)) {
        setSelectedVendorId(mergedVendor.id)
        void loadExpensesForVendor(mergedVendor)
      } else if (selectedVendorId === mergedVendor.id) {
        void loadExpensesForVendor(mergedVendor)
      }

      onUpdated?.()
      alert(`"${targetName}"(으)로 병합했습니다.`)
    } catch (error) {
      console.error('결제처 병합 오류:', error)
      alert('결제처 병합에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleCleanupOrphans = async () => {
    if (orphanCount <= 0) return
    const nameLines = orphanVendors.map((v) => `· ${v.name}`).join('\n')
    if (
      !confirm(
        `지출과 연결되지 않은 결제처 ${orphanCount}개를 목록에서 삭제할까요?\n\n${nameLines}\n\n(OCR 오류·취소된 입력 등으로 남은 항목이 정리됩니다.)`
      )
    ) {
      return
    }
    setCleaningOrphans(true)
    try {
      const removed = await deleteOrphanExpenseVendors(supabase)
      await loadVendors()
      onUpdated?.()
      alert(removed > 0 ? `연결 없는 결제처 ${removed}개를 삭제했습니다.` : '삭제할 항목이 없습니다.')
    } catch (error) {
      console.error('고아 결제처 정리 오류:', error)
      alert('연결 없는 결제처 정리에 실패했습니다.')
    } finally {
      setCleaningOrphans(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`max-h-[85vh] overflow-hidden flex flex-col ${selectedVendor ? 'max-w-5xl' : 'max-w-2xl'}`}
        >
          <DialogHeader>
            <DialogTitle>결제처 목록 정리</DialogTitle>
            <DialogDescription>
              <strong>재사용</strong> 결제처만 지출 추가 선택지에 표시됩니다. <strong>1회</strong>는 기록용으로만
              남깁니다. 이름 변경·병합 시 기존 지출의 결제처도 함께 갱신됩니다. 결제처 이름을 클릭하면 연결된 지출
              내역을 볼 수 있습니다. 이 목록에는 <strong>지출에 실제로 연결된 결제처만</strong> 표시됩니다.
            </DialogDescription>
          </DialogHeader>

          {orphanCount > 0 && (
            <div className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  지출과 연결되지 않은 결제처 {orphanCount}개가 숨겨져 있습니다.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 border-amber-300 bg-white hover:bg-amber-100"
                  onClick={() => setOrphansExpanded((prev) => !prev)}
                  disabled={saving || loading}
                >
                  {orphansExpanded ? '목록 숨기기' : '목록 보기'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 border-amber-300 bg-white hover:bg-amber-100"
                  onClick={() => void handleCleanupOrphans()}
                  disabled={saving || cleaningOrphans || loading}
                >
                  {cleaningOrphans ? '정리 중…' : '연결 없는 항목 삭제'}
                </Button>
              </div>
              {orphansExpanded && (
                <ul className="max-h-48 overflow-y-auto rounded border border-amber-200 bg-white divide-y text-xs text-amber-950">
                  {orphanVendors.map((vendor) => (
                    <li key={vendor.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                      <span className="truncate min-w-0" title={vendor.name}>
                        {vendor.name}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {expenseVendorUsageLabel(vendor.usage_type)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 결제처 이름"
              disabled={saving}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleAdd()
                }
              }}
            />
            <Select
              value={newUsageType}
              onValueChange={(v) => setNewUsageType(v as ExpenseVendorUsageType)}
              disabled={saving}
            >
              <SelectTrigger className="w-full sm:w-[7rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reusable">재사용</SelectItem>
                <SelectItem value="one_time">1회</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" onClick={() => void handleAdd()} disabled={saving || !newName.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              추가
            </Button>
          </div>

          {selectedIds.size >= 2 && (
            <div className="flex items-center gap-2 shrink-0 text-sm">
              <span className="text-muted-foreground">{selectedIds.size}개 선택</span>
              <Button type="button" size="sm" variant="secondary" onClick={openMergeDialog} disabled={saving}>
                <GitMerge className="h-4 w-4 mr-1" />
                선택 항목 병합
              </Button>
            </div>
          )}

          <div className="flex-1 flex flex-col sm:flex-row gap-0 min-h-0 border rounded-lg mt-1 overflow-hidden">
            <div
              className={`flex flex-col min-h-[12rem] min-w-0 ${selectedVendor ? 'sm:w-[42%] sm:border-r' : 'w-full'}`}
            >
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <p className="p-4 text-sm text-muted-foreground">불러오는 중…</p>
                ) : vendors.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    지출에 연결된 결제처가 없습니다.
                    {orphanCount > 0
                      ? ' 위의 「연결 없는 항목 삭제」로 불필요한 등록을 정리할 수 있습니다.'
                      : ' 새 결제처는 지출 추가 시 등록되거나, 위 입력으로 미리 추가할 수 있습니다.'}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {vendors.map((vendor) => (
                      <li
                        key={vendor.id}
                        className={`flex items-center gap-2 px-3 py-2 ${
                          selectedVendorId === vendor.id ? 'bg-muted/60' : ''
                        }`}
                      >
                        {editingId === vendor.id ? (
                          <>
                            <div className="w-6 shrink-0" />
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 h-8"
                              disabled={saving}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void saveEdit()
                                }
                                if (e.key === 'Escape') cancelEdit()
                              }}
                            />
                            <Select
                              value={editUsageType}
                              onValueChange={(v) => setEditUsageType(v as ExpenseVendorUsageType)}
                              disabled={saving}
                            >
                              <SelectTrigger className="w-[5.5rem] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="reusable">재사용</SelectItem>
                                <SelectItem value="one_time">1회</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button type="button" size="sm" onClick={() => void saveEdit()} disabled={saving}>
                              저장
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(vendor.id)}
                                onCheckedChange={(c) => toggleSelected(vendor.id, c === true)}
                                disabled={saving}
                                aria-label={`${vendor.name} 선택`}
                              />
                            </div>
                            <button
                              type="button"
                              className="flex-1 text-sm truncate min-w-0 text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-0.5"
                              title={`${vendor.name} — 지출 내역 보기`}
                              onClick={() => void loadExpensesForVendor(vendor)}
                              disabled={saving}
                            >
                              {vendor.name}
                            </button>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={vendor.usage_type}
                                onValueChange={(v) => void updateUsageType(vendor, v as ExpenseVendorUsageType)}
                                disabled={saving}
                              >
                                <SelectTrigger className="w-[5.5rem] h-8 text-xs shrink-0">
                                  <SelectValue>{expenseVendorUsageLabel(vendor.usage_type)}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="reusable">재사용</SelectItem>
                                  <SelectItem value="one_time">1회</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              title="이름 변경"
                              onClick={(e) => {
                                e.stopPropagation()
                                startEdit(vendor)
                              }}
                              disabled={saving}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              title="목록에서 삭제"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleDelete(vendor)
                              }}
                              disabled={saving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!selectedVendor && vendors.length > 0 && !loading && (
                <p className="shrink-0 px-3 py-2 text-xs text-muted-foreground border-t">
                  결제처 이름을 클릭하면 연결된 지출 내역을 볼 수 있습니다.
                </p>
              )}
            </div>

            {selectedVendor && (
              <div className="flex-1 flex flex-col min-h-[12rem] min-w-0 sm:w-[58%]">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
                  <h3 className="text-sm font-semibold truncate" title={selectedVendor.name}>
                    &quot;{selectedVendor.name}&quot; 지출 내역
                  </h3>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={clearSelectedVendor}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">닫기</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {loadingExpenses ? (
                    <p className="text-sm text-muted-foreground text-center py-8">지출 내역 불러오는 중…</p>
                  ) : linkedExpenses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      &quot;{selectedVendor.name}&quot;에 연결된 지출이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">총 {linkedExpenses.length}건 (출처별 최대 50건)</p>
                      {linkedExpenses.map((row) => {
                        const editKey = vendorLinkedExpenseEditKey(row)
                        const isEditing = editingExpenseKey === editKey
                        return (
                          <div key={editKey} className="p-3 border rounded-lg text-sm space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {vendorLinkedExpenseSourceLabel(row.source)}
                              </span>
                              <span className="font-medium">{formatVendorExpensePaidFor(row)}</span>
                              <span className="font-semibold text-green-700">{formatVendorExpenseAmount(row.amount)}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${expenseStatusClass(row.status)}`}>
                                {expenseStatusLabel(row.status)}
                              </span>
                              <div className="ml-auto flex items-center gap-1">
                                {isEditing ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    disabled={expenseEditSaving}
                                    onClick={cancelExpenseEdit}
                                  >
                                    취소
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    disabled={expenseEditSaving || saving}
                                    onClick={() => startExpenseEdit(row)}
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    수정
                                  </Button>
                                )}
                              </div>
                            </div>
                            {!isEditing && <VendorLinkedExpenseDetailCard row={row} />}
                            {isEditing && expenseEditDraft ? (
                              <UnifiedExpenseInlineEditForm
                                row={vendorLinkedExpenseToUnifiedRow(row)}
                                draft={expenseEditDraft}
                                onDraftChange={setExpenseEditDraft}
                                saving={expenseEditSaving}
                                onSave={() => void saveExpenseEdit(row)}
                                onCancel={cancelExpenseEdit}
                              />
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mergeOpen}
        onOpenChange={(next) => {
          setMergeOpen(next)
          if (!next) {
            setMergeCustomName('')
            setMergeNameMode('existing')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>결제처 병합</DialogTitle>
            <DialogDescription>
              선택한 항목을 하나의 이름으로 합칩니다. 기존 이름을 고르거나 새 이름을 직접 입력할 수 있습니다. 나머지
              항목은 목록에서 제거되고, 지출 기록의 결제처는 병합 대상 이름으로 바뀝니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mergeNameMode === 'existing' ? 'default' : 'outline'}
                disabled={saving}
                onClick={() => setMergeNameMode('existing')}
              >
                선택 항목 중 선택
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mergeNameMode === 'custom' ? 'default' : 'outline'}
                disabled={saving}
                onClick={() => setMergeNameMode('custom')}
              >
                직접 입력
              </Button>
            </div>

            {mergeNameMode === 'existing' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">병합 후 남길 이름</p>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue placeholder="병합 대상 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedVendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">병합 후 사용할 이름</p>
                <Input
                  value={mergeCustomName}
                  onChange={(e) => setMergeCustomName(e.target.value)}
                  placeholder="새 결제처 이름 입력"
                  disabled={saving}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canConfirmMerge) {
                      e.preventDefault()
                      void handleMerge()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  목록에 없는 새 이름이거나, 기존에 등록된 결제처 이름을 입력할 수 있습니다.
                </p>
              </div>
            )}

            {mergeTargetName && mergePreviewNames.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-0.5 pt-1 rounded-md border bg-muted/30 px-3 py-2">
                {mergePreviewNames.map((name) => (
                  <li key={name}>
                    · {name} → {mergeTargetName}
                  </li>
                ))}
              </ul>
            )}
            {mergeTargetName && mergePreviewNames.length === 0 && (
              <p className="text-xs text-amber-700 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                선택한 항목과 동일한 이름입니다. 다른 이름을 선택하거나 입력하세요.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMergeOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => void handleMerge()}
              disabled={saving || !canConfirmMerge || mergePreviewNames.length === 0}
            >
              병합
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
