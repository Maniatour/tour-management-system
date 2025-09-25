import { NextRequest, NextResponse } from 'next/server'
import { createClientSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const channelId = searchParams.get('channelId')
    const channelType = searchParams.get('channelType')

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      )
    }

    const supabase = createClientSupabase()

    // 1. 채널별 최근 가격 조회
    let query = supabase
      .from('dynamic_pricing')
      .select(`
        id,
        channel_id,
        adult_price,
        child_price,
        infant_price,
        options_pricing,
        commission_percent,
        markup_amount,
        coupon_percent,
        is_sale_available,
        created_at,
        updated_at,
        channels!inner(
          id,
          name,
          type
        )
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (channelId) {
      query = query.eq('channel_id', channelId)
    }

    const { data: pricingData, error: pricingError } = await query

    if (pricingError) {
      console.error('Error fetching pricing data:', pricingError)
      return NextResponse.json(
        { error: 'Failed to fetch pricing data' },
        { status: 500 }
      )
    }

    // 2. 채널 타입별로 그룹화
    const channelPricingMap = new Map()
    
    pricingData?.forEach(item => {
      const channelType = item.channels?.type || 'Unknown'
      if (!channelPricingMap.has(channelType)) {
        channelPricingMap.set(channelType, [])
      }
      channelPricingMap.get(channelType).push(item)
    })

    // 3. 각 채널의 최근 가격 찾기
    const result = {
      byChannel: {} as Record<string, any>,
      byType: {} as Record<string, any>
    }

    // 채널별 최근 가격
    pricingData?.forEach(item => {
      const channelId = item.channel_id
      const channelName = item.channels?.name || 'Unknown'
      
      if (!result.byChannel[channelId]) {
        result.byChannel[channelId] = {
          channelId,
          channelName,
          channelType: item.channels?.type || 'Unknown',
          latestPricing: item,
          allPricing: []
        }
      }
      result.byChannel[channelId].allPricing.push(item)
    })

    // 채널 타입별 최근 가격
    channelPricingMap.forEach((pricingList, type) => {
      if (pricingList.length > 0) {
        // 가장 최근 가격
        const latestPricing = pricingList[0]
        result.byType[type] = {
          channelType: type,
          latestPricing,
          allPricing: pricingList
        }
      }
    })

    // 4. 특정 채널에 가격이 없을 때 같은 타입의 채널에서 기본값 찾기
    if (channelId && !result.byChannel[channelId]) {
      const { data: channelData } = await supabase
        .from('channels')
        .select('type')
        .eq('id', channelId)
        .single()

      if (channelData?.type && result.byType[channelData.type]) {
        result.byChannel[channelId] = {
          channelId,
          channelName: 'Unknown',
          channelType: channelData.type,
          latestPricing: result.byType[channelData.type].latestPricing,
          allPricing: [],
          fallbackFrom: result.byType[channelData.type].latestPricing.channel_id
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error in pricing history API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
