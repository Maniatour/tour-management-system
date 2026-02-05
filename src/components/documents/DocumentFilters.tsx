'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc, 
  Grid3X3, 
  List,
  Calendar,
  Folder,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface DocumentCategory {
  id: string
  name_ko: string
  name_en: string
  color: string
  icon: string
}

interface DocumentFiltersProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  categories: DocumentCategory[]
  selectedCategory: string
  setSelectedCategory: (category: string) => void
  expiryFilter: string
  setExpiryFilter: (filter: string) => void
  sortBy: 'title' | 'expiry_date' | 'created_at'
  setSortBy: (sort: 'title' | 'expiry_date' | 'created_at') => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (order: 'asc' | 'desc') => void
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
}

export default function DocumentFilters({
  searchQuery,
  setSearchQuery,
  categories,
  selectedCategory,
  setSelectedCategory,
  expiryFilter,
  setExpiryFilter,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  viewMode,
  setViewMode
}: DocumentFiltersProps) {
  const t = useTranslations('documents')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filterContent = (
    <>
      {/* 카테고리 필터 */}
      <div className="flex items-center gap-2 min-w-0">
        <Folder className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="flex-1 min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">모든 카테고리</option>
          <option value="uncategorized">미분류</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name_ko}
            </option>
          ))}
        </select>
      </div>
      {/* 만료일 필터 */}
      <div className="flex items-center gap-2 min-w-0">
        <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
          className="flex-1 min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">모든 상태</option>
          <option value="active">활성</option>
          <option value="expiring_soon">만료 예정 (30일)</option>
          <option value="expired">만료됨</option>
        </select>
      </div>
      {/* 정렬 */}
      <div className="flex items-center gap-1 sm:gap-2">
        <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'title' | 'expiry_date' | 'created_at')}
          className="flex-1 min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="expiry_date">만료일</option>
          <option value="title">제목</option>
          <option value="created_at">생성일</option>
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label={sortOrder === 'asc' ? '오름차순' : '내림차순'}
        >
          {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
        </button>
      </div>
      {/* 뷰 모드 */}
      <div className="flex items-center border border-gray-300 rounded-lg p-0.5">
        <button
          onClick={() => setViewMode('grid')}
          className={`p-1.5 sm:p-2 rounded ${
            viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-label="그리드 보기"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-1.5 sm:p-2 rounded ${
            viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-label="목록 보기"
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </>
  )

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:gap-0 lg:flex-row lg:items-center lg:justify-between lg:space-x-4">
        {/* 검색 + 모바일 필터 토글 */}
        <div className="flex-1 w-full min-w-0 flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="문서 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="lg:hidden flex items-center justify-center p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            aria-expanded={filtersOpen}
          >
            <Filter className="w-4 h-4 mr-1" />
            {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* 필터들 - 모바일: 접이식, 데스크톱: 한 줄 */}
        <div
          className={`gap-2 sm:gap-3 ${filtersOpen ? 'grid grid-cols-1 sm:grid-cols-2' : 'hidden'} lg:flex lg:flex-wrap lg:items-center lg:gap-4`}
        >
          {filterContent}
        </div>
      </div>
    </div>
  )
}
