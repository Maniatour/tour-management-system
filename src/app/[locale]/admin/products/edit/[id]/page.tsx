'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import AdminProductCustomerEditView from '@/components/admin/AdminProductCustomerEditView'

export default function AdminProductCustomerEditPage() {
  const params = useParams()
  const locale = (params.locale as string) || 'ko'
  const productId = params.id as string
  const t = useTranslations('products.customerPageEdit')

  if (!productId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t('missingProductId')}
      </div>
    )
  }

  return <AdminProductCustomerEditView locale={locale} productId={productId} />
}
