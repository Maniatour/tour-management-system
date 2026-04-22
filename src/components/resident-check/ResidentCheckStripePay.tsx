'use client'

import React, { useCallback, useState } from 'react'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'

const cardStyle = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': { color: '#aab7c4' },
    },
    invalid: { color: '#9e2146' },
  },
}

export default function ResidentCheckStripePay({
  token,
  customerName,
  customerEmail,
  isEnglish,
  onPaid,
}: {
  token: string
  customerName: string
  customerEmail: string
  isEnglish: boolean
  onPaid: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const t = (ko: string, en: string) => (isEnglish ? en : ko)

  const handlePay = useCallback(async () => {
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)
    const card = elements.getElement(CardElement)
    if (!card) {
      setError(t('카드 입력란을 불러올 수 없습니다.', 'Unable to load card field.'))
      setProcessing(false)
      return
    }

    try {
      const res = await fetch('/api/resident-check/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || t('결제 준비에 실패했습니다.', 'Could not prepare payment.'))
      }
      const clientSecret = data.clientSecret as string | undefined
      if (!clientSecret) {
        throw new Error(t('결제 정보를 받지 못했습니다.', 'Missing payment secret.'))
      }

      const { error: cErr, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: customerName || undefined,
            email: customerEmail || undefined,
          },
        },
      })

      if (cErr) {
        throw new Error(cErr.message || t('결제에 실패했습니다.', 'Payment failed.'))
      }
      if (paymentIntent?.status !== 'succeeded' || !paymentIntent.id) {
        throw new Error(t('결제가 완료되지 않았습니다.', 'Payment was not completed.'))
      }

      const conf = await fetch('/api/resident-check/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, paymentIntentId: paymentIntent.id }),
      })
      const confData = await conf.json().catch(() => ({}))
      if (!conf.ok) {
        throw new Error(confData.error || t('서버 확인에 실패했습니다.', 'Server confirmation failed.'))
      }

      onPaid()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('오류가 발생했습니다.', 'An error occurred.'))
    } finally {
      setProcessing(false)
    }
  }, [stripe, elements, token, customerName, customerEmail, onPaid, isEnglish])

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="rounded-md border border-slate-200 p-3">
        <CardElement options={cardStyle} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={!stripe || processing}
        onClick={() => void handlePay()}
        className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {processing
          ? t('처리 중…', 'Processing…')
          : t('카드로 결제하기', 'Pay with card')}
      </button>
    </div>
  )
}
