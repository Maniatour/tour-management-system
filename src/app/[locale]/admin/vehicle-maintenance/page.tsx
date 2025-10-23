'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import VehicleMaintenanceManager from '@/components/VehicleMaintenanceManager'

export default function VehicleMaintenancePage() {
  const t = useTranslations('vehicleMaintenance')

  return (
    <div className="container mx-auto py-6">
      <VehicleMaintenanceManager />
    </div>
  )
}
