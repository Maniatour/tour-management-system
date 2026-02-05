'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Calendar, BookOpen, MapPin, MessageCircle } from 'lucide-react'

interface MobileFooterProps {
  locale: string
}

export default function MobileFooter({ locale }: MobileFooterProps) {
  const pathname = usePathname()

  const footerItems = [
    {
      name: '홈',
      href: `/${locale}/admin`,
      icon: Home,
      adminOnly: true
    },
    {
      name: '고객',
      href: `/${locale}/admin/customers`,
      icon: Users,
      adminOnly: true
    },
    {
      name: '예약',
      href: `/${locale}/admin/reservations`,
      icon: Calendar,
      adminOnly: true
    },
    {
      name: '부킹',
      href: `/${locale}/admin/booking`,
      icon: BookOpen,
      adminOnly: true
    },
    {
      name: '투어',
      href: `/${locale}/admin/tours`,
      icon: MapPin,
      adminOnly: true
    },
    {
      name: '채팅',
      href: `/${locale}/admin/chat-management`,
      icon: MessageCircle,
      adminOnly: true
    }
  ]

  const isActive = (href: string) => {
    return pathname === href
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50" style={{ height: 'var(--footer-height)' }}>
      <div className="grid grid-cols-6 h-full">
        {footerItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center space-y-1 px-2 py-2 transition-colors ${
                active
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon 
                size={20} 
                className={`${active ? 'text-blue-600' : 'text-gray-500'}`}
              />
              <span className={`text-xs font-medium ${
                active ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
