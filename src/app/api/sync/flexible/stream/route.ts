import { NextRequest } from 'next/server'
import { flexibleSync } from '@/lib/flexibleSyncService'
import { createClient } from '@supabase/supabase-js'

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

    // Authorization 헤더에서 JWT 추출
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

    // JWT 기반 Supabase 클라이언트 생성 (없으면 익명키로 생성)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    const client = createClient(supabaseUrl, anonKey, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined)

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        const write = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

        ;(async () => {
          try {
            write({ type: 'info', message: '동기화 시작' })
            if (truncateReservations && (targetTable === 'reservations' || targetTable === 'channels')) {
              const tableToTruncate = targetTable
              write({ type: 'info', message: `${tableToTruncate} 테이블 초기화 시작` })
              // 안전하게 대상 테이블 비우기
              const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${tableToTruncate}?select=id`, {
                method: 'DELETE',
                headers: {
                  'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
                }
              })
              if (!res.ok) {
                write({ type: 'warn', message: `${tableToTruncate} 테이블 초기화 실패` })
              } else {
                write({ type: 'info', message: `${tableToTruncate} 테이블 초기화 완료` })
              }
            }
            const summary = await flexibleSync(
              spreadsheetId,
              sheetName,
              targetTable,
              columnMapping,
              enableIncrementalSync,
              (event) => write(event),
              client,
              token
            )
            write({ type: 'result', ...summary })
            write({ type: 'info', message: '동기화 완료' })
          } catch (error) {
            write({ type: 'error', message: `동기화 오류: ${String(error)}` })
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


