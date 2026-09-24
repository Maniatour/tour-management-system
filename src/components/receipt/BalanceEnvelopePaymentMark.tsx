'use client'

import QRCode from 'react-qr-code'
import { CHOICE_CARD_PROCESSING_FEE_RATE } from '@/lib/choiceProcessingFee'

/** balance-envelope-image.png (1087×1949) 안 회사 로고 영역 */
const IMAGE_WIDTH_PX = 1087
const IMAGE_HEIGHT_PX = 1949
const LOGO_LEFT_PX = 103
const LOGO_TOP_PX = 1607
const LOGO_WIDTH_PX = 245
const LOGO_HEIGHT_PX = 233

const LOGO_SRC = '/balance-envelope-logo.png'

type BalanceEnvelopePaymentMarkProps = {
  envelopeWidthMm: number
  envelopeHeightMm: number
  /** 배경 이미지를 인쇄할 때 기존 로고를 가립니다. */
  coverPrintedLogo: boolean
  payUrl: string | null
  /** 읽기 방향에서 QR 왼쪽에 두는 카드 금액 */
  cardAmounts: {
    balance: string
    fee: string
    total: string
  } | null
}

function mmX(px: number, envelopeWidthMm: number): number {
  return (px / IMAGE_WIDTH_PX) * envelopeWidthMm
}

function mmY(px: number, envelopeHeightMm: number): number {
  return (px / IMAGE_HEIGHT_PX) * envelopeHeightMm
}

/** 잔금 봉투의 카드 QR(읽기 방향 우하단)과 회사 로고(읽기 방향 우상단). */
export default function BalanceEnvelopePaymentMark({
  envelopeWidthMm,
  envelopeHeightMm,
  coverPrintedLogo,
  payUrl,
  cardAmounts,
}: BalanceEnvelopePaymentMarkProps) {
  const leftMm = mmX(LOGO_LEFT_PX, envelopeWidthMm)
  const topMm = mmY(LOGO_TOP_PX, envelopeHeightMm)
  const widthMm = mmX(LOGO_WIDTH_PX, envelopeWidthMm)
  const heightMm = mmY(LOGO_HEIGHT_PX, envelopeHeightMm)
  const movedLeftMm = mmX(IMAGE_WIDTH_PX - LOGO_LEFT_PX - LOGO_WIDTH_PX, envelopeWidthMm)
  const qrPadMm = 1.4
  const qrSizeMm = Math.max(8, Math.min(widthMm, heightMm) - qrPadMm * 2)
  const feePercent = Math.round(CHOICE_CARD_PROCESSING_FEE_RATE * 100)
  /** 글줄 끝이 QR 바로 앞에서 멈추도록, 회전 전 가로 길이를 QR 위에 둔다. */
  const amountReachMm = 56
  const amountGapMm = 1.6
  const amountTopMm = Math.max(2, topMm + qrPadMm - amountGapMm - amountReachMm)
  const cssPxToMm = 25.4 / 96
  const amountBlockMm = 12 * 1.2 * cssPxToMm * 2 + 13 * 1.2 * cssPxToMm
  /** 읽기 방향에서 마지막 줄(CC Fee) 바닥이 QR 바닥과 같게 둔다. */
  const amountLeftMm = leftMm + qrPadMm + amountBlockMm

  return (
    <>
      {coverPrintedLogo ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${leftMm}mm`,
            top: `${topMm}mm`,
            width: `${widthMm}mm`,
            height: `${heightMm}mm`,
            background: '#fff',
            zIndex: 2,
          }}
        />
      ) : null}
      <img
        src={LOGO_SRC}
        alt=""
        decoding="sync"
        style={{
          position: 'absolute',
          left: `${movedLeftMm}mm`,
          top: `${topMm}mm`,
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
          objectFit: 'contain',
          zIndex: 3,
        }}
      />
      {payUrl ? (
        <div
          style={{
            position: 'absolute',
            left: `${leftMm + qrPadMm}mm`,
            top: `${topMm + qrPadMm}mm`,
            width: `${qrSizeMm}mm`,
            height: `${qrSizeMm}mm`,
            background: '#fff',
            zIndex: 4,
          }}
        >
          <QRCode
            value={payUrl}
            size={256}
            bgColor="#FFFFFF"
            fgColor="#111111"
            level="M"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      ) : null}
      {payUrl && cardAmounts ? (
        <div
          style={{
            position: 'absolute',
            left: `${amountLeftMm}mm`,
            top: `${amountTopMm}mm`,
            width: `${amountReachMm}mm`,
            transform: 'rotate(90deg)',
            transformOrigin: 'left top',
            zIndex: 4,
            textAlign: 'right',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '12px',
            lineHeight: 1.2,
            color: '#111111',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '13px' }}>Pay with Card {cardAmounts.total}</div>
          <div style={{ fontWeight: 600 }}>Balance : {cardAmounts.balance}</div>
          <div style={{ fontWeight: 600 }}>CC Fee ({feePercent}%) : {cardAmounts.fee}</div>
        </div>
      ) : null}
    </>
  )
}
