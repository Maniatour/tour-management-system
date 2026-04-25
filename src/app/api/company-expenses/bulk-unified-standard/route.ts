import { NextResponse } from 'next/server'

/** UI에서 제거됨. 회사 지출 «결제 내용 정규화»를 사용하세요. */
export async function GET() {
  return NextResponse.json({ error: 'This endpoint has been removed.' }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ error: 'This endpoint has been removed.' }, { status: 410 })
}
