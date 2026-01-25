'use client'

import React from 'react'
import { MapPin, Folder, FolderOpen, ChevronRight, ChevronDown, Edit2 } from 'lucide-react'
import type { Database } from '@/lib/supabase'

type TourCourse = Database['public']['Tables']['tour_courses']['Row'] & {
  price_type?: string | null
  price_minivan?: number | null
  price_9seater?: number | null
  price_13seater?: number | null
  children?: TourCourse[]
}

interface CourseTreeItemProps {
  course: TourCourse
  level?: number
  expandedNodes: Set<string>
  selectedCourses: Set<string>
  onToggle: (id: string) => void
  onSelect: (course: TourCourse) => void
  onDeselect: (courseId: string) => void
  onEdit: (course: TourCourse) => void
}

const CourseTreeItem: React.FC<CourseTreeItemProps> = ({
  course,
  level = 0,
  expandedNodes,
  selectedCourses,
  onToggle,
  onSelect,
  onDeselect,
  onEdit
}) => {
  const hasChildren = course.children && course.children.length > 0
  const isExpanded = expandedNodes.has(course.id)
  const isSelected = selectedCourses.has(course.id)
  
  const getPriceDisplay = () => {
    if (course.price_type === 'per_vehicle') {
      const prices = []
      if (course.price_minivan) prices.push(`미니밴: $${course.price_minivan}`)
      if (course.price_9seater) prices.push(`9인승: $${course.price_9seater}`)
      if (course.price_13seater) prices.push(`13인승: $${course.price_13seater}`)
      return prices.length > 0 ? prices.join(' / ') : null
    } else {
      const prices = []
      if (course.price_adult) prices.push(`성인: $${course.price_adult}`)
      if (course.price_child) prices.push(`아동: $${course.price_child}`)
      if (course.price_infant) prices.push(`유아: $${course.price_infant}`)
      return prices.length > 0 ? prices.join(' / ') : null
    }
  }

  const priceDisplay = getPriceDisplay()

  return (
    <div>
      <div 
        className={`flex items-center gap-1.5 px-2 py-1 border rounded hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50 border-blue-500' : 'border-gray-200'
        }`}
        style={{ marginLeft: `${level * 12}px` }}
      >
        {/* 확장/축소 버튼 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle(course.id)
            }}
            className="w-3.5 h-3.5 flex items-center justify-center text-gray-500 hover:text-gray-700 flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <div className="w-3.5 h-3.5 flex-shrink-0"></div>
        )}
        
        {/* 체크박스 */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            if (isSelected) {
              onDeselect(course.id)
            } else {
              onSelect(course)
            }
          }}
          className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        
        {/* 폴더/파일 아이콘 */}
        <div className="flex items-center flex-shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-3 h-3 text-blue-500" />
            ) : (
              <Folder className="w-3 h-3 text-blue-500" />
            )
          ) : (
            <MapPin className="w-3 h-3 text-gray-400" />
          )}
        </div>
        
        {/* 이름 및 정보 */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="text-xs font-medium truncate">{course.name_ko || course.name_en}</div>
            {/* 위치 정보 아이콘 */}
            {(course.location || course.start_latitude || course.google_maps_url) ? (
              <MapPin className="w-3 h-3 text-green-500 flex-shrink-0" />
            ) : (
              <MapPin className="w-3 h-3 text-gray-300 flex-shrink-0" />
            )}
            {course.location && (
              <span className="text-xs text-gray-400 truncate">{course.location}</span>
            )}
            {priceDisplay ? (
              <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                • {priceDisplay}
              </span>
            ) : (
              <span className="text-xs text-red-500 whitespace-nowrap">• 입장료 미설정</span>
            )}
          </div>
          
          {/* 편집 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(course)
            }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
            title="투어 코스 편집"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {/* 하위 항목들 */}
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {course.children!.map((child) => (
            <CourseTreeItem
              key={child.id}
              course={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              selectedCourses={selectedCourses}
              onToggle={onToggle}
              onSelect={onSelect}
              onDeselect={onDeselect}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default CourseTreeItem
