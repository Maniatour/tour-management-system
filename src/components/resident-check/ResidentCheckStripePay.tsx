'use client'

import { useCallback, useState } from 'react'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

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
    <div className="space-y-4">
      <div className="rounded-xl border border-input bg-background p-4">
        <CardElement options={cardStyle} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button
        type="button"
        variant="booking"
        size="booking"
        disabled={!stripe || processing}
        onClick={() => void handlePay()}
        className="w-full"
      >
        {processing ? t('stripeProcessing') : t('stripePayButton')}
      </Button>
    </div>
  )
}
