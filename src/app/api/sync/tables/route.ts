import { NextRequest, NextResponse } from 'next/server'
import { suggestColumnMapping } from '@/lib/flexibleSyncService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sheetColumns = searchParams.get('sheetColumns')
    const tableName = searchParams.get('tableName')
    
    if (sheetColumns && tableName) {
      // 시트 컬럼과 테이블명이 제공된 경우 매핑 제안
      const columns = JSON.parse(sheetColumns)
      
      // 테이블 스키마 가져오기
      const schemaResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sync/schema?table=${tableName}`)
      const schemaResult = await schemaResponse.json()
      
      if (schemaResult.success) {
        const dbColumns = schemaResult.data.columns
        const suggestions = suggestColumnMapping(columns, tableName, dbColumns)
        
        return NextResponse.json({
          success: true,
          data: {
            suggestions: { [tableName]: suggestions }
          }
        })
      } else {
        return NextResponse.json({
          success: false,
          message: 'Failed to get table schema'
        }, { status: 500 })
      }
    } else {
      // 사용 가능한 테이블 목록은 /api/sync/all-tables에서 처리
      return NextResponse.json({
        success: true,
        data: { tables: [] }
      })
    }

  } catch (error) {
    console.error('Get tables error:', error)
    return NextResponse.json(
      { success: false, message: `Failed to get tables: ${error}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tableName } = body

    if (!tableName) {
      return NextResponse.json(
        { success: false, message: 'Table name is required' },
        { status: 400 }
      )
    }

    // 특정 테이블의 컬럼 매핑 정보 반환
    const columnMapping = getTableColumnMapping(tableName)
    
    return NextResponse.json({
      success: true,
      data: {
        tableName,
        columnMapping
      }
    })

  } catch (error) {
    console.error('Get table columns error:', error)
    return NextResponse.json(
      { success: false, message: `Failed to get table columns: ${error}` },
      { status: 500 }
    )
  }
}
