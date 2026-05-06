'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { useAdminNavAccessFlags } from '@/hooks/useAdminNavAccessFlags'
import SiteAccessTreePanel from '@/components/admin/SiteAccessTreePanel'
import type { AdminNavAccessContext } from '@/lib/admin-site-registry'
import { ROLE_PERMISSIONS, type UserPermissions, type UserRole } from '@/lib/roles'

type TabId = 'structure' | 'access'

const MATRIX_ROLES: UserRole[] = ['customer', 'team_member', 'manager', 'admin']

const PERMISSION_ORDER: (keyof UserPermissions)[] = [
  'canViewAdmin',
  'canManageProducts',
  'canManageCustomers',
  'canManageReservations',
  'canManageTours',
  'canManageTeam',
  'canViewSchedule',
  'canManageBookings',
  'canViewAuditLogs',
  'canManageChannels',
  'canManageOptions',
  'canViewFinance',
]

export default function AdminSiteDirectoryPage() {
  const t = useTranslations('siteDirectory')
  const { authUser, userRole, userPosition, isSimulating } = useAuth()
  const { isSuper, canAccessReservationStatistics } = useAdminNavAccessFlags()
  const [tab, setTab] = useState<TabId>('structure')

  const navCtx: AdminNavAccessContext = useMemo(
    () => ({
      userRole: (userRole as UserRole | null) ?? null,
      isSuper,
      canAccessReservationStatistics,
      isSimulating: Boolean(isSimulating),
      authUserEmail: authUser?.email,
      userPosition,
    }),
    [userRole, isSuper, canAccessReservationStatistics, isSimulating, authUser?.email, userPosition]
  )

  return (
    <div className="w-full min-w-0 space-y-6 px-2 pb-24 pt-4 sm:px-4 md:px-5 lg:px-6 lg:pt-6 xl:px-8">
      <div className="w-full min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
        <p className="mt-2 w-full min-w-0 text-sm text-gray-600 sm:text-base">{t('intro')}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('structure')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'structure'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('tabStructure')}
        </button>
        <button
          type="button"
          onClick={() => setTab('access')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'access'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('tabAccess')}
        </button>
      </div>

      {tab === 'structure' && (
        <div className="space-y-4">
          <SiteAccessTreePanel navCtx={navCtx} />
          <p className="text-xs text-gray-500">{t('structureFootnote')}</p>
        </div>
      )}

      {tab === 'access' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('roleMatrixCaption')}</p>
          <p className="text-xs text-gray-600">{t('accessTabCrudNote')}</p>
          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-700">
                    {t('permissionKeyColumn')}
                  </th>
                  {MATRIX_ROLES.map((role) => (
                    <th key={role} className="px-2 py-2 text-center font-medium text-gray-700">
                      {t(`role_${role}` as Parameters<typeof t>[0])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PERMISSION_ORDER.map((perm) => (
                  <tr key={perm}>
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-gray-800">
                      {t(`permission_${perm}` as Parameters<typeof t>[0])}
                      <div className="font-mono text-[10px] text-gray-400">{perm}</div>
                    </td>
                    {MATRIX_ROLES.map((role) => (
                      <td key={role} className="px-2 py-2 text-center text-gray-800">
                        {ROLE_PERMISSIONS[role][perm] ? '✓' : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">{t('footnoteRls')}</p>
        </div>
      )}
    </div>
  )
}
