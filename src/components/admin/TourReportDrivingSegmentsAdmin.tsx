'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Car, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  canManageTourReportDrivingSegments,
  displayDrivingSegmentLabel,
  type TourReportDrivingSegment,
} from '@/lib/tourReportDrivingSegments'

export default function TourReportDrivingSegmentsAdmin({ locale = 'ko' }: { locale?: string }) {
  const { user, userPosition } = useAuth()
  const canManage = canManageTourReportDrivingSegments(userPosition, user?.email)
  const getText = (ko: string, en: string) => (locale === 'en' ? en : ko)

  const [rows, setRows] = useState<TourReportDrivingSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [labelKo, setLabelKo] = useState('')
  const [labelEn, setLabelEn] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tour_report_driving_segments')
        .select('id, label_ko, label_en, sort_order, is_active')
        .order('sort_order', { ascending: true })
      if (error) throw error
      setRows((data ?? []) as TourReportDrivingSegment[])
    } catch (e) {
      console.error(e)
      toast.error(getText('Driving 구간을 불러오지 못했습니다.', 'Could not load driving segments.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!canManage) return null

  const resetForm = () => {
    setEditingId(null)
    setLabelKo('')
    setLabelEn('')
  }

  const save = async () => {
    const ko = labelKo.trim()
    const en = labelEn.trim()
    if (!ko || !en) {
      toast.error(getText('한글·영문 이름을 모두 입력하세요.', 'Enter both Korean and English labels.'))
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from('tour_report_driving_segments')
          .update({
            label_ko: ko,
            label_en: en,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', editingId)
        if (error) throw error
        toast.success(getText('구간이 수정되었습니다.', 'Segment updated.'))
      } else {
        const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), 0)
        const { error } = await supabase.from('tour_report_driving_segments').insert({
          label_ko: ko,
          label_en: en,
          sort_order: maxOrder + 10,
          is_active: true,
        } as never)
        if (error) throw error
        toast.success(getText('구간이 추가되었습니다.', 'Segment added.'))
      }
      resetForm()
      await load()
    } catch (e) {
      console.error(e)
      toast.error(getText('저장에 실패했습니다.', 'Save failed.'))
    } finally {
      setSaving(false)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= rows.length) return
    const a = rows[index]
    const b = rows[nextIndex]
    setSaving(true)
    try {
      const { error: e1 } = await supabase
        .from('tour_report_driving_segments')
        .update({ sort_order: b.sort_order, updated_at: new Date().toISOString() } as never)
        .eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('tour_report_driving_segments')
        .update({ sort_order: a.sort_order, updated_at: new Date().toISOString() } as never)
        .eq('id', b.id)
      if (e2) throw e2
      await load()
    } catch (e) {
      console.error(e)
      toast.error(getText('순서를 바꾸지 못했습니다.', 'Could not reorder.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: TourReportDrivingSegment) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tour_report_driving_segments')
        .update({ is_active: !row.is_active, updated_at: new Date().toISOString() } as never)
        .eq('id', row.id)
      if (error) throw error
      await load()
    } catch (e) {
      console.error(e)
      toast.error(getText('상태 변경에 실패했습니다.', 'Could not change status.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: TourReportDrivingSegment) => {
    if (!confirm(getText(`"${row.label_ko}" 구간을 삭제할까요?`, `Delete "${row.label_en}"?`))) return
    setSaving(true)
    try {
      const { error } = await supabase.from('tour_report_driving_segments').delete().eq('id', row.id)
      if (error) throw error
      toast.success(getText('구간이 삭제되었습니다.', 'Segment deleted.'))
      if (editingId === row.id) resetForm()
      await load()
    } catch (e) {
      console.error(e)
      toast.error(getText('삭제에 실패했습니다.', 'Delete failed.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Car className="h-5 w-5" />
          {getText('Driving 구간 관리', 'Driving segments')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {getText(
            '가이드 투어 리포트 Driving 선택지입니다. OP / OP 매니저 / Super만 추가·수정·삭제할 수 있습니다.',
            'Options shown in the guide tour report Driving section. Only OP, OP manager, and Super can edit.'
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="driving-label-ko">{getText('한글 이름', 'Korean label')}</Label>
            <Input
              id="driving-label-ko"
              value={labelKo}
              onChange={(e) => setLabelKo(e.target.value)}
              placeholder={getText('예: 킹먼 → 윌리엄스', 'e.g. Kingman -> Williams')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="driving-label-en">{getText('영문 이름', 'English label')}</Label>
            <Input
              id="driving-label-en"
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
              placeholder="Kingman -> Williams"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={saving} className="h-10">
              {editingId ? (
                <>
                  <Pencil className="mr-1 h-4 w-4" />
                  {getText('수정', 'Save')}
                </>
              ) : (
                <>
                  <Plus className="mr-1 h-4 w-4" />
                  {getText('추가', 'Add')}
                </>
              )}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} className="h-10">
                {getText('취소', 'Cancel')}
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{getText('불러오는 중…', 'Loading…')}</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {rows.map((row, index) => (
              <div key={row.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{displayDrivingSegmentLabel(row, locale)}</p>
                  <p className="text-xs text-muted-foreground">
                    {locale === 'en' ? row.label_ko : row.label_en}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={row.is_active ? 'secondary' : 'outline'}>
                    {row.is_active ? getText('사용', 'Active') : getText('숨김', 'Hidden')}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    disabled={saving || index === 0}
                    onClick={() => void move(index, -1)}
                    aria-label={getText('위로', 'Move up')}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    disabled={saving || index === rows.length - 1}
                    onClick={() => void move(index, 1)}
                    aria-label={getText('아래로', 'Move down')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setEditingId(row.id)
                      setLabelKo(row.label_ko)
                      setLabelEn(row.label_en)
                    }}
                  >
                    {getText('수정', 'Edit')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => void toggleActive(row)}
                  >
                    {row.is_active ? getText('숨기기', 'Hide') : getText('사용', 'Show')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-red-600 hover:text-red-700"
                    onClick={() => void remove(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
