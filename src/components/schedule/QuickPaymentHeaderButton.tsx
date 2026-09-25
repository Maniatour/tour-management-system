'use client'

import { useEffect, useState, type MutableRefObject } from 'react'
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
  registerOpen?: MutableRefObject<(() => void) | null>
}

export default function QuickPaymentHeaderButton({
  locale,
  className,
  registerOpen,
}: QuickPaymentHeaderButtonProps) {
  const [open, setOpen] = useState(false)
  const isKo = locale.startsWith('ko')

  useEffect(() => {
    if (!registerOpen) return
    registerOpen.current = () => setOpen(true)
    return () => {
      registerOpen.current = null
    }
  }, [registerOpen])

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
