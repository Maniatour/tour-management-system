'use client'

import { useParams } from 'next/navigation'
import CustomerPageEditWorkbench from '@/components/product/CustomerPageEditWorkbench'

export default function AdminCustomerPagesPage() {
  const params = useParams()
  const locale = (params.locale as string) || 'ko'

  return (
    <div className="p-4 sm:p-6">
      <CustomerPageEditWorkbench locale={locale} variant="embedded" />
    </div>
  )
}
