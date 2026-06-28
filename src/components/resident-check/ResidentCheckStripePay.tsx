'use client'

import { useCallback, useState } from 'react'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useTranslations } from 'next-intl'

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
  onPaid,
}: {
  token: string
  customerName: string
  customerEmail: string
  onPaid: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const t = useTranslations('residentCheck')
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handlePay = useCallback(async () => {
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)
    const card = elements.getElement(CardElement)
    if (!card) {
      setError(t('stripeCardFieldError'))
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
        throw new Error(data.error || t('stripePrepareFailed'))
      }
      const clientSecret = data.clientSecret as string | undefined
      if (!clientSecret) {
        throw new Error(t('stripeMissingSecret'))
      }

      const { error: cErr, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            ...(customerName ? { name: customerName } : {}),
            ...(customerEmail ? { email: customerEmail } : {}),
          },
        },
      })

      if (cErr) {
        throw new Error(cErr.message || t('stripePaymentFailed'))
      }
      if (paymentIntent?.status !== 'succeeded' || !paymentIntent.id) {
        throw new Error(t('stripeNotCompleted'))
      }

      const conf = await fetch('/api/resident-check/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, paymentIntentId: paymentIntent.id }),
      })
      const confData = await conf.json().catch(() => ({}))
      if (!conf.ok) {
        throw new Error(confData.error || t('stripeConfirmFailed'))
      }

      onPaid()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('stripeGenericError'))
    } finally {
      setProcessing(false)
    }
  }, [stripe, elements, token, customerName, customerEmail, onPaid, t])

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
        {processing ? t('stripeProcessing') : t('stripePayButton')}
      </button>
    </div>
  )
}
