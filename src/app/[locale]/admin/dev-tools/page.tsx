'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClientSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, Users, Settings, Code, Monitor } from 'lucide-react'

interface TeamMember {
  email: string
  name_ko: string
  position: string
  is_active: boolean
}

interface PositionViewerProps {
  position: string
  userRole: string
  onSwitchPosition: (position: string) => void
}

function PositionViewer({ position, userRole, onSwitchPosition }: PositionViewerProps) {
  const getPositionInfo = (pos: string) => {
    switch (pos.toLowerCase()) {
      case 'super':
        return {
          title: 'Super Admin',
          description: '최고 관리자 - 모든 권한',
          color: 'bg-red-100 text-red-800',
          icon: Settings,
          pages: ['모든 어드민 페이지', '시스템 설정', '사용자 관리']
        }
      case 'office manager':
        return {
          title: 'Office Manager',
          description: '사무실 매니저 - 관리자 권한',
          color: 'bg-blue-100 text-blue-800',
          icon: Users,
          pages: ['어드민 페이지', '팀 관리', '투어 관리', '예약 관리']
        }
      case 'tour guide':
        return {
          title: 'Tour Guide',
          description: '투어 가이드 - 제한된 권한',
          color: 'bg-green-100 text-green-800',
          icon: Eye,
          pages: ['투어 가이드 페이지', '배정된 투어만', '고객 정보 읽기 전용']
        }
      case 'op':
        return {
          title: 'Operator',
          description: '운영자 - 중간 권한',
          color: 'bg-yellow-100 text-yellow-800',
          icon: Monitor,
          pages: ['운영 관련 페이지', '예약 처리', '투어 관리']
        }
      case 'driver':
        return {
          title: 'Driver',
          description: '운전기사 - 제한된 권한',
          color: 'bg-purple-100 text-purple-800',
          icon: Users,
          pages: ['운전 관련 페이지', '투어 일정', '차량 정보']
        }
      default:
        return {
          title: 'Unknown Position',
          description: '알 수 없는 역할',
          color: 'bg-gray-100 text-gray-800',
          icon: Code,
          pages: ['권한 없음']
        }
    }
  }

  const info = getPositionInfo(position)
  const IconComponent = info.icon

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <IconComponent className="w-6 h-6" />
            <div>
              <CardTitle className="text-lg">{info.title}</CardTitle>
              <CardDescription>{info.description}</CardDescription>
            </div>
          </div>
          <Badge className={info.color}>{position}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">접근 가능한 페이지:</h4>
            <ul className="space-y-1">
              {info.pages.map((page, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  {page}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="flex space-x-2">
            <Button
              onClick={() => onSwitchPosition(position)}
              variant="outline"
              size="sm"
            >
              이 역할로 보기
            </Button>
            <Button
              onClick={() => window.open(`/ko/guide`, '_blank')}
              variant="outline"
              size="sm"
            >
              투어 가이드 페이지 열기
            </Button>
            <Button
              onClick={() => window.open(`/ko/admin/dev-tools/position-simulator`, '_blank')}
              variant="outline"
              size="sm"
            >
              고급 시뮬레이터
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DevToolsPage() {
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPosition, setSelectedPosition] = useState<string>('')
  const [simulatedRole, setSimulatedRole] = useState<string>('')

  useEffect(() => {
    const loadTeamMembers = async () => {
      try {
        const supabase = createClientSupabase()
        const { data, error } = await supabase
          .from('team')
          .select('email, name_ko, position, is_active')
          .eq('is_active', true)
          .order('position')

        if (error) {
          console.error('Error loading team members:', error)
          return
        }

        setTeamMembers(data || [])
      } catch (err) {
        console.error('Error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTeamMembers()
  }, [])

  const handleSwitchPosition = (position: string) => {
    setSelectedPosition(position)
    
    // position에 따른 역할 매핑
    let role = 'customer'
    switch (position.toLowerCase()) {
      case 'super':
        role = 'admin'
        break
      case 'office manager':
        role = 'manager'
        break
      case 'tour guide':
      case 'op':
      case 'driver':
        role = 'team_member'
        break
    }
    
    setSimulatedRole(role)
    
    // 해당 역할의 페이지로 이동
    if (role === 'team_member') {
      window.open('/ko/guide', '_blank')
    } else {
      window.open('/ko/admin', '_blank')
    }
  }

  const positions = [...new Set(teamMembers.map(member => member.position))]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">개발자 도구를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">개발자 도구</h1>
        <p className="text-gray-600">각 position별로 어떤 페이지를 보는지 확인할 수 있습니다.</p>
        
        {/* 현재 상태 디버그 정보 */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">현재 상태</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>실제 사용자: {user?.email || 'N/A'}</div>
            <div>실제 역할: {userRole || 'N/A'}</div>
            <div>시뮬레이션 중: {isSimulating ? 'Yes' : 'No'}</div>
            {isSimulating && simulatedUser && (
              <div>시뮬레이션된 사용자: {simulatedUser.email} ({simulatedUser.position})</div>
            )}
          </div>
        </div>
        
        {/* 사용 가능한 팀 멤버 목록 */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-700 mb-2">사용 가능한 팀 멤버</h3>
          <div className="text-xs text-blue-600 space-y-1">
            {teamMembers.length > 0 ? (
              teamMembers.map((member) => (
                <div key={member.email}>
                  {member.name_ko} ({member.email}) - {member.position}
                </div>
              ))
            ) : (
              <div>팀 멤버를 불러오는 중...</div>
            )}
          </div>
        </div>
      </div>

      {/* 현재 사용자 정보 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Code className="w-5 h-5 mr-2" />
            현재 사용자 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">이메일</p>
              <p className="font-medium">{user?.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">역할</p>
              <p className="font-medium">{userRole || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">시뮬레이션 중</p>
              <p className="font-medium">{simulatedRole ? `${simulatedRole} (${selectedPosition})` : '없음'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 고급 시뮬레이터 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Code className="w-5 h-5 mr-2" />
            고급 Position 시뮬레이터
          </CardTitle>
          <CardDescription>각 position별로 실제 시뮬레이션을 통해 어떤 페이지를 보는지 확인할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">실시간 Position 시뮬레이션</p>
              <p className="text-sm text-gray-600">각 사용자 유형별로 실제 페이지를 시뮬레이션하고 권한을 테스트할 수 있습니다.</p>
            </div>
            <Button
              onClick={() => window.open('/ko/admin/dev-tools/position-simulator', '_blank')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              시뮬레이터 열기
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Position별 뷰어 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Position별 페이지 뷰어</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {positions.map((position) => (
            <PositionViewer
              key={position}
              position={position}
              userRole={userRole || ''}
              onSwitchPosition={handleSwitchPosition}
            />
          ))}
        </div>
      </div>

      {/* 팀 멤버 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            팀 멤버 목록
          </CardTitle>
          <CardDescription>현재 활성화된 팀 멤버들의 정보</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">이름</th>
                  <th className="text-left py-3 px-4">이메일</th>
                  <th className="text-left py-3 px-4">Position</th>
                  <th className="text-left py-3 px-4">상태</th>
                  <th className="text-left py-3 px-4">액션</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member) => (
                  <tr key={member.email} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{member.name_ko}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{member.email}</td>
                    <td className="py-3 px-4">
                      <Badge className={
                        member.position.toLowerCase() === 'super' ? 'bg-red-100 text-red-800' :
                        member.position.toLowerCase() === 'office manager' ? 'bg-blue-100 text-blue-800' :
                        member.position.toLowerCase() === 'tour guide' ? 'bg-green-100 text-green-800' :
                        member.position.toLowerCase() === 'op' ? 'bg-yellow-100 text-yellow-800' :
                        member.position.toLowerCase() === 'driver' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {member.position}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={member.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {member.is_active ? '활성' : '비활성'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        onClick={() => handleSwitchPosition(member.position)}
                        variant="outline"
                        size="sm"
                      >
                        이 역할로 보기
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 사용법 안내 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>사용법 안내</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <p>• <strong>이 역할로 보기</strong>: 해당 position의 사용자가 보는 페이지를 새 탭에서 열어줍니다.</p>
            <p>• <strong>투어 가이드 페이지 열기</strong>: 투어 가이드 전용 페이지를 새 탭에서 열어줍니다.</p>
            <p>• 각 position별로 접근 가능한 페이지와 권한이 다릅니다.</p>
            <p>• 개발 시 각 사용자 유형별로 어떤 화면을 보는지 확인할 수 있습니다.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
