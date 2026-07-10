'use client'

import { useCallback, type CSSProperties, type ReactNode } from 'react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { reorderHomeSectionsAtIndex, insertHomeSectionFromPresetAtIndex } from '@/lib/customerPageHomeLayout'
import { applyCustomerPageHomeLayoutUpdate } from '@/lib/customerPageHomeLayoutActions'
import {
  applyHomeSectionPreset,
  getHomeSectionPresetById,
} from '@/lib/customerPageHomeSectionPresets'
import type { HomeLayoutSectionView } from '@/hooks/useCustomerPageHomeLayout'
import CustomerPageHomeSectionFrame from '@/components/product/CustomerPageHomeSectionFrame'
import CustomerPageHomeSectionPalette from '@/components/product/CustomerPageHomeSectionPalette'
import { getHomeSectionEntryLabel } from '@/lib/customerPageHomeLayout'

const CANVAS_DROPPABLE_ID = 'home-sections'
const PALETTE_DROPPABLE_ID = 'home-section-palette'

type CustomerPageHomeCanvasBuilderProps = {
  sections: HomeLayoutSectionView[]
  renderSection: (section: HomeLayoutSectionView['section']) => ReactNode
}

export default function CustomerPageHomeCanvasBuilder({
  sections,
  renderSection,
}: CustomerPageHomeCanvasBuilderProps) {
  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return

    if (source.droppableId === PALETTE_DROPPABLE_ID) {
      if (destination.droppableId !== CANVAS_DROPPABLE_ID) return
      const presetId = draggableId.startsWith('preset:') ? draggableId.slice(7) : draggableId
      const preset = getHomeSectionPresetById(presetId)
      if (!preset) return
      const { kind, config } = applyHomeSectionPreset(preset)
      void applyCustomerPageHomeLayoutUpdate((layout) =>
        insertHomeSectionFromPresetAtIndex(layout, { kind, config }, destination.index)
      )
      return
    }

    if (
      source.droppableId === CANVAS_DROPPABLE_ID &&
      destination.droppableId === CANVAS_DROPPABLE_ID &&
      source.index !== destination.index
    ) {
      void applyCustomerPageHomeLayoutUpdate((layout) =>
        reorderHomeSectionsAtIndex(layout, source.index, destination.index)
      )
    }
  }, [])

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId={CANVAS_DROPPABLE_ID}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="customer-page-home-canvas">
            {sections.map(({ section, orderIndex, visible }, index) => (
              <Draggable key={section.instanceId} draggableId={section.instanceId} index={index}>
                {(dragProvided, snapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    style={dragProvided.draggableProps.style as CSSProperties | undefined}
                    className={snapshot.isDragging ? 'customer-page-home-section--dragging' : ''}
                  >
                    <CustomerPageHomeSectionFrame
                      section={section}
                      sectionLabel={getHomeSectionEntryLabel(section)}
                      orderIndex={orderIndex}
                      totalSections={sections.length}
                      visible={visible}
                      layoutEditMode
                      dragHandleProps={dragProvided.dragHandleProps}
                      isDragging={snapshot.isDragging}
                    >
                      {renderSection(section)}
                    </CustomerPageHomeSectionFrame>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <CustomerPageHomeSectionPalette droppableId={PALETTE_DROPPABLE_ID} />
    </DragDropContext>
  )
}
