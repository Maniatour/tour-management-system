'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, RefreshCw, FileSpreadsheet, CheckCircle, XCircle, Clock, Settings, ArrowRight, ExternalLink, Database } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import WeatherDataCollector from '@/components/WeatherDataCollector'

interface SheetInfo {
  name: string
  rowCount: number
  sampleData: Record<string, unknown>[]
  columns: string[]
  error?: string
}

interface SyncResult {
  success: boolean
  message: string
  data?: {
    inserted?: number
    updated?: number
    errors?: number
    errorDetails?: string[]
    mdgcSunriseXUpdated?: number
    mdgc1DXUpdated?: number
    mdgcSunriseUpdated?: number
    mdgc1DUpdated?: number
    totalUpdated?: number
  }
  syncTime?: string
}

interface TableInfo {
  name: string
  displayName: string
}

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string | null
}

interface ColumnMapping {
  [sheetColumn: string]: string
}

export default function DataSyncPage() {
  const [spreadsheetId] = useState('15pu3wMPDwOHlVM0LhRsOYW5WZDZ3SUPVU4h0G4hyLc0')
  const [selectedSheet, setSelectedSheet] = useState('')
  const [selectedTable, setSelectedTable] = useState('')
  const [sheetInfo, setSheetInfo] = useState<SheetInfo[]>([])
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [tableColumns, setTableColumns] = useState<ColumnInfo[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  // const [mappingSuggestions] = useState<{ [key: string]: ColumnMapping }>({})
  const [loading, setLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  // 선택된 테이블의 데이터를 동기화 전에 삭제할지 여부
  const [truncateTable, setTruncateTable] = useState(false)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [progress, setProgress] = useState(0)
  const [etaMs, setEtaMs] = useState<number | null>(null)
  const progressTimerRef = useRef<number | null>(null)
  const [syncLogs, setSyncLogs] = useState<string[]>([])
  const [realTimeStats, setRealTimeStats] = useState<{
    processed: number
    inserted: number
    updated: number
    errors: number
  }>({ processed: 0, inserted: 0, updated: 0, errors: 0 })
  const [logFilter, setLogFilter] = useState<string>('all') // 'all', 'info', 'warn', 'error'
  const [showFullLogs, setShowFullLogs] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<SyncResult | null>(null)

  // 컬럼 매핑을 localStorage에 저장
  const saveColumnMapping = (tableName: string, mapping: ColumnMapping) => {
    try {
      const key = `column-mapping-${tableName}`
      localStorage.setItem(key, JSON.stringify(mapping))
      console.log('Column mapping saved to localStorage:', key, mapping)
    } catch (error) {
      console.error('Error saving column mapping to localStorage:', error)
    }
  }

  // 컬럼 매핑을 localStorage에서 불러오기
  const loadColumnMapping = (tableName: string): ColumnMapping => {
    try {
      const key = `column-mapping-${tableName}`
      const saved = localStorage.getItem(key)
      if (saved) {
        const mapping = JSON.parse(saved)
        console.log('Column mapping loaded from localStorage:', key, mapping)
        return mapping
      }
    } catch (error) {
      console.error('Error loading column mapping from localStorage:', error)
    }
    return {}
  }

  // 자동 완성 함수 (데이터베이스 컬럼명과 구글 시트 컬럼명 매칭)
  const getAutoCompleteSuggestions = (dbColumn: string, sheetColumns: string[]): string[] => {
    const suggestions: string[] = []
    const dbLower = dbColumn.toLowerCase()
    
    sheetColumns.forEach(sheetCol => {
      const sheetLower = sheetCol.toLowerCase()
      
      // 정확한 매칭 (대소문자 무시)
      if (dbLower === sheetLower) {
        suggestions.unshift(sheetCol) // 정확한 매칭을 맨 앞에
        return
      }
      
      // 부분 매칭 (포함 관계)
      if (dbLower.includes(sheetLower) || sheetLower.includes(dbLower)) {
        suggestions.push(sheetCol)
        return
      }
      
      // 언더스코어 제거 후 매칭 (예: customer_name -> customername)
      const dbWithoutUnderscore = dbLower.replace(/_/g, '')
      const sheetWithoutUnderscore = sheetLower.replace(/_/g, '')
      if (dbWithoutUnderscore === sheetWithoutUnderscore) {
        suggestions.push(sheetCol)
        return
      }
      
      // 한글 매핑 (일반적인 패턴) - 역방향 매핑
      const koreanMappings: { [key: string]: string[] } = {
        'id': ['예약번호', 'ID', '아이디'],
        'name': ['고객명', '이름', 'Name'],
        'customer_name': ['고객명', '이름', 'Name'],
        'email': ['이메일', 'Email', '메일'],
        'customer_email': ['이메일', 'Email', '메일'],
        'phone': ['전화번호', 'Phone', '연락처'],
        'customer_phone': ['전화번호', 'Phone', '연락처'],
        'adults': ['성인수', '성인', 'Adults'],
        'child': ['아동수', '아동', 'Child'],
        'infant': ['유아수', '유아', 'Infant'],
        'total_people': ['총인원', '인원', 'Total'],
        'tour_date': ['투어날짜', '날짜', 'Date'],
        'tour_time': ['투어시간', '시간', 'Time'],
        'product_id': ['상품ID', '상품', 'Product'],
        'tour_id': ['투어ID', '투어', 'Tour'],
        'pickup_hotel': ['픽업호텔', '호텔', 'Hotel'],
        'pickup_time': ['픽업시간', '픽업', 'Pickup'],
        'channel_id': ['채널', 'Channel'],
        'tour_status': ['상태', 'Status'],
        'notes': ['비고', '메모', 'Notes'],
        'tour_note': ['비고', '메모', 'Notes'],
        'event_note': ['비고', '메모', 'Notes'],
        'is_private_tour': ['개인투어', 'Private'],
        'tour_guide_id': ['가이드', 'Guide'],
        'guide_id': ['가이드', 'Guide'],
        'assistant_id': ['어시스턴트', 'Assistant'],
        'vehicle_id': ['차량', 'Vehicle'],
        'tour_car_id': ['차량', 'Vehicle'],
        'price': ['가격', 'Price'],
        'guide_fee': ['가이드비', 'Guide Fee'],
        'assistant_fee': ['어시스턴트비', 'Assistant Fee'],
        'created_at': ['생성일', 'Created'],
        'updated_at': ['수정일', 'Updated'],
        // Vehicles 테이블 매핑
        'vehicle_number': ['차량번호', 'Vehicle Number', '차량 번호'],
        'vin': ['VIN', '차대번호', '차대 번호'],
        'vehicle_type': ['차량종류', 'Vehicle Type', '차량 종류', '타입'],
        'capacity': ['정원', 'Capacity', '수용인원', '수용 인원'],
        'year': ['연식', 'Year', '연도'],
        'mileage_at_purchase': ['구매시주행거리', 'Purchase Mileage', '구매시 주행거리'],
        'purchase_amount': ['구매금액', 'Purchase Amount', '구매 금액', '가격'],
        'purchase_date': ['구매일', 'Purchase Date', '구매 날짜'],
        'memo': ['메모', 'Memo', '비고', 'Notes'],
        'engine_oil_change_cycle': ['엔진오일교환주기', 'Oil Change Cycle', '엔진오일 교환주기'],
        'current_mileage': ['현재주행거리', 'Current Mileage', '현재 주행거리'],
        'recent_engine_oil_change_mileage': ['최근엔진오일교환주행거리', 'Recent Oil Change Mileage', '최근 엔진오일 교환 주행거리'],
        'vehicle_status': ['차량상태', 'Vehicle Status', '차량 상태', '상태'],
        'front_tire_size': ['앞타이어사이즈', 'Front Tire Size', '앞 타이어 사이즈'],
        'rear_tire_size': ['뒤타이어사이즈', 'Rear Tire Size', '뒤 타이어 사이즈'],
        'windshield_wiper_size': ['와이퍼사이즈', 'Wiper Size', '와이퍼 사이즈'],
        'headlight_model': ['헤드라이트모델', 'Headlight Model', '헤드라이트 모델'],
        'headlight_model_name': ['헤드라이트모델명', 'Headlight Model Name', '헤드라이트 모델명'],
        'is_installment': ['할부여부', 'Installment', '할부 여부'],
        'installment_amount': ['할부금액', 'Installment Amount', '할부 금액'],
        'interest_rate': ['이자율', 'Interest Rate', '이자율'],
        'monthly_payment': ['월납입금', 'Monthly Payment', '월 납입금'],
        'additional_payment': ['추가납입금', 'Additional Payment', '추가 납입금'],
        'payment_due_date': ['납입일', 'Payment Due Date', '납입 날짜'],
        'installment_start_date': ['할부시작일', 'Installment Start Date', '할부 시작일'],
        // Off Schedules 테이블 매핑
        'team_email': ['팀이메일', 'Team Email', '이메일', 'Email'],
        'off_date': ['휴가날짜', 'Off Date', '휴가 날짜', '날짜', 'Date'],
        'reason': ['사유', 'Reason', '휴가사유', '휴가 사유'],
        'status': ['상태', 'Status'],
        'approved_by': ['승인자', 'Approved By', '승인한 사람'],
        'approved_at': ['승인일시', 'Approved At', '승인 날짜', '승인 시간'],
        // Payment Records 테이블 매핑
        'reservation_id': ['예약번호', 'Reservation ID', '예약 ID', '예약아이디'],
        'payment_status': ['결제상태', 'Payment Status', '결제 상태', '상태'],
        'amount': ['금액', 'Amount', '결제금액', '결제 금액'],
        'payment_method': ['결제방법', 'Payment Method', '결제 방법', '방법'],
        'note': ['메모', 'Note', '비고', 'Notes'],
        'image_file_url': ['이미지파일', 'Image File', '이미지 파일', '파일'],
        'submit_on': ['제출일시', 'Submit On', '제출 날짜', '제출 시간'],
        'submit_by': ['제출자', 'Submit By', '제출한 사람'],
        'confirmed_on': ['확인일시', 'Confirmed On', '확인 날짜', '확인 시간'],
        'confirmed_by': ['확인자', 'Confirmed By', '확인한 사람'],
        'amount_krw': ['원화금액', 'Amount KRW', '원화 금액', 'KRW']
      }
      
      if (koreanMappings[dbColumn]) {
        koreanMappings[dbColumn].forEach(mapping => {
          if (sheetLower.includes(mapping.toLowerCase())) {
            suggestions.push(sheetCol)
          }
        })
      }
    })
    
    // 중복 제거 및 정렬
    return [...new Set(suggestions)].slice(0, 5) // 최대 5개 제안
  }

  // 자동 매핑 함수 (데이터베이스 컬럼과 구글 시트 컬럼을 자동으로 매핑)
  const getAutoMapping = (dbColumns: ColumnInfo[], sheetColumns: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {}
    
    dbColumns.forEach(dbColumn => {
      const suggestions = getAutoCompleteSuggestions(dbColumn.name, sheetColumns)
      if (suggestions.length > 0) {
        // 가장 높은 우선순위의 제안을 선택
        mapping[suggestions[0]] = dbColumn.name
      }
    })
    
    return mapping
  }

  // 사용 가능한 테이블 가져오기 (모든 Supabase 테이블) - 캐싱 적용
  const getAvailableTables = useCallback(async () => {
    try {
      // 이미 로드된 경우 중복 호출 방지
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
      console.error('Error getting available tables:', error)
    }
  }, [availableTables.length])

  // 테이블 스키마 가져오기 (재시도 + 장시간 타임아웃)
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
      // 폴백: 하드코딩된 컬럼 목록 사용
      const fallbackColumns = getFallbackColumns(tableName)
      console.warn('Using fallback columns due to error:', error)
      setTableColumns(fallbackColumns)
    }
  }

  // 폴백 컬럼 목록
  const getFallbackColumns = (tableName: string): ColumnInfo[] => {
    const fallbackColumns: { [key: string]: ColumnInfo[] } = {
      pickup_hotels: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'hotel', type: 'text', nullable: false, default: null },
        { name: 'pick_up_location', type: 'text', nullable: false, default: null },
        { name: 'address', type: 'text', nullable: true, default: null },
        { name: 'pin', type: 'text', nullable: true, default: null },
        { name: 'link', type: 'text', nullable: true, default: null },
        { name: 'media', type: 'text[]', nullable: true, default: null },
        { name: 'description_ko', type: 'text', nullable: true, default: null },
        { name: 'description_en', type: 'text', nullable: true, default: null },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' },
      ],
      reservations: [
        { name: 'id', type: 'uuid', nullable: false, default: null },
        { name: 'customer_id', type: 'text', nullable: true, default: null },
        { name: 'product_id', type: 'text', nullable: true, default: null },
        { name: 'tour_id', type: 'text', nullable: true, default: null },
        { name: 'customer_name', type: 'text', nullable: true, default: null },
        { name: 'customer_email', type: 'text', nullable: true, default: null },
        { name: 'customer_phone', type: 'text', nullable: true, default: null },
        { name: 'adults', type: 'integer', nullable: true, default: null },
        { name: 'child', type: 'integer', nullable: true, default: null },
        { name: 'infant', type: 'integer', nullable: true, default: null },
        { name: 'total_people', type: 'integer', nullable: true, default: null },
        { name: 'tour_date', type: 'date', nullable: true, default: null },
        { name: 'tour_time', type: 'text', nullable: true, default: null },
        { name: 'pickup_hotel', type: 'text', nullable: true, default: null },
        { name: 'pickup_time', type: 'text', nullable: true, default: null },
        { name: 'channel', type: 'text', nullable: true, default: null },
        { name: 'channel_rn', type: 'text', nullable: true, default: null },
        { name: 'added_by', type: 'text', nullable: true, default: null },
        { name: 'status', type: 'text', nullable: true, default: 'pending' },
        { name: 'event_note', type: 'text', nullable: true, default: null },
        { name: 'is_private_tour', type: 'boolean', nullable: true, default: 'false' },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' },
      ],
      tours: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'product_id', type: 'text', nullable: true, default: null },
        { name: 'tour_date', type: 'date', nullable: true, default: null },
        { name: 'tour_status', type: 'text', nullable: true, default: 'Recruiting' },
        { name: 'tour_guide_id', type: 'uuid', nullable: true, default: null },
        { name: 'assistant_id', type: 'uuid', nullable: true, default: null },
        { name: 'tour_car_id', type: 'uuid', nullable: true, default: null },
        { name: 'is_private_tour', type: 'boolean', nullable: true, default: 'false' },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ],
      customers: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'name', type: 'text', nullable: true, default: null },
        { name: 'email', type: 'text', nullable: true, default: null },
        { name: 'phone', type: 'text', nullable: true, default: null },
        { name: 'language', type: 'text', nullable: true, default: 'ko' },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ],
      products: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'name', type: 'text', nullable: true, default: null },
        { name: 'description', type: 'text', nullable: true, default: null },
        { name: 'price', type: 'numeric', nullable: true, default: null },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ],
      ticket_bookings: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'category', type: 'text', nullable: true, default: null },
        { name: 'submit_on', type: 'date', nullable: true, default: null },
        { name: 'submitted_by', type: 'text', nullable: true, default: null },
        { name: 'check_in_date', type: 'date', nullable: true, default: null },
        { name: 'time', type: 'time', nullable: true, default: null },
        { name: 'company', type: 'text', nullable: true, default: null },
        { name: 'ea', type: 'integer', nullable: true, default: null },
        { name: 'expense', type: 'numeric', nullable: true, default: null },
        { name: 'income', type: 'numeric', nullable: true, default: null },
        { name: 'payment_method', type: 'text', nullable: true, default: null },
        { name: 'rn_number', type: 'text', nullable: true, default: null },
        { name: 'tour_id', type: 'text', nullable: true, default: null },
        { name: 'note', type: 'text', nullable: true, default: null },
        { name: 'status', type: 'text', nullable: true, default: null },
        { name: 'season', type: 'text', nullable: true, default: null },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'reservation_id', type: 'text', nullable: true, default: null }
      ],
      tour_hotel_bookings: [
        { name: 'id', type: 'text', nullable: false, default: 'gen_random_uuid()::text' },
        { name: 'tour_id', type: 'text', nullable: true, default: null },
        { name: 'event_date', type: 'date', nullable: false, default: null },
        { name: 'submit_on', type: 'timestamp', nullable: true, default: 'now()' },
        { name: 'check_in_date', type: 'date', nullable: false, default: null },
        { name: 'check_out_date', type: 'date', nullable: false, default: null },
        { name: 'reservation_name', type: 'text', nullable: false, default: null },
        { name: 'submitted_by', type: 'text', nullable: true, default: null },
        { name: 'cc', type: 'text', nullable: true, default: null },
        { name: 'rooms', type: 'integer', nullable: false, default: '1' },
        { name: 'city', type: 'text', nullable: false, default: null },
        { name: 'hotel', type: 'text', nullable: false, default: null },
        { name: 'room_type', type: 'text', nullable: true, default: null },
        { name: 'unit_price', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'total_price', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'payment_method', type: 'text', nullable: true, default: null },
        { name: 'website', type: 'text', nullable: true, default: null },
        { name: 'rn_number', type: 'text', nullable: true, default: null },
        { name: 'status', type: 'text', nullable: true, default: 'pending' },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ],
      vehicles: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'vehicle_number', type: 'text', nullable: true, default: null },
        { name: 'vin', type: 'text', nullable: true, default: null },
        { name: 'vehicle_type', type: 'text', nullable: true, default: null },
        { name: 'capacity', type: 'integer', nullable: true, default: null },
        { name: 'year', type: 'integer', nullable: true, default: null },
        { name: 'mileage_at_purchase', type: 'integer', nullable: true, default: null },
        { name: 'purchase_amount', type: 'numeric', nullable: true, default: null },
        { name: 'purchase_date', type: 'date', nullable: true, default: null },
        { name: 'memo', type: 'text', nullable: true, default: null },
        { name: 'engine_oil_change_cycle', type: 'integer', nullable: true, default: null },
        { name: 'current_mileage', type: 'integer', nullable: true, default: null },
        { name: 'recent_engine_oil_change_mileage', type: 'integer', nullable: true, default: null },
        { name: 'vehicle_status', type: 'text', nullable: true, default: null },
        { name: 'front_tire_size', type: 'text', nullable: true, default: null },
        { name: 'rear_tire_size', type: 'text', nullable: true, default: null },
        { name: 'windshield_wiper_size', type: 'text', nullable: true, default: null },
        { name: 'headlight_model', type: 'text', nullable: true, default: null },
        { name: 'headlight_model_name', type: 'text', nullable: true, default: null },
        { name: 'is_installment', type: 'boolean', nullable: true, default: 'false' },
        { name: 'installment_amount', type: 'numeric', nullable: true, default: null },
        { name: 'interest_rate', type: 'numeric', nullable: true, default: null },
        { name: 'monthly_payment', type: 'numeric', nullable: true, default: null },
        { name: 'additional_payment', type: 'numeric', nullable: true, default: null },
        { name: 'payment_due_date', type: 'date', nullable: true, default: null },
        { name: 'installment_start_date', type: 'date', nullable: true, default: null },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ],
      tour_expenses: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'tour_id', type: 'text', nullable: false, default: null },
        { name: 'submit_on', type: 'timestamp', nullable: true, default: 'now()' },
        { name: 'paid_to', type: 'text', nullable: true, default: null },
        { name: 'paid_for', type: 'text', nullable: false, default: null },
        { name: 'amount', type: 'numeric', nullable: false, default: null },
        { name: 'payment_method', type: 'text', nullable: true, default: null },
        { name: 'note', type: 'text', nullable: true, default: null },
        { name: 'tour_date', type: 'date', nullable: false, default: null },
        { name: 'product_id', type: 'text', nullable: true, default: null },
        { name: 'submitted_by', type: 'text', nullable: false, default: null },
        { name: 'image_url', type: 'text', nullable: true, default: null },
        { name: 'file_path', type: 'text', nullable: true, default: null },
        { name: 'audited_by', type: 'text', nullable: true, default: null },
        { name: 'checked_by', type: 'text', nullable: true, default: null },
        { name: 'checked_on', type: 'timestamp', nullable: true, default: null },
        { name: 'status', type: 'text', nullable: true, default: 'pending' },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ],
      team: [
        { name: 'email', type: 'text', nullable: false, default: null },
        { name: 'name_ko', type: 'text', nullable: false, default: null },
        { name: 'name_en', type: 'text', nullable: true, default: null },
        { name: 'phone', type: 'text', nullable: false, default: null },
        { name: 'position', type: 'text', nullable: true, default: null },
        { name: 'languages', type: 'text[]', nullable: true, default: '{}' },
        { name: 'avatar_url', type: 'text', nullable: true, default: null },
        { name: 'is_active', type: 'boolean', nullable: true, default: 'true' },
        { name: 'hire_date', type: 'date', nullable: true, default: null },
        { name: 'status', type: 'text', nullable: true, default: 'active' },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'emergency_contact', type: 'text', nullable: true, default: null },
        { name: 'date_of_birth', type: 'date', nullable: true, default: null },
        { name: 'ssn', type: 'text', nullable: true, default: null },
        { name: 'personal_car_model', type: 'text', nullable: true, default: null },
        { name: 'car_year', type: 'integer', nullable: true, default: null },
        { name: 'car_plate', type: 'text', nullable: true, default: null },
        { name: 'bank_name', type: 'text', nullable: true, default: null },
        { name: 'account_holder', type: 'text', nullable: true, default: null },
        { name: 'bank_number', type: 'text', nullable: true, default: null },
        { name: 'routing_number', type: 'text', nullable: true, default: null },
        { name: 'cpr', type: 'boolean', nullable: true, default: 'false' },
        { name: 'cpr_acquired', type: 'date', nullable: true, default: null },
        { name: 'cpr_expired', type: 'date', nullable: true, default: null },
        { name: 'medical_report', type: 'boolean', nullable: true, default: 'false' },
        { name: 'medical_acquired', type: 'date', nullable: true, default: null },
        { name: 'medical_expired', type: 'date', nullable: true, default: null },
        { name: 'address', type: 'text', nullable: true, default: null }
      ],
      reservation_pricing: [
        { name: 'id', type: 'text', nullable: false, default: 'gen_random_uuid()::text' },
        { name: 'reservation_id', type: 'text', nullable: false, default: null },
        { name: 'adult_product_price', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'child_product_price', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'infant_product_price', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'product_price_total', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'required_options', type: 'jsonb', nullable: true, default: '{}' },
        { name: 'required_option_total', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'subtotal', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'coupon_code', type: 'text', nullable: true, default: null },
        { name: 'coupon_discount', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'additional_discount', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'additional_cost', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'card_fee', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'tax', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'prepayment_cost', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'prepayment_tip', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'selected_options', type: 'jsonb', nullable: true, default: '{}' },
        { name: 'option_total', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'is_private_tour', type: 'boolean', nullable: true, default: 'false' },
        { name: 'private_tour_additional_cost', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'total_price', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'deposit_amount', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'balance_amount', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'commission_percent', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'commission_amount', type: 'numeric', nullable: true, default: '0.00' },
        { name: 'created_at', type: 'timestamp', nullable: true, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: true, default: 'now()' }
      ],
      off_schedules: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'team_email', type: 'character varying(255)', nullable: false, default: null },
        { name: 'off_date', type: 'date', nullable: false, default: null },
        { name: 'reason', type: 'text', nullable: false, default: null },
        { name: 'status', type: 'text', nullable: false, default: "'pending'" },
        { name: 'approved_by', type: 'character varying(255)', nullable: true, default: null },
        { name: 'approved_at', type: 'timestamp with time zone', nullable: true, default: null },
        { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
        { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
      ],
      payment_records: [
        { name: 'id', type: 'text', nullable: false, default: 'gen_random_uuid()' },
        { name: 'reservation_id', type: 'text', nullable: false, default: null },
        { name: 'payment_status', type: 'character varying(50)', nullable: false, default: "'pending'" },
        { name: 'amount', type: 'numeric(10, 2)', nullable: false, default: null },
        { name: 'payment_method', type: 'character varying(50)', nullable: false, default: null },
        { name: 'note', type: 'text', nullable: true, default: null },
        { name: 'image_file_url', type: 'text', nullable: true, default: null },
        { name: 'submit_on', type: 'timestamp with time zone', nullable: true, default: 'now()' },
        { name: 'submit_by', type: 'character varying(255)', nullable: true, default: null },
        { name: 'confirmed_on', type: 'timestamp with time zone', nullable: true, default: null },
        { name: 'confirmed_by', type: 'character varying(255)', nullable: true, default: null },
        { name: 'amount_krw', type: 'numeric(10, 2)', nullable: true, default: null },
        { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
        { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
      ]
    }
    
    return fallbackColumns[tableName] || []
  }

  // 구글 시트 URL 생성
  const getGoogleSheetsUrl = () => {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  }

  // 구글 시트 열기
  const openGoogleSheets = () => {
    window.open(getGoogleSheetsUrl(), '_blank')
  }

  // 구글 시트 정보 가져오기
  const getSheetInfo = async () => {
    if (!spreadsheetId.trim()) {
      alert('스프레드시트 ID를 입력해주세요.')
      return
    }

    setLoading(true)
    setSheetInfo([]) // 이전 데이터 초기화
    
    try {
      // 타임아웃 설정 (35초)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 35000)

      const response = await fetch('/api/sync/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spreadsheetId }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setSheetInfo(result.data.sheets)
        
        // 첫 번째 시트를 기본 선택
        if (result.data.sheets.length > 0) {
          setSelectedSheet(result.data.sheets[0].name)
        } else {
          alert('시트를 찾을 수 없습니다. 스프레드시트에 "S"로 시작하는 시트가 있는지 확인해주세요.')
        }
      } else {
        alert(`시트 정보를 가져오는데 실패했습니다: ${result.message}`)
      }
    } catch (error) {
      console.error('Error getting sheet info:', error)
      
      let errorMessage = '시트 정보를 가져오는데 오류가 발생했습니다.'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '요청 시간이 초과되었습니다. 구글 시트 API 응답이 너무 오래 걸립니다.'
        } else if (error.message.includes('403')) {
          errorMessage = '구글 시트 접근 권한이 없습니다. 시트 공유 설정을 확인해주세요.'
        } else if (error.message.includes('404')) {
          errorMessage = '구글 시트를 찾을 수 없습니다. 스프레드시트 ID를 확인해주세요.'
        } else {
          errorMessage = `오류: ${error.message}`
        }
      }
      
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // 컬럼 매핑 제안 가져오기
  const getMappingSuggestions = async (sheetColumns: string[], tableName: string) => {
    try {
      const response = await fetch(`/api/sync/tables?sheetColumns=${JSON.stringify(sheetColumns)}&tableName=${tableName}`)
      const result = await response.json()
      
      if (result.success) {
        // setMappingSuggestions(result.data.suggestions)
        console.log('Mapping suggestions:', result.data.suggestions)
      }
    } catch (error) {
      console.error('Error getting mapping suggestions:', error)
    }
  }

  // 시트 선택 시 컬럼 매핑 제안 가져오기
  const handleSheetSelect = (sheetName: string) => {
    console.log('Sheet selected:', sheetName)
    setSelectedSheet(sheetName)
    const sheet = sheetInfo.find(s => s.name === sheetName)
    console.log('Selected sheet info:', sheet)
    
    if (sheet && sheet.columns.length > 0 && selectedTable) {
      console.log('Getting mapping suggestions for columns:', sheet.columns, 'and table:', selectedTable)
      getMappingSuggestions(sheet.columns, selectedTable)
    } else {
      console.log('No columns found for sheet:', sheetName)
      // 컬럼이 없는 시트인 경우 경고 표시
      if (sheet && sheet.rowCount === 0) {
        alert(`${sheetName} 시트는 비어있습니다. 데이터가 있는 다른 시트를 선택해주세요.`)
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
      console.error('Error fetching last sync time:', error)
      setLastSyncTime(null)
    }
  }

  // 테이블 선택 시 기본 매핑 설정
  const handleTableSelect = (tableName: string) => {
    console.log('Table selected:', tableName)
    setSelectedTable(tableName)
    setTableColumns([]) // 이전 컬럼 정보 초기화
    setTruncateTable(false) // 테이블 삭제 옵션 초기화
    
    if (tableName) {
      // 테이블 스키마 가져오기
      console.log('Fetching schema for table:', tableName)
      getTableSchema(tableName)
      
      // 마지막 동기화 시간 조회
      fetchLastSyncTime(tableName)
      
      // 저장된 컬럼 매핑 불러오기
      const savedMapping = loadColumnMapping(tableName)
      if (Object.keys(savedMapping).length > 0) {
        console.log('Loaded saved column mapping:', savedMapping)
        setColumnMapping(savedMapping)
      } else {
        // 저장된 매핑이 없으면 자동 매핑 시도
        const sheet = sheetInfo.find(s => s.name === selectedSheet)
        if (sheet && sheet.columns.length > 0) {
          console.log('No saved mapping found, will try auto-mapping when schema loads')
        }
      }
      
      // 선택된 시트가 있으면 매핑 제안 가져오기
      const sheet = sheetInfo.find(s => s.name === selectedSheet)
      if (sheet && sheet.columns.length > 0) {
        console.log('Getting mapping suggestions for table:', tableName, 'and sheet:', selectedSheet)
        getMappingSuggestions(sheet.columns, tableName)
      }
    }
  }

  // 유연한 데이터 동기화
  const handleFlexibleSync = async () => {
    const supabase = createClientSupabase()
    // 세션을 강제로 한 번 더 조회하여 토큰을 보장
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
    // 추정 처리속도 학습값 (ms/row)
    const defaultMsPerRow = Number(localStorage.getItem('flex-sync-ms-per-row')) || 10
    const sheet = sheetInfo.find(s => s.name === selectedSheet)
    const estimatedRows = Math.max(sheet?.rowCount || 200, 1)
    const estimatedDurationMs = Math.max(estimatedRows * defaultMsPerRow, 1500)
    const startTs = Date.now()
    setEtaMs(estimatedDurationMs)
    // 진행률 타이머 시작 (최대 95%까지)
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
            
            // 실시간 로그 추가
            if (evt.type === 'info') {
              setSyncLogs(prev => [...prev, `[INFO] ${evt.message}`])
            } else if (evt.type === 'warn') {
              setSyncLogs(prev => [...prev, `[WARN] ${evt.message}`])
            } else if (evt.type === 'error') {
              setSyncLogs(prev => [...prev, `[ERROR] ${evt.message}`])
            }
            
            if (evt.type === 'start' && evt.total) {
              // 서버가 총량을 알려주면 그에 맞춰 ETA 재계산
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
              
              // 실시간 통계 업데이트
              setRealTimeStats({
                processed: evt.processed || 0,
                inserted: evt.inserted || 0,
                updated: evt.updated || 0,
                errors: evt.errors || 0
              })
              
              // 진행 상황 로그 (10% 단위로)
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
      // 로딩 상태를 즉시 false로 변경하지 않고, 결과가 표시된 후에 변경
      setLoading(false)
    }
  }

  // 예약 데이터 정리 함수
  const handleReservationCleanup = async () => {
    if (!confirm('예약 데이터를 정리하시겠습니까?\n\n- MDGCSUNRISE_X → MDGCSUNRISE (Antelope X Canyon 옵션 추가)\n- MDGC1D_X → MDGC1D (Antelope X Canyon 옵션 추가)\n- MDGCSUNRISE → Lower Antelope Canyon 옵션 추가\n- MDGC1D → Lower Antelope Canyon 옵션 추가')) {
      return
    }

    setCleanupLoading(true)
    setCleanupResult(null)

    try {
      const response = await fetch('/api/reservations/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()
      setCleanupResult(result)
    } catch (error) {
      console.error('예약 데이터 정리 오류:', error)
      setCleanupResult({
        success: false,
        message: `예약 데이터 정리 중 오류가 발생했습니다: ${error}`
      })
    } finally {
      setCleanupLoading(false)
    }
  }

  // 컴포넌트 마운트 시 사용 가능한 테이블만 가져오기
  useEffect(() => {
    getAvailableTables()
  }, [getAvailableTables])

  // 주기적 동기화 (사용하지 않음)
  // const handlePeriodicSync = async () => {
  //   if (!spreadsheetId.trim()) {
  //     alert('스프레드시트 ID를 입력해주세요.')
  //     return
  //   }

  //   setLoading(true)
  //   setSyncResult(null)

  //   try {
  //     const response = await fetch('/api/sync/periodic', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         spreadsheetId,
  //         reservationsSheet: '',
  //         toursSheet: '',
  //         lastSyncTime,
  //       }),
  //     })

  //     const result = await response.json()
  //     setSyncResult(result)
      
  //     if (result.success) {
  //       setLastSyncTime(result.syncTime)
  //     }
  //   } catch (error) {
  //     console.error('Error syncing data:', error)
  //     setSyncResult({
  //       success: false,
  //       message: '데이터 동기화 중 오류가 발생했습니다.'
  //     })
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">데이터 동기화</h1>
        <p className="text-gray-600">
          구글 시트 데이터 동기화 및 날씨 데이터 수집을 관리합니다.
        </p>
      </div>

      {/* 날씨 데이터 수집 섹션 */}
      <div className="mb-6">
        <WeatherDataCollector />
      </div>

      {/* 예약 데이터 정리 섹션 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Database className="h-5 w-5 mr-2" />
          예약 데이터 정리
        </h2>
        
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">정리 규칙:</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• <strong>MDGCSUNRISE_X</strong> → <strong>MDGCSUNRISE</strong>로 변경하고 <strong>Antelope X Canyon</strong> 옵션 추가</li>
            <li>• <strong>MDGC1D_X</strong> → <strong>MDGC1D</strong>로 변경하고 <strong>Antelope X Canyon</strong> 옵션 추가</li>
            <li>• <strong>MDGCSUNRISE</strong> → <strong>Lower Antelope Canyon</strong> 옵션 추가 (옵션이 없는 경우)</li>
            <li>• <strong>MDGC1D</strong> → <strong>Lower Antelope Canyon</strong> 옵션 추가 (옵션이 없는 경우)</li>
          </ul>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleReservationCleanup}
            disabled={cleanupLoading}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Database className="h-4 w-4 mr-2" />
            {cleanupLoading ? '정리 중...' : '예약 데이터 정리 실행'}
          </button>
        </div>

        {/* 정리 결과 표시 */}
        {cleanupResult && (
          <div className="mt-4 p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900 flex items-center">
                {cleanupResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mr-2" />
                )}
                정리 결과
              </h4>
              <button
                onClick={() => setCleanupResult(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕ 닫기
              </button>
            </div>
            
            <div className={`p-3 rounded-lg ${
              cleanupResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`text-sm font-medium ${
                cleanupResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {cleanupResult.message}
              </p>
              
              {cleanupResult.data && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-blue-50 p-2 rounded text-center">
                    <div className="font-bold text-blue-600">{cleanupResult.data.mdgcSunriseXUpdated || 0}</div>
                    <div className="text-blue-800">MDGCSUNRISE_X</div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded text-center">
                    <div className="font-bold text-purple-600">{cleanupResult.data.mdgc1DXUpdated || 0}</div>
                    <div className="text-purple-800">MDGC1D_X</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded text-center">
                    <div className="font-bold text-green-600">{cleanupResult.data.mdgcSunriseUpdated || 0}</div>
                    <div className="text-green-800">MDGCSUNRISE</div>
                  </div>
                  <div className="bg-yellow-50 p-2 rounded text-center">
                    <div className="font-bold text-yellow-600">{cleanupResult.data.mdgc1DUpdated || 0}</div>
                    <div className="text-yellow-800">MDGC1D</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 설정 섹션 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <FileSpreadsheet className="h-5 w-5 mr-2" />
          구글 시트 설정
        </h2>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>📋 필터링:</strong> 첫 글자가 &apos;S&apos;로 시작하는 시트만 표시됩니다.
          </p>
        </div>
        
        {sheetInfo.length === 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>💡 안내:</strong> 시트 정보를 가져오려면 아래 버튼을 클릭하세요.
            </p>
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            스프레드시트 ID
          </label>
          <div className="relative">
            <input
              type="text"
              value={spreadsheetId}
              readOnly
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-green-600">
              ✓
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            고정된 구글 시트 ID입니다. 변경할 수 없습니다.
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={getSheetInfo}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {sheetInfo.length === 0 ? '시트 정보 가져오기' : '시트 정보 새로고침'}
          </button>
          <button
            onClick={openGoogleSheets}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            구글 시트 열기
          </button>
        </div>
      </div>

      {/* 테이블 선택 및 컬럼 매핑 */}
      {selectedSheet && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            동기화 설정
          </h3>
          
          {/* 동기화 옵션 (초기화 후 전체 동기화) */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={truncateTable}
                  onChange={(e) => setTruncateTable(e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
                  disabled={!selectedTable}
                />
                <span className="text-sm font-medium text-gray-700">
                  동기화 전에 {selectedTable || '선택된 테이블'} 전체 삭제
                </span>
              </label>
              <div className="text-xs text-gray-500">
                {selectedTable ? (
                  <>
                    <strong>⚠️ 주의:</strong> {selectedTable} 테이블의 모든 데이터가 삭제됩니다. 
                    복구 불가이므로 사전 백업을 권장합니다.
                  </>
                ) : (
                  '테이블을 선택하면 해당 테이블의 데이터를 삭제할 수 있습니다.'
                )}
              </div>
            </div>
            {lastSyncTime && (
              <p className="text-xs text-blue-600 mt-2">
                마지막 동기화: {new Date(lastSyncTime).toLocaleString('ko-KR')}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 테이블 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                대상 테이블
              </label>
              <select
                value={selectedTable}
                onChange={(e) => handleTableSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">테이블을 선택하세요</option>
                {availableTables.map((table) => (
                  <option key={table.name} value={table.name}>
                    {table.displayName} ({table.name})
                  </option>
                ))}
              </select>
            </div>

            {/* 시트 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시트 선택
              </label>
              <select
                value={selectedSheet}
                onChange={(e) => handleSheetSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sheetInfo.length === 0}
              >
                <option value="">시트를 선택하세요</option>
                {sheetInfo.map((sheet) => (
                  <option 
                    key={sheet.name} 
                    value={sheet.name}
                    disabled={sheet.rowCount === 0}
                    style={{ 
                      color: sheet.rowCount === 0 ? '#999' : 'inherit',
                      fontStyle: sheet.rowCount === 0 ? 'italic' : 'normal'
                    }}
                  >
                    {sheet.name} ({sheet.rowCount}행) {sheet.rowCount === 0 ? '- 비어있음' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 컬럼 매핑 버튼 */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  console.log('Opening mapping modal. Selected table:', selectedTable, 'Selected sheet:', selectedSheet)
                  console.log('Current table columns:', tableColumns)
                  console.log('Current sheet info:', sheetInfo)
                  setShowMappingModal(true)
                }}
                disabled={!selectedTable || !selectedSheet}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Settings className="h-4 w-4 mr-2" />
                컬럼 매핑 설정
              </button>
            </div>
          </div>

          {/* 현재 매핑 상태 표시 */}
          {Object.keys(columnMapping).length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">현재 매핑:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(columnMapping).map(([sheetCol, dbCol]) => (
                  <div key={sheetCol} className="flex items-center">
                    <span className="text-gray-600">{dbCol}</span>
                    <ArrowRight className="h-3 w-3 mx-2 text-gray-400" />
                    <span className="text-gray-900 font-medium">{sheetCol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 동기화 실행 */}
      {selectedSheet && selectedTable && Object.keys(columnMapping).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">동기화 실행</h3>
          
          {/* 동기화 설정 요약 */}
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">동기화 설정 요약</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-blue-700 font-medium">대상 테이블:</span>
                <span className="ml-2 text-blue-600">{selectedTable}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">시트:</span>
                <span className="ml-2 text-blue-600">{selectedSheet}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">매핑된 컬럼:</span>
                <span className="ml-2 text-blue-600">{Object.keys(columnMapping).length}개</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">데이터 삭제:</span>
                <span className={`ml-2 ${truncateTable ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                  {truncateTable ? '예 (전체 삭제 후 동기화)' : '아니오 (기존 데이터 유지)'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-3 mb-4">
            <button
              onClick={handleFlexibleSync}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Upload className="h-4 w-4 mr-2" />
              {truncateTable ? '데이터 삭제 후 동기화 실행' : '동기화 실행'}
            </button>
          </div>

          {lastSyncTime && (
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-2" />
              마지막 동기화: {new Date(lastSyncTime).toLocaleString('ko-KR')}
            </div>
          )}
        </div>
      )}

      {/* 실시간 동기화 진행 상황 */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            동기화 진행 중
          </h3>
          
          {/* 진행률 바 */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>진행률</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {etaMs && etaMs > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                예상 완료 시간: {Math.ceil(etaMs / 1000)}초 후
              </div>
            )}
          </div>

          {/* 실시간 통계 */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{realTimeStats.processed}</div>
              <div className="text-sm text-blue-800">처리됨</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{realTimeStats.inserted}</div>
              <div className="text-sm text-green-800">삽입됨</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{realTimeStats.updated}</div>
              <div className="text-sm text-yellow-800">업데이트됨</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{realTimeStats.errors}</div>
              <div className="text-sm text-red-800">오류</div>
            </div>
          </div>

          {/* 실시간 로그 */}
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
            <div className="text-gray-400 text-xs mb-2">실시간 로그:</div>
            {syncLogs.length === 0 ? (
              <div className="text-gray-500">로그를 기다리는 중...</div>
            ) : (
              syncLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}


      {/* 컬럼 매핑 모달 */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              컬럼 매핑 설정
              {selectedTable && (
                <span className="text-sm text-gray-500 ml-2">
                  ({selectedTable} 테이블)
                </span>
              )}
            </h3>
            
            {tableColumns.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-600">실제 데이터베이스에서 테이블 스키마를 불러오는 중...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 헤더 정보 */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-800">선택된 테이블:</span>
                      <span className="ml-2 text-blue-600">{selectedTable}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">데이터베이스 컬럼 수:</span>
                      <span className="ml-2 text-blue-600">{tableColumns.length}개</span>
                      {tableColumns.length > 0 && (
                        <span className="ml-2 text-xs text-green-600">
                          (실시간 조회)
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">시트 컬럼 수:</span>
                      <span className="ml-2 text-blue-600">{sheetInfo.find(s => s.name === selectedSheet)?.columns.length || 0}개</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">매핑된 컬럼:</span>
                      <span className="ml-2 text-blue-600">{Object.keys(columnMapping).length}개</span>
                    </div>
                  </div>
                </div>

                {/* 컬럼 매핑 테이블 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                      <div className="col-span-4">데이터베이스 컬럼</div>
                      <div className="col-span-1 text-center">→</div>
                      <div className="col-span-7">구글 시트 컬럼</div>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-gray-200">
                    {tableColumns.map((dbColumn, index) => (
                      <div key={`${dbColumn.name}-${index}`} className="px-4 py-3 hover:bg-gray-50">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-4">
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{dbColumn.name}</span>
                                <span className="text-xs text-gray-500">
                                  {dbColumn.type}
                                  {!dbColumn.nullable && ' *'}
                                  {dbColumn.default && ` (기본값: ${dbColumn.default})`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-1 text-center">
                            <ArrowRight className="h-4 w-4 text-gray-400 mx-auto" />
                          </div>
                          <div className="col-span-7">
                            <div className="relative">
                              <select
                                value={(() => {
                                  // 현재 데이터베이스 컬럼에 매핑된 구글시트 컬럼 찾기
                                  const mappedSheetColumn = Object.entries(columnMapping).find(([, dbCol]) => dbCol === dbColumn.name)?.[0] || ''
                                  return mappedSheetColumn
                                })()}
                                onChange={(e) => {
                                  const newMapping = { ...columnMapping }
                                  
                                  // 기존 매핑에서 이 데이터베이스 컬럼을 사용하는 구글시트 컬럼 제거
                                  Object.keys(newMapping).forEach(sheetCol => {
                                    if (newMapping[sheetCol] === dbColumn.name) {
                                      delete newMapping[sheetCol]
                                    }
                                  })
                                  
                                  // 새로운 매핑 추가
                                  if (e.target.value) {
                                    newMapping[e.target.value] = dbColumn.name
                                  }
                                  
                                  setColumnMapping(newMapping)
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">매핑하지 않음</option>
                                {sheetInfo.find(s => s.name === selectedSheet)?.columns.map((sheetColumn) => (
                                  <option key={`${sheetColumn}-${index}`} value={sheetColumn}>
                                    {sheetColumn}
                                  </option>
                                ))}
                              </select>
                              
                              {/* 자동 완성 제안 */}
                              {(() => {
                                const suggestions = getAutoCompleteSuggestions(dbColumn.name, sheetInfo.find(s => s.name === selectedSheet)?.columns || [])
                                const currentValue = Object.entries(columnMapping).find(([, dbCol]) => dbCol === dbColumn.name)?.[0] || ''
                                const hasSuggestion = suggestions.length > 0 && !currentValue
                                
                                return hasSuggestion && (
                                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                                    <div className="p-2 text-xs text-gray-500 border-b">
                                      추천: {suggestions.slice(0, 3).join(', ')}
                                    </div>
                                    {suggestions.slice(0, 3).map((suggestion, idx) => (
                                      <button
                                        key={`suggestion-${idx}`}
                                        onClick={() => {
                                          const newMapping = { ...columnMapping }
                                          
                                          // 기존 매핑에서 이 데이터베이스 컬럼을 사용하는 구글시트 컬럼 제거
                                          Object.keys(newMapping).forEach(sheetCol => {
                                            if (newMapping[sheetCol] === dbColumn.name) {
                                              delete newMapping[sheetCol]
                                            }
                                          })
                                          
                                          // 새로운 매핑 추가
                                          newMapping[suggestion] = dbColumn.name
                                          setColumnMapping(newMapping)
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center"
                                      >
                                        <span className="text-blue-600 font-medium">{suggestion}</span>
                                      </button>
                                    ))}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 매핑 요약 */}
                {Object.keys(columnMapping).length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 mb-2">매핑 요약</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(columnMapping).map(([sheetCol, dbCol]) => (
                        <div key={`${sheetCol}-${dbCol}`} className="flex items-center">
                          <span className="text-green-700 font-medium">{dbCol}</span>
                          <ArrowRight className="h-3 w-3 text-green-500 mx-2" />
                          <span className="text-green-600">{sheetCol}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => {
                  // 자동 매핑 적용
                  const sheet = sheetInfo.find(s => s.name === selectedSheet)
                  if (sheet && sheet.columns.length > 0 && tableColumns.length > 0) {
                    const autoMapping = getAutoMapping(tableColumns, sheet.columns)
                    console.log('Applying auto-mapping:', autoMapping)
                    setColumnMapping(autoMapping)
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                자동 매핑
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    // 컬럼 매핑을 localStorage에 저장
                    if (selectedTable && Object.keys(columnMapping).length > 0) {
                      saveColumnMapping(selectedTable, columnMapping)
                    }
                    setShowMappingModal(false)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 결과 표시 */}
      {syncResult && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              {syncResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
              )}
              동기화 결과
            </h3>
            <button
              onClick={() => setSyncResult(null)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕ 닫기
            </button>
          </div>
          
          {/* 상태 메시지 */}
          <div className={`p-4 rounded-lg mb-4 ${
            syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`font-medium ${
              syncResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {syncResult.message}
            </p>
            {syncResult.syncTime && (
              <p className="text-sm text-gray-600 mt-1">
                완료 시간: {new Date(syncResult.syncTime).toLocaleString('ko-KR')}
              </p>
            )}
          </div>

          {/* 상세 통계 */}
          {syncResult.data && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {(syncResult.data.inserted || 0) + (syncResult.data.updated || 0)}
                </div>
                <div className="text-sm text-blue-800">총 처리</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{syncResult.data.inserted || 0}</div>
                <div className="text-sm text-green-800">삽입됨</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">{syncResult.data.updated || 0}</div>
                <div className="text-sm text-yellow-800">업데이트됨</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{syncResult.data.errors || 0}</div>
                <div className="text-sm text-red-800">오류</div>
              </div>
            </div>
          )}

          {/* 오류 상세 정보 */}
          {syncResult.data && syncResult.data.errorDetails && Array.isArray(syncResult.data.errorDetails) && syncResult.data.errorDetails.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2 flex items-center">
                <XCircle className="h-4 w-4 mr-1" />
                오류 상세 ({syncResult.data.errorDetails.length}개)
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {syncResult.data.errorDetails.map((error: string, index: number) => (
                  <div key={index} className="text-sm text-red-700 font-mono bg-red-100 p-2 rounded border-l-4 border-red-400">
                    <div className="font-semibold">오류 #{index + 1}:</div>
                    <div className="mt-1">{error}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-red-600">
                💡 <strong>해결 방법:</strong> 구글 시트의 데이터 형식을 확인하고, 필수 필드가 비어있지 않은지 확인하세요.
              </div>
            </div>
          )}

          {/* 전체 실행 로그 */}
          {syncLogs.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h4 className="font-medium text-gray-800">실행 로그 전체 ({syncLogs.length}개 항목):</h4>
                  <div className="text-xs text-gray-600 mt-1">
                    정보: {syncLogs.filter(log => log.includes('[INFO]')).length}개 | 
                    경고: {syncLogs.filter(log => log.includes('[WARN]')).length}개 | 
                    오류: {syncLogs.filter(log => log.includes('[ERROR]')).length}개 | 
                    결과: {syncLogs.filter(log => log.includes('[RESULT]')).length}개
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {/* 로그 필터 */}
                  <select
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="px-2 py-1 text-xs border rounded"
                  >
                    <option value="all">전체</option>
                    <option value="info">정보만</option>
                    <option value="warn">경고만</option>
                    <option value="error">오류만</option>
                  </select>
                  
                  {/* 전체 로그 토글 */}
                  <button
                    onClick={() => setShowFullLogs(!showFullLogs)}
                    className={`px-3 py-1 text-xs rounded ${
                      showFullLogs 
                        ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                        : 'bg-gray-500 text-white hover:bg-gray-600'
                    }`}
                  >
                    {showFullLogs ? '간소화' : '전체보기'}
                  </button>
                  
                  <button
                    onClick={() => {
                      const logText = syncLogs.join('\n')
                      navigator.clipboard.writeText(logText)
                      alert('로그가 클립보드에 복사되었습니다.')
                    }}
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  >
                    로그 복사
                  </button>
                  <button
                    onClick={() => {
                      const logText = syncLogs.join('\n')
                      const blob = new Blob([logText], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `sync-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    }}
                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                  >
                    로그 다운로드
                  </button>
                </div>
              </div>
              <div 
                ref={(el) => {
                  if (el && !showFullLogs) {
                    el.scrollTop = el.scrollHeight
                  }
                }}
                className={`bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-y-auto border ${
                  showFullLogs ? 'max-h-screen' : 'max-h-96'
                }`}
              >
                {syncLogs
                  .filter(log => {
                    if (logFilter === 'all') return true
                    if (logFilter === 'info') return log.includes('[INFO]')
                    if (logFilter === 'warn') return log.includes('[WARN]')
                    if (logFilter === 'error') return log.includes('[ERROR]')
                    return true
                  })
                  .map((log, index) => {
                    let logColor = 'text-green-400'
                    if (log.includes('[ERROR]')) logColor = 'text-red-400'
                    else if (log.includes('[WARN]')) logColor = 'text-yellow-400'
                    else if (log.includes('[INFO]')) logColor = 'text-blue-400'
                    else if (log.includes('[RESULT]')) logColor = 'text-purple-400'
                    
                    return (
                      <div key={index} className={`mb-1 whitespace-pre-wrap ${logColor}`}>
                        {log}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
