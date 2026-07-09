'use client'

import type { HomeSectionKind } from '@/lib/customerPageHomeSectionCatalog'
import type { HomeSectionPreset } from '@/lib/customerPageHomeSectionPresets'
import { getCatalogItem } from '@/lib/customerPageHomeSectionCatalog'

function MiniWireframe({ preset }: { preset: HomeSectionPreset }) {
  const variant = preset.config.structureVariant ?? ''
  const cardCount = Math.min(preset.config.cardCount ?? 3, 3)
  const kind = preset.kind

  if (kind === 'hero') {
    if (variant === 'split-editorial') {
      return (
        <div className="flex gap-0.5 h-full p-1">
          <div className="flex-1 rounded bg-white/35" />
          <div className="w-[35%] rounded bg-white/25" />
        </div>
      )
    }
    if (variant === 'full-immersive') {
      return (
        <div className="h-full flex flex-col justify-end p-1 gap-0.5">
          <span className="h-1.5 w-3/4 rounded bg-white/50" />
          <span className="h-1 w-1/3 rounded bg-white/35" />
        </div>
      )
    }
    if (variant === 'compact-bar') {
      return (
        <div className="h-full flex items-center justify-between px-1 gap-1">
          <span className="h-1 w-1/2 rounded bg-white/45" />
          <span className="h-2 w-1/4 rounded bg-white/40" />
        </div>
      )
    }
    return (
      <div className="h-full flex flex-col items-center justify-center gap-0.5 p-1">
        <span className="h-1 w-2/3 rounded bg-white/50" />
        <span className="h-1.5 w-1/3 rounded bg-white/40" />
      </div>
    )
  }

  if (kind === 'categories') {
    if (variant === 'horizontal-scroll') {
      return (
        <div className="flex gap-0.5 h-full items-center px-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="shrink-0 w-4 h-3 rounded bg-white/35" />
          ))}
        </div>
      )
    }
    if (variant === 'bento-asymmetric') {
      return (
        <div className="grid grid-cols-3 grid-rows-2 gap-0.5 h-full p-0.5">
          <span className="col-span-2 row-span-2 rounded bg-white/40" />
          <span className="rounded bg-white/30" />
          <span className="rounded bg-white/30" />
        </div>
      )
    }
    return (
      <div className="grid grid-cols-4 gap-0.5 h-full p-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="rounded bg-white/35" />
        ))}
      </div>
    )
  }

  if (kind === 'stats') {
    if (variant === 'highlight-band') {
      return (
        <div className="h-full flex items-center justify-around bg-white/20 rounded mx-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-1.5 w-3 rounded bg-white/45" />
          ))}
        </div>
      )
    }
    return (
      <div className="grid grid-cols-4 gap-0.5 h-full items-center px-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 rounded bg-white/35" />
        ))}
      </div>
    )
  }

  if (kind === 'card-list') {
    if (variant === 'horizontal-scroll') {
      return (
        <div className="flex gap-0.5 h-full items-stretch px-0.5">
          {Array.from({ length: cardCount }).map((_, i) => (
            <span key={i} className="shrink-0 w-5 rounded bg-white/35 flex flex-col">
              <span className="h-1.5 bg-white/25 rounded-t" />
              <span className="flex-1 m-0.5 rounded-sm bg-white/20" />
            </span>
          ))}
        </div>
      )
    }
    if (variant === 'stacked-list') {
      return (
        <div className="flex flex-col gap-0.5 h-full justify-center px-0.5">
          {[0, 1].map((i) => (
            <span key={i} className="h-2 rounded bg-white/35 flex">
              <span className="w-2 bg-white/25 rounded-l" />
            </span>
          ))}
        </div>
      )
    }
    const cols = variant === 'grid-two-large' ? 2 : 3
    return (
      <div className="grid gap-0.5 h-full p-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <span key={i} className="rounded bg-white/35 flex flex-col">
            <span className="h-1 bg-white/25 rounded-t" />
          </span>
        ))}
      </div>
    )
  }

  if (kind === 'features') {
    return (
      <div className="grid grid-cols-2 gap-0.5 h-full p-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="rounded bg-white/30" />
        ))}
      </div>
    )
  }

  if (kind === 'reviews') {
    if (variant === 'featured-quote') {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-1 p-1">
          <span className="h-0.5 w-1/3 rounded bg-white/40" />
          <span className="h-1 w-4/5 rounded bg-white/50" />
        </div>
      )
    }
    if (variant === 'carousel-strip') {
      return (
        <div className="flex gap-0.5 h-full items-stretch px-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="shrink-0 w-5 rounded bg-white/35" />
          ))}
        </div>
      )
    }
    return (
      <div className="grid grid-cols-3 gap-0.5 h-full p-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded bg-white/35" />
        ))}
      </div>
    )
  }

  if (kind === 'faq') {
    return (
      <div className="flex flex-col gap-0.5 h-full justify-center px-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 rounded bg-white/35" />
        ))}
      </div>
    )
  }

  if (kind === 'gallery') {
    if (variant === 'horizontal-scroll') {
      return (
        <div className="flex gap-0.5 h-full items-center px-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="shrink-0 w-4 h-full rounded bg-white/35" />
          ))}
        </div>
      )
    }
    return (
      <div className="grid grid-cols-4 gap-0.5 h-full p-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="rounded bg-white/35" />
        ))}
      </div>
    )
  }

  if (kind === 'logos') {
    return (
      <div className="flex gap-0.5 h-full items-center justify-center px-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="h-2 w-4 rounded bg-white/30" />
        ))}
      </div>
    )
  }

  if (kind === 'video') {
    return (
      <div className="h-full flex items-center justify-center p-1">
        <span className="w-full aspect-video max-h-full rounded bg-white/25 flex items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-white/50" />
        </span>
      </div>
    )
  }

  if (kind === 'newsletter') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-0.5 px-1">
        <span className="h-1 w-1/2 rounded bg-white/45" />
        <span className="h-2 w-3/4 rounded bg-white/35" />
      </div>
    )
  }

  if (kind === 'promo') {
    return (
      <div className="h-full rounded bg-white/25 flex flex-col items-center justify-center gap-0.5 mx-0.5">
        <span className="h-1 w-1/2 rounded bg-white/50" />
        <span className="h-2 w-1/3 rounded-md bg-white/45" />
      </div>
    )
  }

  if (kind === 'rich-text') {
    if (variant === 'split-media') {
      return (
        <div className="flex gap-0.5 h-full p-0.5">
          <span className="w-1/2 rounded bg-white/35" />
          <span className="w-1/2 flex flex-col gap-0.5 justify-center">
            <span className="h-1 w-full rounded bg-white/40" />
            <span className="h-0.5 w-4/5 rounded bg-white/25" />
          </span>
        </div>
      )
    }
    return (
      <div className="h-full flex flex-col items-center justify-center gap-0.5 px-1">
        <span className="h-1 w-2/3 rounded bg-white/45" />
        <span className="h-0.5 w-full rounded bg-white/25" />
        <span className="h-0.5 w-4/5 rounded bg-white/20" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-0.5">
      <span className="h-1 w-1/2 rounded bg-white/45" />
      <span className="h-2 w-1/3 rounded bg-white/35" />
    </div>
  )
}

type HomeSectionPresetCardProps = {
  preset: HomeSectionPreset
  selected: boolean
  onSelect: () => void
}

export default function HomeSectionPresetCard({ preset, selected, onSelect }: HomeSectionPresetCardProps) {
  const catalog = getCatalogItem(preset.kind)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-xl border-2 overflow-hidden transition-all hover:shadow-md ${
        selected
          ? 'border-violet-500 ring-2 ring-violet-200 shadow-sm'
          : 'border-slate-200 hover:border-violet-300'
      }`}
    >
      <div
        className="h-14 px-1 py-1"
        style={{
          background: `linear-gradient(135deg, ${preset.previewFrom}, ${preset.previewTo})`,
        }}
      >
        <MiniWireframe preset={preset} />
      </div>
      <div className="p-2 bg-white">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm">{catalog.icon}</span>
          <p className="text-xs font-semibold text-gray-900 truncate">{preset.label}</p>
        </div>
        <p className="text-[10px] text-gray-500 line-clamp-2 leading-snug">{preset.description}</p>
        <div className="flex flex-wrap gap-0.5 mt-1.5">
          {preset.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[9px] px-1 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {tag}
            </span>
          ))}
          {preset.kind === 'card-list' && preset.config.cardCount != null && (
            <span className="text-[9px] px-1 py-0.5 rounded-full bg-violet-50 text-violet-700">
              {preset.config.cardCount}장
            </span>
          )}
          {preset.config.itemCount != null &&
            ['reviews', 'faq', 'gallery', 'logos'].includes(preset.kind) && (
              <span className="text-[9px] px-1 py-0.5 rounded-full bg-violet-50 text-violet-700">
                {preset.config.itemCount}개
              </span>
            )}
        </div>
      </div>
    </button>
  )
}

export function HomeSectionPresetKindIcon({ kind }: { kind: HomeSectionKind }) {
  return <span>{getCatalogItem(kind).icon}</span>
}
