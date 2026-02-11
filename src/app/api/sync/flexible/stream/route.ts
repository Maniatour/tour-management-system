import { NextRequest } from 'next/server'
import { flexibleSync } from '@/lib/flexibleSyncService'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// 청크 단위 삭제 함수 (대용량 테이블 지원)
const deleteTableInChunks = async (
  client: SupabaseClient,
  tableName: string,
  chunkSize: number = 500,
  write: (obj: unknown) => void
): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
  let totalDeleted = 0
  let hasMore = true
  let attempts = 0
  const maxAttempts = 100 // 최대 100번 반복 (50,000개 레코드)
  
  // team 테이블은 PK가 email
  const pkColumn = tableName === 'team' ? 'email' : 'id'
  
  while (hasMore && attempts < maxAttempts) {
    attempts++
    
    try {
      // 삭제할 레코드의 ID 목록 조회
      const { data: records, error: selectError } = await client
        .from(tableName)
        .select(pkColumn)
        .limit(chunkSize)
      
      if (selectError) {
        return { success: false, deletedCount: totalDeleted, error: selectError.message }
      }
      
      if (!records || records.length === 0) {
        hasMore = false
        break
      }
      
      // ID 목록으로 삭제
      const ids = records.map((r: Record<string, unknown>) => r[pkColumn])
      const { error: deleteError } = await client
        .from(tableName)
        .delete()
        .in(pkColumn, ids)
      
      if (deleteError) {
        // 타임아웃 에러인 경우 청크 크기를 줄여서 재시도
        if (deleteError.message.includes('timeout') || deleteError.message.includes('statement')) {
          write({ type: 'warn', message: `청크 크기 ${chunkSize}에서 타임아웃 발생, 더 작은 청크로 재시도...` })
          // 청크 크기를 절반으로 줄이고 계속
          return deleteTableInChunks(client, tableName, Math.max(100, Math.floor(chunkSize / 2)), write)
        }
        return { success: false, deletedCount: totalDeleted, error: deleteError.message }
      }
      
      totalDeleted += records.length
      
      // 진행 상황 보고 (매 1000개마다)
      if (totalDeleted % 1000 === 0 || records.length < chunkSize) {
        write({ type: 'info', message: `${tableName}: ${totalDeleted}개 레코드 삭제됨...` })
      }
      
      // 모든 레코드를 삭제했는지 확인
      if (records.length < chunkSize) {
        hasMore = false
      }
      
      // DB 부하 분산을 위한 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 50))
      
    } catch (error) {
      return { 
        success: false, 
        deletedCount: totalDeleted, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
  
  return { success: true, deletedCount: totalDeleted }
}

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

    // Authorization 헤더에서 JWT 추출 (동기화 실행 권한 확인용)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

    // 장시간 배치 시 JWT 만료를 피하기 위해 서버에서는 service role 클라이언트 사용.
    // (토큰이 있으면 로그인 사용자로 간주하고, 실제 DB 작업은 만료 없는 service role로 수행)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    const client: SupabaseClient =
      supabaseAdmin ??
      createClient(supabaseUrl, anonKey, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined)

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        const write = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

        ;(async () => {
          try {
            write({ type: 'info', message: '동기화 시작' })
            
            // 테이블 삭제 옵션이 활성화된 경우 (청크 단위 삭제)
            if (truncateTable) {
              write({ type: 'info', message: `${targetTable} 테이블 초기화 시작 (청크 단위 삭제)` })
              
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
                
                // 청크 단위로 삭제 (타임아웃 방지)
                const deleteResult = await deleteTableInChunks(client, targetTable, 500, write)
                
                if (deleteResult.success) {
                  write({ type: 'info', message: `${targetTable} 테이블 초기화 완료: ${deleteResult.deletedCount}개 레코드 삭제됨` })
                } else {
                  write({ type: 'warn', message: `${targetTable} 테이블 초기화 부분 완료: ${deleteResult.deletedCount}개 삭제됨, 오류: ${deleteResult.error}` })
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


