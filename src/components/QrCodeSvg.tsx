'use client'

import QRCode from 'react-qr-code'

type QrCodeSvgProps = {
  value: string
  label: string
  missingLabel: string
  size?: number
}

export default function QrCodeSvg({
  value,
  label,
  missingLabel,
  size = 280,
}: QrCodeSvgProps) {
  const payload = value.trim()

  if (!payload) {
    return (
      <div
        className="flex h-[240px] w-[240px] items-center justify-center rounded-xl bg-muted px-4 text-center text-sm leading-5 text-muted-foreground sm:h-[280px] sm:w-[280px]"
        role="status"
      >
        {missingLabel}
      </div>
    )
  }

  return (
    <div
      className="flex h-[240px] w-[240px] items-center justify-center rounded-xl bg-white p-3 sm:h-[280px] sm:w-[280px]"
      role="img"
      aria-label={label}
    >
      <QRCode
        value={payload}
        size={size}
        bgColor="#FFFFFF"
        fgColor="#111111"
        level="M"
        title={label}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  )
}
