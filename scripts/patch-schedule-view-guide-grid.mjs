import fs from 'fs'

const path = 'src/components/ScheduleView.tsx'
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/)
const start = 7079
const end = 7957

const componentCall = `          <ScheduleGuideGrid
            locale={locale}
            monthDays={monthDays}
            dayColumnWidthCalc={dayColumnWidthCalc}
            dynamicMinTableWidthPx={dynamicMinTableWidthPx}
            isToday={isToday}
            guideTotals={guideTotals}
            guideVsProductDailyTotalMismatch={guideVsProductDailyTotalMismatch}
            guideScheduleData={guideScheduleData}
            selectedTeamMembers={selectedTeamMembers}
            cdlDriverEmailSet={cdlDriverEmailSet}
            cdlKoreanDriverEmailSet={cdlKoreanDriverEmailSet}
            scheduleGridLastDay={scheduleGridLastDay}
            firstDayOfMonth={firstDayOfMonth}
            currentDate={currentDate}
            tours={tours}
            reservations={reservations}
            teamMembers={teamMembers}
            productColors={productColors}
            defaultPresetIds={defaultPresetIds}
            products={products}
            airportPickupMemberIdSet={airportPickupMemberIdSet}
            airportSendingMemberIdSet={airportSendingMemberIdSet}
            getMultiDayTourDays={getMultiDayTourDays}
            scheduleInteractionDragging={scheduleInteractionDragging}
            hoveredGuideRow={hoveredGuideRow}
            setHoveredGuideRow={setHoveredGuideRow}
            moveTeamMember={moveTeamMember}
            canEditTeamFromSchedule={canEditTeamFromSchedule}
            openTeamEditFromSchedule={openTeamEditFromSchedule}
            isOffDate={isOffDate}
            dateNotes={dateNotes}
            highlightedDate={highlightedDate}
            pendingOffScheduleChanges={pendingOffScheduleChanges}
            draggedTour={draggedTour}
            draggedUnassignedTour={draggedUnassignedTour}
            monthVehiclesWithColors={monthVehiclesWithColors}
            handleGuideScheduleDropZoneDragOver={(e) =>
              handleGuideScheduleDropZoneDragOver(e as React.DragEvent<HTMLElement>)
            }
            handleGuideScheduleDropZoneDragLeave={(e) =>
              handleGuideScheduleDropZoneDragLeave(e as React.DragEvent<HTMLElement>)
            }
            handleGuideCellDrop={(e, teamMemberId, dateString, role) =>
              void handleGuideCellDrop(
                e as React.DragEvent,
                teamMemberId,
                dateString,
                role,
              )
            }
            handleDragStart={(e, tour) => handleDragStart(e as React.DragEvent, tour)}
            handleAssignedTourDragEnd={handleAssignedTourDragEnd}
            openTourDetailModal={openTourDetailModal}
            showGuideModalContent={showGuideModalContent}
            getTourSummary={getTourSummary}
            getGuideScheduleTourHoverText={getGuideScheduleTourHoverText}
          />`

const newLines = [...lines.slice(0, start), componentCall, ...lines.slice(end + 1)]
fs.writeFileSync(path, newLines.join('\n'), 'utf8')
console.log('ScheduleView.tsx patched')
