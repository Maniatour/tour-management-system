'use client'

import { AdminTodoProvider } from '@/contexts/AdminTodoContext'
import AdminTodoFloatingWidget, { AdminTodoActionHost } from '@/components/admin/todo/AdminTodoFloatingWidget'
import { AdminOpTodoNotificationLayer } from '@/components/admin/todo/AdminOpTodoNotificationLayer'

type AdminTodoRootProps = {
  locale: string
}

export default function AdminTodoRoot({ locale }: AdminTodoRootProps) {
  return (
    <AdminTodoProvider>
      <AdminOpTodoNotificationLayer />
      <AdminTodoFloatingWidget locale={locale} />
      <AdminTodoActionHost locale={locale} />
    </AdminTodoProvider>
  )
}
