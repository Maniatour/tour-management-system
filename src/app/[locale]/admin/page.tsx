'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { 
  Package, 
  Users, 
  Calendar, 
  Map,
  Settings,
  BookOpen,
  UserCheck,
  FileText,
  Globe,
  Car,
  Gift,
  BarChart3,
  Shield,
  Clock
} from 'lucide-react'
import Link from 'next/link'

interface AdminDashboardProps {
  params: Promise<{ locale: string }>
}

export default function AdminDashboard({ params }: AdminDashboardProps) {
  const paramsObj = useParams()
  const locale = paramsObj.locale as string
  const t = useTranslations('admin')

  const mobileMenuItems = [
    {
      name: t('products'),
      href: `/${locale}/admin/products`,
      icon: Package,
      color: 'bg-blue-500'
    },
    {
      name: t('customers'),
      href: `/${locale}/admin/customers`,
      icon: Users,
      color: 'bg-green-500'
    },
    {
      name: t('reservations'),
      href: `/${locale}/admin/reservations`,
      icon: Calendar,
      color: 'bg-purple-500'
    },
    {
      name: t('booking'),
      href: `/${locale}/admin/booking`,
      icon: BookOpen,
      color: 'bg-orange-500'
    },
    {
      name: t('tours'),
      href: `/${locale}/admin/tours`,
      icon: Map,
      color: 'bg-red-500'
    },
    {
      name: t('team'),
      href: `/${locale}/admin/team`,
      icon: UserCheck,
      color: 'bg-indigo-500'
    },
    {
      name: t('options'),
      href: `/${locale}/admin/options`,
      icon: Settings,
      color: 'bg-gray-500'
    },
    {
      name: t('channels'),
      href: `/${locale}/admin/channels`,
      icon: Globe,
      color: 'bg-cyan-500'
    },
    {
      name: t('vehicles'),
      href: `/${locale}/admin/vehicles`,
      icon: Car,
      color: 'bg-yellow-500'
    },
    {
      name: t('coupons'),
      href: `/${locale}/admin/coupons`,
      icon: Gift,
      color: 'bg-pink-500'
    },
    {
      name: t('dataReview'),
      href: `/${locale}/admin/data-review`,
      icon: BarChart3,
      color: 'bg-teal-500'
    },
    {
      name: t('auditLogs'),
      href: `/${locale}/admin/audit-logs`,
      icon: Shield,
      color: 'bg-slate-500'
    },
    {
      name: t('attendance'),
      href: `/${locale}/admin/attendance`,
      icon: Clock,
      color: 'bg-emerald-500'
    },
    {
      name: t('offSchedule'),
      href: `/${locale}/admin/off-schedule`,
      icon: FileText,
      color: 'bg-violet-500'
    },
    {
      name: t('pickupHotels'),
      href: `/${locale}/admin/pickup-hotels`,
      icon: Map,
      color: 'bg-amber-500'
    },
    {
      name: t('tourReports'),
      href: `/${locale}/admin/tour-reports`,
      icon: FileText,
      color: 'bg-rose-500'
    }
  ]

  return (
    <div className="bg-gray-50">
      {/* 모바일 앱 스타일 그리드 */}
      <div className="px-2 pt-2 pb-4">
        <div className="grid grid-cols-4 gap-3">
          {mobileMenuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center p-3 transition-all duration-200 active:scale-95"
              >
                <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mb-2`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight whitespace-nowrap">
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
