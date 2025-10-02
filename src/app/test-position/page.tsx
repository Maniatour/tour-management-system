'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function TestPositionPage() {
  const { authUser } = useAuth()
  const [userInfo, setUserInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkUserPosition = async () => {
    if (!authUser?.email) {
      setError('로그인이 필요합니다.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 사용자 정보 조회
      const { data: teamData, error: teamError } = await supabase
        .from('team')
        .select('email, name_ko, position, is_active')
        .eq('email', authUser.email)
        .single()

      if (teamError) {
        throw new Error(`팀 정보 조회 오류: ${teamError.message}`)
      }

      if (!teamData) {
        throw new Error('팀 정보를 찾을 수 없습니다.')
      }

      setUserInfo(teamData)

      // tour_materials 테이블 접근 테스트
      const { data: materialsData, error: materialsError } = await supabase
        .from('tour_materials')
        .select('id, title')
        .limit(1)

      if (materialsError) {
        throw new Error(`투어 자료 접근 오류: ${materialsError.message}`)
      }

      console.log('투어 자료 접근 성공:', materialsData)

    } catch (err) {
      console.error('오류:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const testUpload = async () => {
    if (!authUser?.email) {
      setError('로그인이 필요합니다.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 테스트 데이터 업로드
      const { data, error } = await supabase
        .from('tour_materials')
        .insert({
          title: '테스트 자료',
          description: 'RLS 정책 테스트용',
          file_name: 'test.txt',
          file_path: '/test/test.txt',
          file_size: 100,
          file_type: 'script',
          mime_type: 'text/plain',
          language: 'ko',
          is_active: true,
          is_public: true
        })
        .select()

      if (error) {
        throw new Error(`업로드 오류: ${error.message}`)
      }

      console.log('업로드 성공:', data)
      alert('업로드가 성공했습니다!')

    } catch (err) {
      console.error('업로드 오류:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authUser?.email) {
      checkUserPosition()
    }
  }, [authUser])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Position 및 RLS 정책 테스트</h1>
      
      {authUser ? (
        <div className="space-y-4">
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="font-semibold mb-2">현재 사용자 정보</h2>
            <p><strong>이메일:</strong> {authUser.email}</p>
            {userInfo && (
              <>
                <p><strong>이름:</strong> {userInfo.name_ko}</p>
                <p><strong>Position:</strong> {userInfo.position}</p>
                <p><strong>활성 상태:</strong> {userInfo.is_active ? '활성' : '비활성'}</p>
                <p><strong>관리자 접근 권한:</strong> {
                  userInfo.position?.toLowerCase() === 'super' || 
                  userInfo.position?.toLowerCase() === 'office manager' 
                    ? '✅ 있음' 
                    : '❌ 없음'
                }</p>
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>오류:</strong> {error}
            </div>
          )}

          <div className="space-x-4">
            <button
              onClick={checkUserPosition}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? '확인 중...' : '사용자 정보 다시 확인'}
            </button>
            
            <button
              onClick={testUpload}
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? '테스트 중...' : '투어 자료 업로드 테스트'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          로그인이 필요합니다.
        </div>
      )}
    </div>
  )
}
