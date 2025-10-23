'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import CompanyExpenseManager from '@/components/CompanyExpenseManager'

export default function CompanyExpensesPage() {
  const t = useTranslations('companyExpense')

  return (
    <div className="container mx-auto py-6">
      <CompanyExpenseManager />
    </div>
  )
}
