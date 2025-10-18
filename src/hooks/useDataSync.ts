import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import { 
  SheetInfo, 
  SyncResult, 
  TableInfo, 
  ColumnInfo, 
  ColumnMapping, 
  CleanupStatus,
  RealTimeStats 
} from '@/types/data-sync'
import { getAutoMapping, getFallbackColumns } from '@/utils/columnMapping'
import { saveColumnMapping, loadColumnMapping } from '@/utils/localStorage'

export function useDataSync() {
  const [spreadsheetId] = useState('15pu3wMPDwOHlVM0LhRsOYW5WZDZ3SUPVU4h0G4hyLc0')
  const [selectedSheet, setSelectedSheet] = useState('')
  const [selectedTable, setSelectedTable] = useState('')
  const [sheetInfo, setSheetInfo] = useState<SheetInfo[]>([])
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [tableColumns, setTableColumns] = useState<ColumnInfo[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [loading, setLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [truncateTable, setTruncateTable] = useState(false)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [progress, setProgress] = useState(0)
  const [etaMs, setEtaMs] = useState<number | null>(null)
  const progressTimerRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [syncLogs, setSyncLogs] = useState<string[]>([])
  const [realTimeStats, setRealTimeStats] = useState<RealTimeStats>({ 
    processed: 0, 
    inserted: 0, 
    updated: 0, 
    errors: 0 
  })
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<SyncResult | null>(null)
  const [cleanupStatus, setCleanupStatus] = useState<CleanupStatus | null>(null)

  // 사용 가능한 테이블 가져오기
  const getAvailableTables = useCallback(async () => {
    try {
      if (availableTables.length > 0) {
        return
      }

      const response = await fetch('/api/sync/all-tables')
      const result = await response.json()
      
      if (result.success) {
        setAvailableTables(result.data.tables)
        console.log('Available tables:', result.data.tables)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('테이블 목록 요청이 취소되었습니다.')
        return
      }
      
      console.error('Error getting available tables:', error)
    }
  }, [availableTables.length])

  // 테이블 스키마 가져오기
  const getTableSchema = async (tableName: string) => {
    const attempt = async (timeoutMs: number) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`/api/sync/schema?table=${tableName}`, { signal: controller.signal })
        clearTimeout(timeoutId)
        return await response.json()
      } catch (err) {
        clearTimeout(timeoutId)
        throw err
      }
    }

    try {
      console.log('Fetching table schema for:', tableName)
      setTableColumns([])

      // 1차 시도: 15초
      let result = await attempt(15000)
      
      // 실패 혹은 success=false이면 2차 재시도(25초)
      if (!result?.success) {
        console.warn('Schema first attempt failed, retrying with longer timeout...')
        await new Promise(r => setTimeout(r, 500))
        result = await attempt(25000)
      }

      if (result?.success) {
        console.log('Setting table columns:', result.data.columns)
        console.log('Data source:', result.data.source)
        setTableColumns(result.data.columns)

        // 자동 매핑 적용 (저장된 매핑이 없는 경우)
        const savedMapping = loadColumnMapping(tableName)
        if (Object.keys(savedMapping).length === 0) {
          const sheet = sheetInfo.find(s => s.name === selectedSheet)
          if (sheet && sheet.columns.length > 0) {
            const autoMapping = getAutoMapping(result.data.columns, sheet.columns)
            if (Object.keys(autoMapping).length > 0) {
              console.log('Applying auto-mapping:', autoMapping)
              setColumnMapping(autoMapping)
            }
          }
        }
      } else {
        // 폴백: 하드코딩된 컬럼 목록 사용
        const fallbackColumns = getFallbackColumns(tableName)
        console.warn('Using fallback columns (schema fetch returned unsuccessful):', fallbackColumns)
        setTableColumns(fallbackColumns)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('스키마 요청이 취소되었습니다.')
        return
      }
      
      // 폴백: 하드코딩된 컬럼 목록 사용
      const fallbackColumns = getFallbackColumns(tableName)
      console.warn('Using fallback columns due to error:', error)
      setTableColumns(fallbackColumns)
    }
  }

  // 구글 시트 정보 가져오기
  const getSheetInfo = async () => {
    if (!spreadsheetId.trim()) {
      alert('스프레드시트 ID를 입력해주세요.')
      return
    }

    console.log('🚀 Loading sheet information...')
    setLoading(true)
    setSheetInfo([])
    
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      const timeoutId = setTimeout(() => {
        console.log('Request timeout - aborting fetch')
        controller.abort()
      }, 60000)

      console.log('Sending request to /api/sync/sheets')
      const response = await fetch('/api/sync/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spreadsheetId }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      abortControllerRef.current = null

      console.log('Response received:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error Response:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      console.log('API Response:', result)
      
      if (result.success) {
        setSheetInfo(result.data.sheets)
        
        if (result.data.sheets.length > 0) {
          setSelectedSheet(result.data.sheets[0].name)
        } else {
          alert('시트를 찾을 수 없습니다. 스프레드시트에 "S"로 시작하는 시트가 있는지 확인해주세요.')
        }
      } else {
        alert(`시트 정보를 가져오는데 실패했습니다: ${result.message}`)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('요청이 취소되었습니다 (타임아웃 또는 사용자 취소)')
        alert('요청 시간이 초과되었습니다 (60초). 네트워크 연결을 확인하고 다시 시도해주세요. 구글 시트가 너무 크거나 복잡할 수 있습니다.')
        return
      }
      
      console.error('❌ Error:', error)
      
      let message = '시트 정보를 가져올 수 없습니다.'
      if (error instanceof Error) {
        if (error.message.includes('Quota exceeded')) {
          message = 'API 할당량을 초과했습니다. 1-2분 후에 다시 시도해주세요.'
        } else if (error.message.includes('403')) {
          message = '시트 접근 권한이 없습니다. 스프레드시트 공유 설정을 확인해주세요.'
        } else if (error.message.includes('404')) {
          message = '시트를 찾을 수 없습니다. 스프레드시트 ID를 확인해주세요.'
        } else if (error.message.includes('Failed to fetch')) {
          message = '네트워크 연결을 확인해주세요. 인터넷 연결이 불안정할 수 있습니다.'
        } else {
          message = `오류: ${error.message}`
        }
      }
      
      alert(`❌ ${message}`)
      setSheetInfo([])
    } finally {
      setLoading(false)
    }
  }

  // 시트 컬럼 정보 로드
  const loadSheetColumns = async (sheetName: string) => {
    try {
      console.log(`📊 Loading columns for ${sheetName}...`)
      
      const response = await fetch('/api/sync/sheet-columns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          spreadsheetId, 
          sheetName 
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setSheetInfo(prev => prev.map(sheet => 
          sheet.name === sheetName 
            ? { 
                ...sheet, 
                columns: result.data.columns,
                sampleData: result.data.sampleData
              }
            : sheet
        ))
        
        console.log(`✅ Loaded ${result.data.columns.length} columns for ${sheetName}`)
      } else {
        console.error(`❌ Failed to load columns for ${sheetName}:`, result.message)
      }
    } catch (error) {
      console.error(`❌ Error loading columns for ${sheetName}:`, error)
    }
  }

  // 시트 선택
  const handleSheetSelect = async (sheetName: string) => {
    console.log(`📋 Selected sheet: ${sheetName}`)
    setSelectedSheet(sheetName)
    const sheet = sheetInfo.find(s => s.name === sheetName)
    
    if (sheet && sheet.columns.length === 0) {
      console.log(`📊 Loading column information for ${sheetName}...`)
      await loadSheetColumns(sheetName)
    }
  }

  // 테이블 선택
  const handleTableSelect = (tableName: string) => {
    console.log('Table selected:', tableName)
    setSelectedTable(tableName)
    setTableColumns([])
    setTruncateTable(false)
    
    if (tableName) {
      getTableSchema(tableName)
      fetchLastSyncTime(tableName)
      
      const savedMapping = loadColumnMapping(tableName)
      if (Object.keys(savedMapping).length > 0) {
        console.log('Loaded saved column mapping:', savedMapping)
        setColumnMapping(savedMapping)
      }
    }
  }

  // 마지막 동기화 시간 조회
  const fetchLastSyncTime = async (tableName: string) => {
    if (!spreadsheetId) return
    
    try {
      const response = await fetch(`/api/sync/history?table=${tableName}&spreadsheetId=${spreadsheetId}`)
      const result = await response.json()
      
      if (result.success && result.data.lastSyncTime) {
        setLastSyncTime(result.data.lastSyncTime)
      } else {
        setLastSyncTime(null)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('마지막 동기화 시간 요청이 취소되었습니다.')
        return
      }
      
      console.error('Error fetching last sync time:', error)
      setLastSyncTime(null)
    }
  }

  // 요청 취소
  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      console.log('사용자가 요청을 취소했습니다.')
    }
  }

  // 구글 시트 URL 생성
  const getGoogleSheetsUrl = () => {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  }

  // 구글 시트 열기
  const openGoogleSheets = () => {
    window.open(getGoogleSheetsUrl(), '_blank')
  }

  // 예약 데이터 정리 상태 확인
  const checkCleanupStatus = async () => {
    try {
      const response = await fetch('/api/sync/reservation-cleanup')
      const result = await response.json()
      
      if (result.success) {
        setCleanupStatus(result.data)
      } else {
        console.error('Failed to check cleanup status:', result.message)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('정리 상태 확인 요청이 취소되었습니다.')
        return
      }
      
      console.error('Error checking cleanup status:', error)
    }
  }

  // 최적화된 동기화 함수 추가
  const handleOptimizedSync = async () => {
    const supabase = createClientSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    
    if (!accessToken) {
      alert('로그인 정보가 확인되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.')
      return
    }
    
    if (!spreadsheetId.trim() || !selectedSheet || !selectedTable) {
      alert('스프레드시트 ID, 시트, 테이블을 모두 선택해주세요.')
      return
    }

    if (Object.keys(columnMapping).length === 0) {
      alert('컬럼 매핑을 설정해주세요.')
      return
    }

    setLoading(true)
    setSyncResult(null)
    setProgress(1)
    setSyncLogs([])
    setRealTimeStats({ processed: 0, inserted: 0, updated: 0, errors: 0 })
    
    const startTs = Date.now()
    setEtaMs(null) // 최적화된 동기화는 정확한 예측이 어려움

    try {
      const response = await fetch('/api/sync/optimized', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          spreadsheetId,
          sheetName: selectedSheet,
          targetTable: selectedTable,
          columnMapping
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setSyncResult({
          success: true,
          message: result.message,
          data: result.data,
          count: result.count
        })
        setLastSyncTime(new Date().toISOString())
        
        const durationMs = Date.now() - startTs
        const rowsProcessed = result.count || 0
        const msPerRow = rowsProcessed > 0 ? Math.round(durationMs / rowsProcessed) : 0
        
        setSyncLogs(prev => [...prev, `✅ 최적화된 동기화 완료: ${rowsProcessed}개 행 처리 (${msPerRow}ms/행)`])
        
        // 성능 개선 로그
        if (msPerRow < 10) {
          setSyncLogs(prev => [...prev, `🚀 우수한 성능: ${msPerRow}ms/행 (목표: <10ms/행)`])
        } else if (msPerRow < 50) {
          setSyncLogs(prev => [...prev, `⚡ 양호한 성능: ${msPerRow}ms/행 (목표: <50ms/행)`])
        } else {
          setSyncLogs(prev => [...prev, `⚠️ 성능 개선 필요: ${msPerRow}ms/행`])
        }
      } else {
        setSyncResult({ success: false, message: result.message })
        setSyncLogs(prev => [...prev, `❌ 동기화 실패: ${result.message}`])
      }
    } catch (error) {
      console.error('최적화된 동기화 오류:', error)
      setSyncResult({
        success: false,
        message: '최적화된 동기화 중 오류가 발생했습니다.'
      })
      setSyncLogs(prev => [...prev, `❌ 오류: ${error}`])
    } finally {
      setProgress(100)
      setEtaMs(0)
      setLoading(false)
    }
  }
    const supabase = createClientSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      alert('로그인 정보가 확인되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.')
      setLoading(false)
      return
    }
    if (!spreadsheetId.trim() || !selectedSheet || !selectedTable) {
      alert('스프레드시트 ID, 시트, 테이블을 모두 선택해주세요.')
      return
    }

    if (Object.keys(columnMapping).length === 0) {
      alert('컬럼 매핑을 설정해주세요.')
      return
    }

    setLoading(true)
    setSyncResult(null)
    setProgress(1)
    setSyncLogs([])
    setRealTimeStats({ processed: 0, inserted: 0, updated: 0, errors: 0 })
    
    const defaultMsPerRow = Number(localStorage.getItem('flex-sync-ms-per-row')) || 10
    const sheet = sheetInfo.find(s => s.name === selectedSheet)
    const estimatedRows = Math.max(sheet?.rowCount || 200, 1)
    const estimatedDurationMs = Math.max(estimatedRows * defaultMsPerRow, 1500)
    const startTs = Date.now()
    setEtaMs(estimatedDurationMs)
    
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    progressTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTs
      const pct = Math.min(95, Math.floor((elapsed / estimatedDurationMs) * 95))
      setProgress(pct)
      setEtaMs(Math.max(estimatedDurationMs - elapsed, 0))
    }, 200)

    try {
      const response = await fetch('/api/sync/flexible/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          spreadsheetId,
          sheetName: selectedSheet,
          targetTable: selectedTable,
          columnMapping,
          enableIncrementalSync: false,
          truncateTable,
        }),
      })

      if (!response.body) throw new Error('No response body')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffered = ''
      let finalResult: SyncResult | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffered += decoder.decode(value, { stream: true })
        const lines = buffered.split('\n')
        buffered = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const evt = JSON.parse(line)
            
            if (evt.type === 'info') {
              setSyncLogs(prev => [...prev, `[INFO] ${evt.message}`])
            } else if (evt.type === 'warn') {
              setSyncLogs(prev => [...prev, `[WARN] ${evt.message}`])
            } else if (evt.type === 'error') {
              setSyncLogs(prev => [...prev, `[ERROR] ${evt.message}`])
            }
            
            if (evt.type === 'start' && evt.total) {
              const msPerRow = Number(localStorage.getItem('flex-sync-ms-per-row')) || 10
              const newEstimated = Math.max(evt.total * msPerRow, 1500)
              setEtaMs(newEstimated)
              setSyncLogs(prev => [...prev, `[START] 동기화 시작 - 총 ${evt.total}개 행 처리 예정`])
            }
            if (evt.type === 'progress' && evt.total) {
              const pctRaw = Math.floor((evt.processed / evt.total) * 100)
              setProgress(prev => Math.min(99, Math.max(prev, pctRaw)))
              const elapsed = Date.now() - startTs
              const perRow = (evt.processed > 0) ? Math.round(elapsed / evt.processed) : (Number(localStorage.getItem('flex-sync-ms-per-row')) || 10)
              const remain = Math.max((evt.total - evt.processed) * perRow, 0)
              setEtaMs(remain)
              
              setRealTimeStats({
                processed: evt.processed || 0,
                inserted: evt.inserted || 0,
                updated: evt.updated || 0,
                errors: evt.errors || 0
              })
              
              if (evt.processed > 0 && evt.processed % Math.max(1, Math.floor(evt.total / 10)) === 0) {
                setSyncLogs(prev => [...prev, `[PROGRESS] ${evt.processed}/${evt.total} 처리 완료 (${pctRaw}%) - 삽입: ${evt.inserted || 0}, 업데이트: ${evt.updated || 0}, 오류: ${evt.errors || 0}`])
              }
            }
            if (evt.type === 'result') {
              finalResult = {
                success: !!evt.success,
                message: String(evt.message || ''),
                data: evt.details,
                syncTime: new Date().toISOString()
              }
              setSyncLogs(prev => [...prev, `[RESULT] 동기화 완료 - ${finalResult?.message || '알 수 없는 결과'}`])
            }
          } catch {
            // 무시 (부분 라인)
          }
        }
      }

      if (finalResult) {
        setSyncResult(finalResult)
        if (finalResult.success) {
          setLastSyncTime(new Date().toISOString())
          const durationMs = Date.now() - startTs
          const inserted = finalResult.data?.inserted ?? 0
          const updated = finalResult.data?.updated ?? 0
          const processedSum = inserted + updated
          const rowsProcessed = Math.max(processedSum > 0 ? processedSum : estimatedRows, 1)
          const msPerRow = Math.min(Math.max(Math.round(durationMs / rowsProcessed), 3), 200)
          localStorage.setItem('flex-sync-ms-per-row', String(msPerRow))
        }
      } else {
        setSyncResult({ success: false, message: '동기화 결과를 수신하지 못했습니다.' })
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('동기화 요청이 취소되었습니다 (타임아웃 또는 사용자 취소)')
        setSyncResult({
          success: false,
          message: '동기화가 취소되었습니다. 네트워크 연결을 확인하고 다시 시도해주세요.'
        })
        return
      }
      
      console.error('Error syncing data:', error)
      setSyncResult({
        success: false,
        message: '데이터 동기화 중 오류가 발생했습니다.'
      })
    } finally {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      setProgress(100)
      setEtaMs(0)
      setLoading(false)
    }
  }

  // 컴포넌트 마운트 시 사용 가능한 테이블만 가져오기
  useEffect(() => {
    getAvailableTables()
  }, [getAvailableTables])

  // 컴포넌트 언마운트 시 진행 중인 요청 취소
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  // 예약 데이터 정리 상태 확인
  useEffect(() => {
    checkCleanupStatus()
  }, [])

  return {
    // 상태
    spreadsheetId,
    selectedSheet,
    selectedTable,
    sheetInfo,
    availableTables,
    tableColumns,
    columnMapping,
    loading,
    syncResult,
    lastSyncTime,
    truncateTable,
    showMappingModal,
    progress,
    etaMs,
    syncLogs,
    realTimeStats,
    cleanupLoading,
    cleanupResult,
    cleanupStatus,
    
    // 액션
    setColumnMapping,
    setTruncateTable,
    setShowMappingModal,
    setSyncResult,
    setCleanupResult,
    getSheetInfo,
    cancelRequest,
    openGoogleSheets,
    handleSheetSelect,
    handleTableSelect,
    handleFlexibleSync,
    handleOptimizedSync, // 새로운 최적화된 동기화 함수 추가
    checkCleanupStatus,
    saveColumnMapping: (tableName: string, mapping: ColumnMapping) => {
      saveColumnMapping(tableName, mapping)
      setColumnMapping(mapping)
    }
  }
}
