'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Send } from 'lucide-react'

const QuickPaymentRequestModal = dynamic(
  () =>
    import('@/components/customer/QuickPaymentRequestForm').then((m) => m.QuickPaymentRequestModal),
  { ssr: false, loading: () => null }
)

type QuickPaymentHeaderButtonProps = {
  locale: string
  className?: string
}

export default function QuickPaymentHeaderButton({
  locale,
  className,
}: QuickPaymentHeaderButtonProps) {
  const [open, setOpen] = useState(false)
  const isKo = locale.startsWith('ko')

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        title={isKo ? '빠른 금액 청구' : 'Quick Payment'}
        aria-label={isKo ? '빠른 금액 청구' : 'Quick Payment'}
      >
        <Send size={16} aria-hidden />
      </button>
      {open ? (
        <QuickPaymentRequestModal
          open={open}
          onClose={() => setOpen(false)}
          locale={isKo ? 'ko' : 'en'}
        />
      ) : null}
    </>
  )
}
