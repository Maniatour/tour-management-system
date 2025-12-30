import { NextResponse } from 'next/server'

// 실시간 환율 API (ExchangeRate-API 사용)
// 무료 플랜: 월 1,500회 요청 가능
const EXCHANGE_RATE_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD'

export async function GET() {
  try {
    const response = await fetch(EXCHANGE_RATE_API_URL, {
      next: { revalidate: 3600 } // 1시간마다 캐시 갱신
    })

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rate')
    }

    const data = await response.json()
    const baseRate = data.rates?.KRW

    if (!baseRate) {
      throw new Error('KRW rate not found')
    }

    // 기준 환율에 1% 추가 (송금보낼때 환율)
    const transferRate = baseRate * 1.01

    return NextResponse.json({ 
      baseRate: baseRate, // 기준 환율
      rate: transferRate, // 송금보낼때 환율 (기준 환율 + 1%)
      base: 'USD',
      timestamp: data.date || new Date().toISOString()
    })
  } catch (error) {
    console.error('환율 조회 오류:', error)
    
    // 오류 발생 시 기본값 반환
    const defaultBaseRate = 1300
    return NextResponse.json({ 
      baseRate: defaultBaseRate, // 기준 환율
      rate: defaultBaseRate * 1.01, // 송금보낼때 환율 (기준 환율 + 1%)
      base: 'USD',
      timestamp: new Date().toISOString(),
      error: 'Failed to fetch real-time rate, using default'
    }, { status: 200 }) // 오류여도 기본값으로 응답
  }
}

