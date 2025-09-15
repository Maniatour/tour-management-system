import { NextRequest } from 'next/server'
import { flexibleSync } from '@/lib/flexibleSyncService'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      spreadsheetId,
      sheetName,
      targetTable,
      columnMapping,
      enableIncrementalSync = false,
      truncateReservations = false
    } = body

    if (!spreadsheetId || !sheetName || !targetTable) {
      return new Response(
        JSON.stringify({ success: false, message: 'Spreadsheet ID, sheet name, and target table are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        const write = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

        ;(async () => {
          try {
            write({ type: 'info', message: 'sync-started' })
            if (truncateReservations && targetTable === 'reservations') {
              write({ type: 'info', message: 'truncate-reservations-start' })
              // 안전하게 reservations 테이블 비우기
              const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/reservations?select=id`, {
                method: 'DELETE',
                headers: {
                  'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
                }
              })
              if (!res.ok) {
                write({ type: 'warn', message: 'failed-to-truncate-reservations' })
              } else {
                write({ type: 'info', message: 'truncate-reservations-done' })
              }
            }
            const summary = await flexibleSync(
              spreadsheetId,
              sheetName,
              targetTable,
              columnMapping,
              enableIncrementalSync,
              (event) => write(event)
            )
            write({ type: 'result', ...summary })
          } catch (error) {
            write({ type: 'error', message: String(error) })
          } finally {
            controller.close()
          }
        })()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: `Flexible sync stream failed: ${error}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}


