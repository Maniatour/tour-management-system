'use client'

import StringMultiSelectFilter, {
  type StringMultiSelectOption,
} from '@/components/filters/StringMultiSelectFilter'

export type CashColFilterField = {
  key: string
  label: string
  options: StringMultiSelectOption[]
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  searchable?: boolean
}

export default function CashColumnFiltersBar({ fields }: { fields: CashColFilterField[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:hidden">
      {fields.map((field) => (
        <StringMultiSelectFilter
          key={field.key}
          compact
          portal
          groupLabel={field.label}
          allLabel="전체"
          clearLabel="해제"
          selectedCountLabel={(n) => `${n}개`}
          searchPlaceholder={`${field.label} 검색`}
          emptySearchLabel="항목 없음"
          options={field.options}
          selected={field.selected}
          onChange={field.onChange}
          searchable={field.searchable ?? true}
        />
      ))}
    </div>
  )
}
