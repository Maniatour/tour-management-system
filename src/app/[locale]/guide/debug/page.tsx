'use client'

import { useAuth } from '@/contexts/AuthContext'
import { createClientSupabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'

export default function GuideDebugPage() {
  const { user, userRole, isLoading, permissions } = useAuth()
  const [teamData, setTeamData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkTeamData = async () => {
      if (!user?.email) {
        setLoading(false)
        return
      }

      try {
        const supabase = createClientSupabase()
        const { data, error } = await supabase
          .from('team')
          .select('*')
          .eq('email', user.email)
          .single()

        if (error) {
          console.error('Team data error:', error)
        } else {
          setTeamData(data)
        }
      } catch (err) {
        console.error('Error fetching team data:', err)
      } finally {
        setLoading(false)
      }
    }

    checkTeamData()
  }, [user?.email])

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">투어 가이드 디버그 페이지</h1>
      
      <div className="space-y-6">
        {/* 인증 상태 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">인증 상태</h2>
          <div className="space-y-2">
            <p><strong>로딩 중:</strong> {isLoading ? '예' : '아니오'}</p>
            <p><strong>사용자:</strong> {user ? user.email : '없음'}</p>
            <p><strong>사용자 역할:</strong> {userRole || '없음'}</p>
            <p><strong>권한:</strong> {permissions ? JSON.stringify(permissions, null, 2) : '없음'}</p>
          </div>
        </div>

        {/* 팀 데이터 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">팀 데이터</h2>
          {loading ? (
            <p>로딩 중...</p>
          ) : teamData ? (
            <div className="space-y-2">
              <p><strong>이메일:</strong> {teamData.email}</p>
              <p><strong>이름:</strong> {teamData.name_ko}</p>
              <p><strong>포지션:</strong> {teamData.position}</p>
              <p><strong>활성 상태:</strong> {teamData.is_active ? '활성' : '비활성'}</p>
              <p><strong>상태:</strong> {teamData.status}</p>
            </div>
          ) : (
            <p>팀 데이터를 찾을 수 없습니다.</p>
          )}
        </div>

        {/* 접근 가능한 계정들 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">테스트용 계정</h2>
          <div className="space-y-2 text-sm">
            <p><strong>관리자:</strong> admin@maniatour.com (position: super)</p>
            <p><strong>매니저:</strong> manager@maniatour.com (position: office manager)</p>
            <p><strong>투어 가이드:</strong> guide@maniatour.com (position: tour guide)</p>
            <p><strong>운영자:</strong> op@maniatour.com (position: op)</p>
            <p><strong>운전기사:</strong> driver@maniatour.com (position: driver)</p>
          </div>
        </div>

        {/* 권한 확인 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">권한 확인</h2>
          <div className="space-y-2">
            <p><strong>guide 페이지 접근 가능:</strong> {['admin', 'manager', 'team_member'].includes(userRole || '') ? '예' : '아니오'}</p>
            <p><strong>현재 사용자 역할:</strong> {userRole}</p>
            <p><strong>필요한 역할:</strong> admin, manager, team_member 중 하나</p>
            <p><strong>AuthContext 리다이렉트 경로:</strong> {userRole === 'admin' || userRole === 'manager' ? '/ko/admin' : userRole === 'team_member' ? '/ko/guide' : '/ko/auth'}</p>
          </div>
        </div>

        {/* 현재 URL 정보 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">현재 URL 정보</h2>
          <div className="space-y-2">
            <p><strong>현재 경로:</strong> {typeof window !== 'undefined' ? window.location.pathname : 'N/A'}</p>
            <p><strong>현재 URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
