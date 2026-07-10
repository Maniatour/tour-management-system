'use client'

import type { ReactNode } from 'react'
import { useCustomerPageZoneLayoutViews } from '@/hooks/useCustomerPageZoneLayout'
import { getPageZoneBlockDef, type ZoneLayoutPageId } from '@/lib/customerPageZoneLayoutCatalog'
import CustomerPageZoneLayoutBuilder from '@/components/product/CustomerPageZoneLayoutBuilder'

type CustomerPageZoneLayoutRendererProps = {
  pageId: ZoneLayoutPageId
  layoutEditMode: boolean
  renderBlock: (zoneId: string) => ReactNode
  productId?: string | null
}

export default function CustomerPageZoneLayoutRenderer({
  pageId,
  layoutEditMode,
  renderBlock,
  productId = null,
}: CustomerPageZoneLayoutRendererProps) {
  const blocks = useCustomerPageZoneLayoutViews(pageId, layoutEditMode)

  if (layoutEditMode) {
    return (
      <CustomerPageZoneLayoutBuilder
        pageId={pageId}
        blocks={blocks}
        renderBlock={renderBlock}
        productId={productId}
      />
    )
  }

  if (pageId === 'product-detail') {
    const headerBlock = blocks.find((b) => b.zoneId === 'detail-header')
    const sidebarBlock = blocks.find((b) => b.zoneId === 'detail-sidebar')
    const mainBlocks = blocks.filter((b) => {
      const def = getPageZoneBlockDef(pageId, b.zoneId)
      return !def?.fixed && b.visible
    })

    return (
      <>
        {headerBlock?.visible && renderBlock('detail-header')}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="space-y-6 lg:col-span-2 lg:space-y-8">
              {mainBlocks.map((block) => (
                <div key={block.zoneId}>{renderBlock(block.zoneId)}</div>
              ))}
            </div>
            {sidebarBlock?.visible && renderBlock('detail-sidebar')}
          </div>
        </div>
      </>
    )
  }

  if (pageId === 'product-booking') {
    const fixedTopBlocks = blocks.filter((block) => {
      const def = getPageZoneBlockDef(pageId, block.zoneId)
      return def?.fixed === 'top' && block.visible
    })
    const fixedBottomBlocks = blocks.filter((block) => {
      const def = getPageZoneBlockDef(pageId, block.zoneId)
      return def?.fixed === 'bottom' && block.visible
    })
    const middleBlocks = blocks.filter((block) => {
      const def = getPageZoneBlockDef(pageId, block.zoneId)
      return !def?.fixed && block.visible
    })

    return (
      <div className="flex flex-col flex-1 min-h-0">
        {fixedTopBlocks.map((block) => (
          <div key={block.zoneId}>{renderBlock(block.zoneId)}</div>
        ))}
        <div className="flex flex-col flex-1 min-h-0">
          {middleBlocks.map((block) => (
            <div
              key={block.zoneId}
              className={block.zoneId === 'booking-overlay-content' ? 'flex-1 min-h-0' : ''}
            >
              {renderBlock(block.zoneId)}
            </div>
          ))}
        </div>
        {fixedBottomBlocks.map((block) => (
          <div key={block.zoneId}>{renderBlock(block.zoneId)}</div>
        ))}
      </div>
    )
  }

  return (
    <>
      {blocks
        .filter((block) => block.visible)
        .map((block) => (
          <div key={block.zoneId}>{renderBlock(block.zoneId)}</div>
        ))}
    </>
  )
}
