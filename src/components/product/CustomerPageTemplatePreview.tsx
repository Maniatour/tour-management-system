'use client'

import type { CustomerPageTemplateDefinition } from '@/lib/customerPageTemplate'
import { getTemplatePreviewTheme } from '@/lib/customerPageTemplate'
import {
  applyGlobalStructureToSections,
  getCatalogItem,
  getSectionKindLabel,
  type HomePageSectionEntry,
} from '@/lib/customerPageHomeSectionCatalog'
import { normalizeHomePageLayout } from '@/lib/customerPageHomeLayout'

type CustomerPageTemplatePreviewProps = {
  template: CustomerPageTemplateDefinition
  className?: string
  compact?: boolean
}

function SectionWireframe({
  section,
  themeAccent,
}: {
  section: HomePageSectionEntry
  themeAccent: string
}) {
  const variant = section.config.structureVariant ?? getCatalogItem(section.kind).defaultConfig.structureVariant
  const cardCount = Math.min(section.config.cardCount ?? 3, 4)

  if (section.kind === 'hero') {
    if (variant === 'split-editorial') {
      return (
        <div className="flex gap-1 h-full">
          <div className="flex-1 rounded bg-white/35 p-1 flex flex-col justify-end gap-0.5">
            <span className="h-1.5 w-3/4 rounded bg-white/60" />
            <span className="h-1 w-1/2 rounded bg-white/45" />
          </div>
          <div className="w-[38%] rounded bg-white/25" />
        </div>
      )
    }
    if (variant === 'full-immersive') {
      return (
        <div className="h-full flex flex-col justify-end gap-1 p-1">
          <span className="h-2 w-4/5 rounded bg-white/55" />
          <span className="h-1 w-2/5 rounded bg-white/40" />
        </div>
      )
    }
    if (variant === 'compact-bar') {
      return (
        <div className="h-full flex items-center justify-between gap-1 px-1">
          <span className="h-1.5 w-1/2 rounded bg-white/50" />
          <span className="h-2 w-1/4 rounded-md bg-white/45" style={{ backgroundColor: themeAccent }} />
        </div>
      )
    }
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1 px-2">
        <span className="h-1.5 w-3/4 rounded bg-white/55" />
        <span className="h-1 w-1/2 rounded bg-white/40" />
        <span className="h-2 w-1/3 rounded-md bg-white/50 mt-0.5" />
      </div>
    )
  }

  if (section.kind === 'categories') {
    if (variant === 'horizontal-scroll') {
      return (
        <div className="flex gap-0.5 h-full items-center px-0.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="shrink-0 w-5 h-4 rounded bg-white/35" />
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
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="rounded bg-white/35" />
        ))}
      </div>
    )
  }

  if (section.kind === 'stats') {
    if (variant === 'highlight-band') {
      return (
        <div className="h-full flex items-center justify-around bg-white/20 rounded px-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="h-2 w-3 rounded bg-white/45" />
          ))}
        </div>
      )
    }
    return (
      <div className="grid grid-cols-4 gap-0.5 h-full items-center">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="h-2 rounded bg-white/35 mx-auto w-full max-w-[90%]" />
        ))}
      </div>
    )
  }

  if (section.kind === 'card-list') {
    if (variant === 'horizontal-scroll') {
      return (
        <div className="flex gap-0.5 h-full items-stretch px-0.5">
          {Array.from({ length: cardCount }).map((_, i) => (
            <span key={i} className="shrink-0 w-6 rounded bg-white/35 flex flex-col overflow-hidden">
              <span className="h-2 bg-white/25" />
              <span className="flex-1 m-0.5 rounded-sm bg-white/20" />
            </span>
          ))}
        </div>
      )
    }
    if (variant === 'stacked-list') {
      return (
        <div className="flex flex-col gap-0.5 h-full justify-center px-0.5">
          {Array.from({ length: Math.min(cardCount, 3) }).map((_, i) => (
            <span key={i} className="h-2.5 rounded bg-white/35 flex">
              <span className="w-3 bg-white/25 rounded-l" />
              <span className="flex-1 m-0.5 rounded-sm bg-white/20" />
            </span>
          ))}
        </div>
      )
    }
    const cols = variant === 'grid-two-large' ? 2 : 3
    return (
      <div className={`grid gap-0.5 h-full p-0.5`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <span
            key={i}
            className={`rounded bg-white/35 flex flex-col overflow-hidden ${variant === 'featured-plus-grid' && i === 0 ? 'col-span-2 row-span-2' : ''}`}
          >
            <span className="h-2 bg-white/25" />
            <span className="flex-1 m-0.5 rounded-sm bg-white/20" />
          </span>
        ))}
      </div>
    )
  }

  if (section.kind === 'features') {
    if (variant === 'alternating-rows') {
      return (
        <div className="flex flex-col gap-0.5 h-full justify-center px-0.5">
          {[0, 1].map((i) => (
            <span key={i} className="h-2 rounded bg-white/35 flex items-center gap-0.5 px-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />
              <span className="h-1 flex-1 rounded bg-white/30" />
            </span>
          ))}
        </div>
      )
    }
    return (
      <div className="grid grid-cols-2 gap-0.5 h-full p-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="rounded bg-white/30 p-0.5 flex flex-col gap-0.5">
            <span className="h-1 w-1/2 rounded bg-white/45" />
            <span className="h-0.5 w-full rounded bg-white/25" />
          </span>
        ))}
      </div>
    )
  }

  if (section.kind === 'cta') {
    if (variant === 'full-band') {
      return (
        <div className="h-full rounded bg-white/25 flex flex-col items-center justify-center gap-0.5">
          <span className="h-1 w-1/2 rounded bg-white/50" />
          <span className="h-2 w-1/3 rounded-md bg-white/45" />
        </div>
      )
    }
    return (
      <div className="h-full flex flex-col items-center justify-center gap-0.5">
        <span className="h-1 w-2/5 rounded bg-white/45" />
        <div className="flex gap-0.5">
          <span className="h-2 w-4 rounded-md bg-white/50" />
          <span className="h-2 w-4 rounded-md bg-white/30" />
        </div>
      </div>
    )
  }

  if (section.kind === 'reviews') {
    return (
      <div className="grid grid-cols-3 gap-0.5 h-full p-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded bg-white/35" />
        ))}
      </div>
    )
  }

  if (section.kind === 'faq') {
    return (
      <div className="flex flex-col gap-0.5 h-full justify-center px-0.5">
        {[0, 1].map((i) => (
          <span key={i} className="h-1.5 rounded bg-white/35" />
        ))}
      </div>
    )
  }

  if (section.kind === 'gallery') {
    return (
      <div className="grid grid-cols-4 gap-0.5 h-full p-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="rounded bg-white/35" />
        ))}
      </div>
    )
  }

  if (section.kind === 'logos') {
    return (
      <div className="flex gap-0.5 h-full items-center justify-center">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 w-3 rounded bg-white/30" />
        ))}
      </div>
    )
  }

  if (section.kind === 'video') {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="w-2/3 h-2/3 rounded bg-white/25" />
      </div>
    )
  }

  if (section.kind === 'newsletter' || section.kind === 'promo' || section.kind === 'rich-text') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-0.5">
        <span className="h-1 w-1/2 rounded bg-white/45" />
        <span className="h-1.5 w-1/3 rounded bg-white/35" />
      </div>
    )
  }

  return <span className="block h-full rounded bg-white/30" />
}

export default function CustomerPageTemplatePreview({
  template,
  className = '',
  compact = false,
}: CustomerPageTemplatePreviewProps) {
  const theme = getTemplatePreviewTheme(template)
  const layout = normalizeHomePageLayout(template.homeLayout)
  const sections = applyGlobalStructureToSections(layout.sections, template.structure).filter(
    (s) => s.visible
  )

  return (
    <div
      className={`rounded-xl border border-slate-200/80 overflow-hidden bg-slate-100 shadow-inner ${className}`}
    >
      <div
        className={`${compact ? 'h-36' : 'h-52'} overflow-hidden flex flex-col`}
        style={{
          background: `linear-gradient(180deg, ${theme.previewFrom} 0%, ${theme.previewTo} 100%)`,
        }}
      >
        {sections.map((section) => (
          <div
            key={section.instanceId}
            className={`shrink-0 border-b border-white/10 px-1.5 py-1 ${
              section.kind === 'hero' ? (compact ? 'h-10' : 'h-14') : compact ? 'h-6' : 'h-8'
            }`}
            title={getSectionKindLabel(section.kind)}
          >
            <SectionWireframe section={section} themeAccent={theme.accentColor} />
          </div>
        ))}
      </div>
      {!compact && (
        <div className="px-2 py-1.5 bg-white/90 text-[9px] text-slate-500 flex flex-wrap gap-1">
          {sections.map((s) => (
            <span key={s.instanceId} className="px-1 py-0.5 rounded bg-slate-100">
              {getSectionKindLabel(s.kind)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
