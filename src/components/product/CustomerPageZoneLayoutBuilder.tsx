'use client'

import { useCallback, type CSSProperties, type ReactNode } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { reorderPageDraggableZonesAtIndex } from '@/lib/customerPageZoneLayout'
import { applyCustomerPageZoneLayoutUpdate } from '@/lib/customerPageZoneLayoutActions'
import { getPageZoneBlockDef, type ZoneLayoutPageId } from '@/lib/customerPageZoneLayoutCatalog'
import type { PageZoneLayoutView } from '@/hooks/useCustomerPageZoneLayout'
import CustomerPageZoneLayoutFrame from '@/components/product/CustomerPageZoneLayoutFrame'

const CANVAS_DROPPABLE_PREFIX = 'page-zone-layout:'

type CustomerPageZoneLayoutBuilderProps = {
  pageId: ZoneLayoutPageId
  blocks: PageZoneLayoutView[]
  renderBlock: (zoneId: string) => ReactNode
  productId?: string | null
}

export default function CustomerPageZoneLayoutBuilder({
  pageId,
  blocks,
  renderBlock,
  productId = null,
}: CustomerPageZoneLayoutBuilderProps) {
  const droppableId = `${CANVAS_DROPPABLE_PREFIX}${pageId}`

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination } = result
      if (!destination || source.index === destination.index) return
      if (source.droppableId !== droppableId || destination.droppableId !== droppableId) return

      void applyCustomerPageZoneLayoutUpdate(pageId, (layout) =>
        reorderPageDraggableZonesAtIndex(layout, pageId, source.index, destination.index)
      )
    },
    [droppableId, pageId]
  )

  const renderFrame = (
    block: PageZoneLayoutView,
    index: number,
    dragHandleProps: Parameters<typeof CustomerPageZoneLayoutFrame>[0]['dragHandleProps'] = null,
    isDragging = false
  ) => (
    <CustomerPageZoneLayoutFrame
      key={block.zoneId}
      pageId={pageId}
      zoneId={block.zoneId}
      orderIndex={index}
      totalBlocks={blocks.length}
      visible={block.visible}
      layoutEditMode
      productId={productId}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    >
      {renderBlock(block.zoneId)}
    </CustomerPageZoneLayoutFrame>
  )

  const draggableBlocks = blocks.filter((block) => {
    const def = getPageZoneBlockDef(pageId, block.zoneId)
    return !def?.fixed
  })

  const fixedTopBlocks = blocks.filter((block) => {
    const def = getPageZoneBlockDef(pageId, block.zoneId)
    return def?.fixed === 'top'
  })

  const fixedSidebarBlocks = blocks.filter((block) => {
    const def = getPageZoneBlockDef(pageId, block.zoneId)
    return def?.fixed === 'sidebar'
  })

  const fixedBottomBlocks = blocks.filter((block) => {
    const def = getPageZoneBlockDef(pageId, block.zoneId)
    return def?.fixed === 'bottom'
  })

  if (pageId === 'product-detail') {
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        {fixedTopBlocks.map((block) =>
          renderFrame(block, blocks.findIndex((entry) => entry.zoneId === block.zoneId))
        )}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <Droppable droppableId={droppableId}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-6 lg:col-span-2 lg:space-y-8 customer-page-zone-canvas"
                >
                  {draggableBlocks.map((block, dragIndex) => (
                    <Draggable key={block.zoneId} draggableId={block.zoneId} index={dragIndex}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          style={dragProvided.draggableProps.style as CSSProperties | undefined}
                        >
                          {renderFrame(
                            block,
                            blocks.findIndex((entry) => entry.zoneId === block.zoneId),
                            dragProvided.dragHandleProps,
                            snapshot.isDragging
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            <div className="space-y-6">
              {fixedSidebarBlocks.map((block) =>
                renderFrame(block, blocks.findIndex((entry) => entry.zoneId === block.zoneId))
              )}
            </div>
          </div>
        </div>
      </DragDropContext>
    )
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {fixedTopBlocks.map((block) =>
        renderFrame(block, blocks.findIndex((entry) => entry.zoneId === block.zoneId))
      )}
      <Droppable droppableId={droppableId}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`customer-page-zone-canvas ${pageId === 'product-booking' ? 'flex flex-col flex-1 min-h-0' : ''}`}
          >
            {draggableBlocks.map((block, dragIndex) => (
              <Draggable key={block.zoneId} draggableId={block.zoneId} index={dragIndex}>
                {(dragProvided, snapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    style={dragProvided.draggableProps.style as CSSProperties | undefined}
                    className={pageId === 'product-booking' && block.zoneId === 'booking-overlay-content' ? 'flex-1 min-h-0' : ''}
                  >
                    {renderFrame(
                      block,
                      blocks.findIndex((entry) => entry.zoneId === block.zoneId),
                      dragProvided.dragHandleProps,
                      snapshot.isDragging
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      {fixedBottomBlocks.map((block) =>
        renderFrame(block, blocks.findIndex((entry) => entry.zoneId === block.zoneId))
      )}
    </DragDropContext>
  )
}
