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
      truncateTable = false
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
            
            // 테이블 삭제 옵션이 활성화된 경우
            if (truncateTable) {
              write({ type: 'info', message: `${targetTable} 테이블 초기화 시작` })
              
              try {
                // 먼저 테이블의 레코드 수 확인
                const { count, error: countError } = await client
                  .from(targetTable)
                  .select('*', { count: 'exact', head: true })
                
                if (countError) {
                  write({ type: 'warn', message: `${targetTable} 테이블 레코드 수 확인 실패: ${countError.message}` })
                } else {
                  write({ type: 'info', message: `${targetTable} 테이블에 ${count || 0}개 레코드가 있습니다.` })
                }
                
                // Supabase 클라이언트를 사용하여 테이블 삭제
                const { error: deleteError } = await client
                  .from(targetTable)
                  .delete()
                  .neq('id', '') // 모든 레코드 삭제 (id가 빈 문자열이 아닌 모든 레코드)
                
                if (deleteError) {
                  write({ type: 'warn', message: `${targetTable} 테이블 초기화 실패: ${deleteError.message}` })
                } else {
                  write({ type: 'info', message: `${targetTable} 테이블 초기화 완료` })
                }
              } catch (error) {
                write({ type: 'warn', message: `${targetTable} 테이블 초기화 중 오류: ${error instanceof Error ? error.message : 'Unknown error'}` })
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


