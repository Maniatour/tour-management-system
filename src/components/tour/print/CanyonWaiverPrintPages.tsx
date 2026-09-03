import {
  ANTELOPE_X_ROWS_PER_PAGE,
  LOWER_ANTELOPE_ROWS_PER_PAGE,
  chunkPrintGuests,
  type CanyonWaiverPrintPacket,
} from '@/lib/canyonWaiverPrintForms'
import LowerAntelopeReservationsForm from '@/components/tour/print/LowerAntelopeReservationsForm'
import AntelopeXCompanyInfoForm from '@/components/tour/print/AntelopeXCompanyInfoForm'

export default function CanyonWaiverPrintPages({
  lower,
  canyonX,
  includeLower,
  includeX,
  isFirstPrintedBlock,
}: {
  lower: CanyonWaiverPrintPacket | null
  canyonX: CanyonWaiverPrintPacket | null
  includeLower: boolean
  includeX: boolean
  isFirstPrintedBlock: boolean
}) {
  const lowerChunks = includeLower && lower ? chunkPrintGuests(lower.guests, LOWER_ANTELOPE_ROWS_PER_PAGE) : []
  const xChunks = includeX && canyonX ? chunkPrintGuests(canyonX.guests, ANTELOPE_X_ROWS_PER_PAGE) : []

  return (
    <>
      {lower &&
        lowerChunks.map((guests, pageIndex) => (
          <div
            key={`lower-${pageIndex}`}
            className={!(isFirstPrintedBlock && pageIndex === 0) ? 'cwf-page-break' : undefined}
          >
            <LowerAntelopeReservationsForm
              packet={lower}
              guests={guests}
              pageIndex={pageIndex}
              pageCount={lowerChunks.length}
            />
          </div>
        ))}
      {canyonX &&
        xChunks.map((guests, pageIndex) => (
          <div
            key={`x-${pageIndex}`}
            className={
              !(isFirstPrintedBlock && lowerChunks.length === 0 && pageIndex === 0)
                ? 'cwf-page-break'
                : undefined
            }
          >
            <AntelopeXCompanyInfoForm
              packet={canyonX}
              guests={guests}
              pageIndex={pageIndex}
              pageCount={xChunks.length}
            />
          </div>
        ))}
    </>
  )
}
