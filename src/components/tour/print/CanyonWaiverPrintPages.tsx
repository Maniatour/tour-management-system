import {
  LOWER_ANTELOPE_ROWS_PER_PAGE,
  chunkPrintGuests,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'
import LowerAntelopeReservationsForm from '@/components/tour/print/LowerAntelopeReservationsForm'
import ManiaTourWaiverPrintPages from '@/components/tour/print/ManiaTourWaiverPrintPages'
import AntelopeXDuplexSheets from '@/components/tour/print/AntelopeXDuplexSheets'

export default function CanyonWaiverPrintPages({
  mania = null,
  lower,
  canyonX,
  includeManiaWaiver = false,
  includeManiaSignatures = false,
  includeLower,
  includeX,
  isFirstPrintedBlock,
}: {
  mania?: CanyonWaiverPrintPacket | null
  lower: CanyonWaiverPrintPacket | null
  canyonX: CanyonWaiverPrintPacket | null
  includeManiaWaiver?: boolean
  includeManiaSignatures?: boolean
  includeLower: boolean
  includeX: boolean
  isFirstPrintedBlock: boolean
}) {
  const maniaOn = (includeManiaWaiver || includeManiaSignatures) && Boolean(mania)
  const lowerChunks = includeLower && lower ? chunkPrintGuests(lower.guests, LOWER_ANTELOPE_ROWS_PER_PAGE) : []
  const xOn = includeX && Boolean(canyonX)
  const lowerIsFirst = isFirstPrintedBlock && !maniaOn
  const xIsFirst = isFirstPrintedBlock && !maniaOn && lowerChunks.length === 0

  return (
    <>
      <ManiaTourWaiverPrintPages
        packet={mania}
        includeWaiver={includeManiaWaiver}
        includeSignatures={includeManiaSignatures}
        isFirstPrintedBlock={isFirstPrintedBlock}
      />
      {lower &&
        lowerChunks.map((guests, pageIndex) => (
          <div
            key={`lower-${pageIndex}`}
            className={!(lowerIsFirst && pageIndex === 0) ? 'cwf-page-break' : undefined}
          >
            <LowerAntelopeReservationsForm
              packet={lower}
              guests={guests}
              pageIndex={pageIndex}
              pageCount={lowerChunks.length}
            />
          </div>
        ))}
      {xOn && canyonX ? (
        <AntelopeXDuplexSheets packet={canyonX} isFirstPrintedBlock={xIsFirst} />
      ) : null}
    </>
  )
}
