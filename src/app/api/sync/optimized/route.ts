import { NextRequest, NextResponse } from 'next/server'
import { optimizedSyncService } from '@/lib/optimizedSyncService'

// 성능 모니터링을 위한 동기화 통계 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'cache-stats':
        const cacheStats = optimizedSyncService.getCacheStats()
        return NextResponse.json({
          success: true,
          data: cacheStats
        })

      case 'clear-cache':
        const pattern = searchParams.get('pattern')
        if (pattern) {
          optimizedSyncService.clearCachePattern(pattern)
          return NextResponse.json({
            success: true,
            message: `캐시 패턴 삭제 완료: ${pattern}`
          })
        } else {
          optimizedSyncService.clearCache()
          return NextResponse.json({
            success: true,
            message: '전체 캐시 삭제 완료'
          })
        }

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('성능 모니터링 API 오류:', error)
    return NextResponse.json(
      { success: false, message: `성능 모니터링 API 오류: ${error}` },
      { status: 500 }
    )
  }
}

// 최적화된 동기화 실행
export async function POST(request: NextRequest) {
  try {
    console.log('📥 최적화된 동기화 API 요청 수신')
    
    const body = await request.json()
    console.log('📋 요청 본문:', JSON.stringify(body, null, 2))
    
    const { 
      spreadsheetId, 
      sheetName, 
      targetTable, 
      columnMapping,
      enablePerformanceMonitoring = true
    } = body

    if (!spreadsheetId || !sheetName || !targetTable) {
      console.log('❌ 필수 파라미터 누락:', { spreadsheetId: !!spreadsheetId, sheetName: !!sheetName, targetTable: !!targetTable })
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID, sheet name, and target table are required' },
        { status: 400 }
      )
    }

    console.log(`🚀 최적화된 동기화 시작: ${spreadsheetId}/${sheetName} → ${targetTable}`)
    console.log(`컬럼 매핑:`, columnMapping)
    
    const startTime = Date.now()
    
    // 성능 모니터링을 위한 진행 콜백
    const performanceMetrics = {
      dataReadTime: 0,
      dataTransformTime: 0,
      dataValidationTime: 0,
      databaseWriteTime: 0,
      totalTime: 0
    }
    
    // 최적화된 동기화 실행
    const result = await optimizedSyncService.optimizedSync(
      spreadsheetId, 
      sheetName, 
      targetTable, 
      columnMapping,
      (event) => {
        console.log(`📊 동기화 진행: ${event.type} - ${event.message || ''}`)
        if (event.processed && event.total) {
          console.log(`📈 진행률: ${event.processed}/${event.total} (${Math.round((event.processed / event.total) * 100)}%)`)
        }
        
        // 성능 메트릭 업데이트
        if (event.type === 'info') {
          if (event.message?.includes('구글 시트에서 데이터 읽는 중')) {
            performanceMetrics.dataReadTime = Date.now() - startTime
          } else if (event.message?.includes('데이터 변환 중')) {
            performanceMetrics.dataTransformTime = Date.now() - startTime
          } else if (event.message?.includes('데이터베이스에 동기화 시작')) {
            performanceMetrics.dataValidationTime = Date.now() - startTime
          }
        }
      }
    )

    performanceMetrics.totalTime = Date.now() - startTime
    performanceMetrics.databaseWriteTime = performanceMetrics.totalTime - performanceMetrics.dataValidationTime

    if (result.success) {
      // 성능 통계 추가
      const enhancedResult = {
        ...result,
        performanceMetrics: enablePerformanceMonitoring ? {
          ...performanceMetrics,
          rowsPerSecond: result.count > 0 ? Math.round((result.count / performanceMetrics.totalTime) * 1000) : 0,
          cacheStats: optimizedSyncService.getCacheStats()
        } : undefined
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        data: (result as { details?: unknown }).details || {},
        count: result.count,
        performanceMetrics: enhancedResult.performanceMetrics
      })
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('최적화된 동기화 오류:', error)
    
    // 환경 변수 관련 오류인 경우 더 명확한 메시지 제공
    let errorMessage = `최적화된 동기화 실패: ${error}`
    if (error instanceof Error) {
      if (error.message.includes('Google Sheets API 환경 변수가 설정되지 않았습니다')) {
        errorMessage = `Google Sheets API 설정 오류: ${error.message}`
      } else if (error.message.includes('timeout')) {
        errorMessage = `Google Sheets API 타임아웃: 시트가 너무 크거나 네트워크 연결이 불안정합니다.`
      } else if (error.message.includes('403')) {
        errorMessage = `Google Sheets 접근 권한 오류: 스프레드시트 공유 설정을 확인해주세요.`
      } else if (error.message.includes('404')) {
        errorMessage = `Google Sheets를 찾을 수 없습니다: 스프레드시트 ID를 확인해주세요.`
      } else {
        errorMessage = `최적화된 동기화 실패: ${error.message}`
      }
    }
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    )
  }
}