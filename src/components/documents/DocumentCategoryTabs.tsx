'use client'

export interface DocumentCategoryTab {
  id: string
  label: string
  count: number
  color?: string | null
  depth?: number
}

interface DocumentCategoryTabsProps {
  tabs: DocumentCategoryTab[]
  selectedId: string
  onSelect: (id: string) => void
  childTabs?: DocumentCategoryTab[]
  selectedChildId?: string
}

function TabButton({
  tab,
  active,
  onSelect,
}: {
  tab: DocumentCategoryTab
  active: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(tab.id)}
      className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors sm:px-4 ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
      }`}
    >
      {tab.color ? (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: tab.color }}
          aria-hidden
        />
      ) : null}
      <span>
        {tab.depth ? `${'└ '.repeat(Math.min(tab.depth, 3))}` : ''}
        {tab.label}
      </span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums sm:px-2 sm:text-xs ${
          active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
        }`}
      >
        {tab.count}
      </span>
    </button>
  )
}

export default function DocumentCategoryTabs({
  tabs,
  selectedId,
  onSelect,
  childTabs = [],
  selectedChildId,
}: DocumentCategoryTabsProps) {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200/80">
      <div className="overflow-x-auto">
        <nav role="tablist" aria-label="문서 카테고리" className="flex min-w-0 gap-1 px-2 sm:px-4">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={selectedId === tab.id}
              onSelect={onSelect}
            />
          ))}
        </nav>
      </div>
      {childTabs.length > 0 ? (
        <div className="overflow-x-auto border-t border-gray-100 bg-slate-50/80">
          <nav role="tablist" aria-label="하위 폴더" className="flex min-w-0 gap-1 px-2 sm:px-4">
            {childTabs.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                active={selectedChildId === tab.id}
                onSelect={onSelect}
              />
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  )
}
