import { supabase } from '@/lib/supabase'

// 결제 방법 관리 유틸리티 클래스
export class PaymentMethodIntegration {
  
  // 기존 payment_method 문자열을 payment_methods 테이블의 ID로 변환
  async resolvePaymentMethodId(paymentMethodString: string, userEmail?: string): Promise<string | null> {
    try {
      if (!paymentMethodString) return null

      // 먼저 정확한 매치를 찾기
      const { data: exactMatch, error: exactError } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('method', paymentMethodString)
        .eq('status', 'active')
        .maybeSingle()

      if (!exactError && exactMatch) {
        return exactMatch.id
      }

      // 부분 매치 찾기 (카드 번호 등)
      const { data: partialMatch, error: partialError } = await supabase
        .from('payment_methods')
        .select('id')
        .ilike('method', `%${paymentMethodString}%`)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (!partialError && partialMatch) {
        return partialMatch.id
      }

      // 사용자별 매치 찾기
      if (userEmail) {
        const { data: userMatch, error: userError } = await supabase
          .from('payment_methods')
          .select('id')
          .eq('user_email', userEmail)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()

        if (!userError && userMatch) {
          return userMatch.id
        }
      }

      return null
    } catch (error) {
      console.error('결제 방법 ID 해결 오류:', error)
      return null
    }
  }

  // payment_methods ID를 기존 문자열 형태로 변환
  async resolvePaymentMethodString(paymentMethodId: string): Promise<string | null> {
    try {
      if (!paymentMethodId) return null

      const { data, error } = await supabase
        .from('payment_methods')
        .select('method')
        .eq('id', paymentMethodId)
        .maybeSingle()

      if (error) {
        console.error('결제 방법 문자열 해결 오류:', error)
        return null
      }

      return data?.method || null
    } catch (error) {
      console.error('결제 방법 문자열 해결 오류:', error)
      return null
    }
  }

  // 결제 시 사용량 업데이트
  async updatePaymentUsage(paymentMethodId: string, amount: number): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('update_payment_method_usage', {
        p_method_id: paymentMethodId,
        p_amount: amount
      })

      if (error) throw error
      return true
    } catch (error) {
      console.error('결제 사용량 업데이트 오류:', error)
      return false
    }
  }

  // 결제 방법 옵션 목록 가져오기 (드롭다운용)
  // userEmail이 제공되면 해당 직원의 결제 방법만, 없으면 모든 활성 결제 방법 반환
  // 고객 결제 내역에서는 userEmail 없이 호출하여 모든 결제 방법(직원용 + 고객용) 표시
  async getPaymentMethodOptions(userEmail?: string, includeCustomerMethods: boolean = true): Promise<Array<{id: string, method: string, method_type: string, user_email: string | null}>> {
    try {
      let query = supabase
        .from('payment_methods')
        .select('id, method, method_type, user_email')
        .eq('status', 'active')
        .order('method')

      if (userEmail) {
        // 특정 직원의 결제 방법만 조회
        query = query.eq('user_email', userEmail)
      } else if (includeCustomerMethods) {
        // userEmail이 없으면 모든 활성 결제 방법 조회 (직원용 + 고객용)
        // user_email이 null인 것(고객용)과 모든 직원용 모두 포함
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('결제 방법 옵션 조회 오류:', error)
      return []
    }
  }

  // 결제 방법 검증 (한도 체크)
  async validatePaymentMethod(paymentMethodId: string, amount: number): Promise<{
    isValid: boolean
    reason?: string
    remainingLimit?: number
  }> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('limit_amount, monthly_limit, daily_limit, current_month_usage, current_day_usage, status')
        .eq('id', paymentMethodId)
        .maybeSingle()

      if (error || !data) {
        return { isValid: false, reason: '결제 방법을 찾을 수 없습니다.' }
      }

      if (data.status !== 'active') {
        return { isValid: false, reason: '비활성화된 결제 방법입니다.' }
      }

      // 총 한도 체크
      if (data.limit_amount && (data.current_month_usage + amount) > data.limit_amount) {
        return { 
          isValid: false, 
          reason: '총 한도를 초과합니다.',
          remainingLimit: data.limit_amount - data.current_month_usage
        }
      }

      // 월 한도 체크
      if (data.monthly_limit && (data.current_month_usage + amount) > data.monthly_limit) {
        return { 
          isValid: false, 
          reason: '월 한도를 초과합니다.',
          remainingLimit: data.monthly_limit - data.current_month_usage
        }
      }

      // 일 한도 체크
      if (data.daily_limit && (data.current_day_usage + amount) > data.daily_limit) {
        return { 
          isValid: false, 
          reason: '일 한도를 초과합니다.',
          remainingLimit: data.daily_limit - data.current_day_usage
        }
      }

      return { isValid: true }
    } catch (error) {
      console.error('결제 방법 검증 오류:', error)
      return { isValid: false, reason: '검증 중 오류가 발생했습니다.' }
    }
  }

  // 결제 방법 통계 가져오기
  async getPaymentMethodStats(paymentMethodId: string): Promise<{
    totalUsage: number
    monthlyUsage: number
    dailyUsage: number
    remainingLimit: number
    remainingMonthlyLimit: number
    remainingDailyLimit: number
  } | null> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('limit_amount, monthly_limit, daily_limit, current_month_usage, current_day_usage')
        .eq('id', paymentMethodId)
        .maybeSingle()

      if (error || !data) return null

      return {
        totalUsage: data.current_month_usage || 0,
        monthlyUsage: data.current_month_usage || 0,
        dailyUsage: data.current_day_usage || 0,
        remainingLimit: (data.limit_amount || 0) - (data.current_month_usage || 0),
        remainingMonthlyLimit: (data.monthly_limit || 0) - (data.current_month_usage || 0),
        remainingDailyLimit: (data.daily_limit || 0) - (data.current_day_usage || 0)
      }
    } catch (error) {
      console.error('결제 방법 통계 조회 오류:', error)
      return null
    }
  }

  // 기존 payment_method 컬럼을 새로운 시스템으로 마이그레이션
  async migrateExistingPaymentMethods(): Promise<{
    success: boolean
    message: string
    migrated: number
    errors: string[]
  }> {
    try {
      const errors: string[] = []
      let migrated = 0

      // payment_records 테이블에서 고유한 payment_method 값들 가져오기
      const { data: paymentRecords, error: recordsError } = await supabase
        .from('payment_records')
        .select('payment_method')
        .not('payment_method', 'is', null)

      if (recordsError) throw recordsError

      const uniqueMethods = [...new Set(paymentRecords?.map(record => record.payment_method) || [])]

      for (const method of uniqueMethods) {
        try {
          // 이미 존재하는지 확인
          const { data: existing } = await supabase
            .from('payment_methods')
            .select('id')
            .eq('method', method)
            .limit(1)
            .maybeSingle()

          if (existing) continue

          // 새 결제 방법 생성
          const id = `PAYM${Date.now().toString().slice(-6)}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`
          
          const { error: insertError } = await supabase
            .from('payment_methods')
            .insert({
              id,
              method,
              method_type: this.detectMethodType(method),
              user_email: 'system@migration.com', // 시스템 마이그레이션용
              status: 'active',
              notes: '기존 시스템에서 마이그레이션됨'
            })

          if (insertError) {
            errors.push(`${method}: ${insertError.message}`)
          } else {
            migrated++
          }
        } catch (error) {
          errors.push(`${method}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
        }
      }

      return {
        success: true,
        message: `${migrated}개의 결제 방법이 마이그레이션되었습니다.`,
        migrated,
        errors
      }
    } catch (error) {
      console.error('결제 방법 마이그레이션 오류:', error)
      return {
        success: false,
        message: `마이그레이션 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        migrated: 0,
        errors: []
      }
    }
  }

  // 결제 방법 유형 자동 감지
  private detectMethodType(method: string): string {
    const methodLower = method.toLowerCase()
    
    if (methodLower.includes('cc') || methodLower.includes('card') || /\d{4}/.test(method)) {
      return 'card'
    } else if (methodLower.includes('cash') || methodLower.includes('현금')) {
      return 'cash'
    } else if (methodLower.includes('transfer') || methodLower.includes('계좌') || methodLower.includes('이체')) {
      return 'transfer'
    } else if (methodLower.includes('mobile') || methodLower.includes('모바일')) {
      return 'mobile'
    } else {
      return 'other'
    }
  }
}

// 싱글톤 인스턴스
export const paymentMethodIntegration = new PaymentMethodIntegration()
