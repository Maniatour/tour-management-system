'use client'

import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'
import StringMultiSelectFilter, {
  type StringMultiSelectOption,
} from '@/components/filters/StringMultiSelectFilter'
import type { SortDir } from '@/lib/clientTableSort'

type Props = {
  label: string
  sortKey: string
  activeSortKey: string
  sortDir: SortDir
  onSort: (key: string) => void
  filterOptions: StringMultiSelectOption[]
  filterSelected: ReadonlySet<string>
  onFilterChange: (next: Set<string>) => void
  searchable?: boolean
}

export default function CashColumnHeader({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  filterOptions,
  filterSelected,
  onFilterChange,
  searchable = true,
}: Props) {
  return (
    <div className="flex min-w-0 items-start gap-0.5 py-0.5">
      <div className="min-w-0 flex-1">
        <StringMultiSelectFilter
          compact
          hideLabel
          portal
          groupLabel={label}
          allLabel="전체"
          clearLabel="해제"
          selectedCountLabel={(n) => `${label} ${n}개`}
          searchPlaceholder={`${label} 검색`}
          emptySearchLabel="항목 없음"
          options={filterOptions}
          selected={filterSelected}
          onChange={onFilterChange}
          searchable={searchable}
        />
      </div>
      <TableSortHeaderButton
        label={<span className="sr-only">{label} 정렬</span>}
        active={activeSortKey === sortKey}
        dir={sortDir}
        onClick={() => onSort(sortKey)}
        className="mt-1.5 shrink-0"
      />
    </div>
  )
}
