'use client'

import { useCallback, useEffect, useState } from 'react'
import { Edit, Loader2, MapPin, Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import TourCourseEditModal from '@/components/TourCourseEditModal'

type TourCourseRow = {
  id: string
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string | null
  customer_name_en: string | null
  location: string | null
  category: string | null
}

type CustomerPageTourCoursesCatalogProps = {
  locale: string
  onSaved?: () => void
}

export default function CustomerPageTourCoursesCatalog({
  locale,
  onSaved,
}: CustomerPageTourCoursesCatalogProps) {
  const [courses, setCourses] = useState<TourCourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingCourse, setEditingCourse] = useState<TourCourseRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetchCourses = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tour_courses')
        .select('id, name_ko, name_en, customer_name_ko, customer_name_en, location, category')
        .order('name_ko', { ascending: true })
        .limit(100)

      if (error) throw error
      setCourses((data ?? []) as TourCourseRow[])
    } catch (err) {
      console.error('Failed to load tour courses:', err)
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCourses()
  }, [fetchCourses])

  const getLabel = (course: TourCourseRow) => {
    if (locale === 'en') {
      return course.customer_name_en || course.name_en || course.name_ko || 'Untitled'
    }
    return course.customer_name_ko || course.name_ko || course.name_en || '이름 없음'
  }

  const filtered = courses.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const label = getLabel(c).toLowerCase()
    return label.includes(q) || (c.location ?? '').toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        투어 코스 불러오는 중…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        맞춤 투어 빌더에 사용되는 투어 코스를 검색·편집합니다.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="코스명·위치 검색"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          추가
        </button>
      </div>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {filtered.length === 0 ? (
          <li className="px-4 py-6 text-sm text-gray-500 text-center">코스가 없습니다.</li>
        ) : (
          filtered.map((course) => (
            <li
              key={course.id}
              className="flex items-center justify-between gap-2 px-3 py-2.5 bg-white hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{getLabel(course)}</p>
                {course.location && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {course.location}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditingCourse(course)}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-primary border border-border rounded-md hover:bg-muted/50"
              >
                <Edit className="h-3.5 w-3.5" />
                편집
              </button>
            </li>
          ))
        )}
      </ul>

      {(editingCourse || showCreate) && (
        <TourCourseEditModal
          isOpen
          course={
            showCreate
              ? ({ id: '', name_ko: '', name_en: '' } as Parameters<
                  typeof TourCourseEditModal
                >[0]['course'])
              : (editingCourse as Parameters<typeof TourCourseEditModal>[0]['course'])
          }
          onClose={() => {
            setEditingCourse(null)
            setShowCreate(false)
          }}
          onSave={() => {
            setEditingCourse(null)
            setShowCreate(false)
            void fetchCourses()
            onSaved?.()
          }}
        />
      )}
    </div>
  )
}
