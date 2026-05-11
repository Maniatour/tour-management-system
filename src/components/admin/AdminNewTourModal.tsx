'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import { generateTourId } from '@/lib/entityIds'
import { createTourPhotosBucket } from '@/lib/tourPhotoBucket'

export type AdminNewTourModalProduct = {
  id: string
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  status?: string | null
}

function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type AdminNewTourModalProps = {
  isOpen: boolean
  onClose: () => void
  products: AdminNewTourModalProduct[]
  productsLoading: boolean
}

export function AdminNewTourModal({ isOpen, onClose, products, productsLoading }: AdminNewTourModalProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('tours.newTourPage')
  const supabase = useMemo(() => createClientSupabase(), [])

  const [productId, setProductId] = useState('')
  const [tourDate, setTourDate] = useState(todayYmd)
  const [isPrivateTour, setIsPrivateTour] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setProductId('')
    setTourDate(todayYmd())
    setIsPrivateTour(false)
    setSubmitting(false)
  }, [isOpen])

  const productLabel = useCallback((p: AdminNewTourModalProduct) => {
    const base = (p.name || p.name_ko || p.name_en || p.id).trim()
    return base || p.id
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId.trim() || !tourDate.trim()) return
    setSubmitting(true)
    try {
      const id = generateTourId()
      const { data: newTour, error } = await supabase
        .from('tours')
        .insert({
          id,
          product_id: productId.trim(),
          tour_date: tourDate.trim(),
          reservation_ids: [],
          tour_status: 'scheduled',
          is_private_tour: isPrivateTour,
        })
        .select('id')
        .single()

      if (error) {
        console.error('AdminNewTourModal: insert', error)
        alert(`${t('errorPrefix')}: ${error.message}`)
        return
      }

      try {
        await createTourPhotosBucket()
      } catch {
        /* optional */
      }

      alert(t('successAlert'))
      onClose()
      const nextId = newTour?.id || id
      router.push(`/${locale}/admin/tours/${nextId}`)
    } catch (err) {
      console.error('AdminNewTourModal: submit', err)
      alert(t('errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50"
      onClick={() => {
        if (!submitting) onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-new-tour-modal-title"
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div>
            <h2 id="admin-new-tour-modal-title" className="text-lg font-semibold text-gray-900">
              {t('title')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{t('description')}</p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-50"
            aria-label={t('closeModal')}
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="admin-new-tour-product" className="block text-sm font-medium text-gray-700">
              {t('product')}
            </label>
            <select
              id="admin-new-tour-product"
              required
              value={productId}
              onChange={(ev) => setProductId(ev.target.value)}
              disabled={productsLoading || submitting}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">{t('productPlaceholder')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {productLabel(p)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="admin-new-tour-date" className="block text-sm font-medium text-gray-700">
              {t('tourDate')}
            </label>
            <input
              id="admin-new-tour-date"
              type="date"
              required
              value={tourDate}
              onChange={(ev) => setTourDate(ev.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPrivateTour}
              onChange={(ev) => setIsPrivateTour(ev.target.checked)}
              disabled={submitting}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {t('privateTour')}
          </label>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t('closeModal')}
            </button>
            <button
              type="submit"
              disabled={submitting || productsLoading || !productId}
              className="w-full sm:w-auto rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t('submitting') : t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
