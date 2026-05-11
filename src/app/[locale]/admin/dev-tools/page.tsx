'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClientSupabase } from '@/lib/supabase'
import { UserRole } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, Users, Settings, Code, Monitor, Play, Square, ChevronDown, ChevronUp, User } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'

interface TeamMember {
  id: string
  email: string
  name_ko: string
  phone: string | null
  language: string | null
  created_at: string
  position: string
  is_active: boolean
}


export default function DevToolsPage() {
  const { user, userRole, simulatedUser, isSimulating, startSimulation, stopSimulation } = useAuth()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPosition, setSelectedPosition] = useState<string>('')
  const [simulatedRole, setSimulatedRole] = useState<string>('')
  const [showSimulator, setShowSimulator] = useState(false)
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'

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

  const getRoleFromPosition = (position: string): string => {
    switch (position.toLowerCase()) {
      case 'super':
        return 'admin'
      case 'office manager':
        return 'manager'
      case 'tour guide':
      case 'op':
      case 'driver':
        return 'team_member'
      default:
        return 'customer'
    }
  }

  const handleStartSimulation = (member: TeamMember) => {
    const simulatedRole = getRoleFromPosition(member.position)
    const simulatedUserData = {
      id: member.id,
      email: member.email,
      name_ko: member.name_ko,
      phone: member.phone,
      language: member.language,
      created_at: member.created_at,
      position: member.position,
      role: simulatedRole as UserRole
    }
    
    startSimulation(simulatedUserData)
    setSelectedPosition(member.position)
    setSimulatedRole(simulatedRole)
    console.log('시뮬레이션 시작:', simulatedUserData)
  }

  const handleStopSimulation = () => {
    stopSimulation()
    setSelectedPosition('')
    setSimulatedRole('')
    console.log('시뮬레이션 중지')
  }

  const openSimulatedPage = (page: string) => {
    if (!simulatedUser) return
    
    let url = ''
    switch (page) {
      case 'guide':
        url = '/ko/guide'
        break
      case 'admin':
        url = '/ko/admin'
        break
      case 'tours':
        url = '/ko/guide/tours'
        break
      case 'tour-detail':
        url = '/ko/guide/tours/test-tour-id'
        break
      default:
        url = '/ko/admin'
    }
    
    // 시뮬레이션 중일 때는 현재 탭에서 이동
    router.push(url)
  }


  const getPositionInfo = (position: string) => {
    switch (position.toLowerCase()) {
      case 'super':
        return {
          title: 'Super Admin',
          description: '최고 관리자 - 모든 권한',
          color: 'bg-red-100 text-red-800',
          icon: Settings,
          pages: [
            { name: '어드민 페이지', url: 'admin', description: '모든 관리 기능' },
            { name: '투어 가이드 페이지', url: 'guide', description: '가이드 페이지 확인' }
          ]
        }
      case 'office manager':
        return {
          title: 'Office Manager',
          description: '사무실 매니저 - 관리자 권한',
          color: 'bg-blue-100 text-blue-800',
          icon: Users,
          pages: [
            { name: '어드민 페이지', url: 'admin', description: '관리 기능' },
            { name: '투어 가이드 페이지', url: 'guide', description: '가이드 페이지 확인' }
          ]
        }
      case 'tour guide':
        return {
          title: 'Tour Guide',
          description: '투어 가이드 - 제한된 권한',
          color: 'bg-green-100 text-green-800',
          icon: Eye,
          pages: [
            { name: '투어 가이드 대시보드', url: 'guide', description: '메인 대시보드' },
            { name: '투어 관리', url: 'tours', description: '배정된 투어만' },
            { name: '투어 상세', url: 'tour-detail', description: '투어 상세 정보' }
          ]
        }
      case 'op':
        return {
          title: 'Operator',
          description: '운영자 - 중간 권한',
          color: 'bg-yellow-100 text-yellow-800',
          icon: Monitor,
          pages: [
            { name: '어드민 페이지', url: 'admin', description: '운영 관련 기능' },
            { name: '투어 가이드 페이지', url: 'guide', description: '가이드 페이지 확인' }
          ]
        }
      case 'driver':
        return {
          title: 'Driver',
          description: '운전기사 - 제한된 권한',
          color: 'bg-purple-100 text-purple-800',
          icon: Users,
          pages: [
            { name: '어드민 페이지', url: 'admin', description: '운전 관련 기능' },
            { name: '투어 가이드 페이지', url: 'guide', description: '가이드 페이지 확인' }
          ]
        }
      default:
        return {
          title: 'Unknown Position',
          description: '알 수 없는 역할',
          color: 'bg-gray-100 text-gray-800',
          icon: Code,
          pages: []
        }
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] sm:min-h-screen">
        <div className="text-center px-4">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600">개발자 도구를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 md:p-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-base sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">개발자 도구</h1>
        <p className="text-xs sm:text-base text-gray-600">각 position별로 어떤 페이지를 보는지 확인할 수 있습니다.</p>
        
        {/* 현재 상태 디버그 정보 */}
        <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
          <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">현재 상태</h3>
          <div className="text-[10px] sm:text-xs text-gray-600 space-y-0.5 sm:space-y-1">
            <div>실제 사용자: {user?.email || 'N/A'}</div>
            <div>실제 역할: {userRole || 'N/A'}</div>
            <div>시뮬레이션 중: {isSimulating ? 'Yes' : 'No'}</div>
            {isSimulating && simulatedUser && (
              <div>시뮬레이션된 사용자: {simulatedUser.email} ({simulatedUser.position})</div>
            )}
          </div>
        </div>
        
      </div>

      {/* 현재 사용자 정보 */}
      <Card className="mb-4 sm:mb-8">
        <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <Code className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
            현재 사용자 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="min-w-0">
              <p className="text-gray-500">이메일</p>
              <p className="font-medium truncate">{user?.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">역할</p>
              <p className="font-medium">{userRole || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">시뮬레이션 중</p>
              <p className="font-medium truncate">{simulatedRole ? `${simulatedRole} (${selectedPosition})` : '없음'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 현재 시뮬레이션 상태 */}
      {isSimulating && simulatedUser && (
        <Card className="mb-4 sm:mb-8 border-blue-200 bg-blue-50">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center text-blue-800 text-sm sm:text-base">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
              현재 시뮬레이션 중
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-sm sm:text-base truncate">{simulatedUser.name_ko} ({simulatedUser.email})</p>
                <div className="flex flex-wrap gap-1.5 mt-1 text-xs sm:text-sm text-gray-600">
                  <Badge className="bg-blue-100 text-blue-800 text-[10px] sm:text-xs">Position: {simulatedUser.position}</Badge>
                  <Badge className="bg-green-100 text-green-800 text-[10px] sm:text-xs">Role: {simulatedUser.role}</Badge>
                </div>
                <div className="mt-2 text-[10px] sm:text-xs text-blue-600">
                  💡 시뮬레이션 중에도 언어를 변경할 수 있으며, 시뮬레이션 상태가 유지됩니다.
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button onClick={handleStopSimulation} variant="outline" size="sm" className="text-xs h-8">
                  <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  시뮬레이션 중지
                </Button>
                <Button onClick={() => setShowSimulator(!showSimulator)} variant="outline" size="sm" className="text-xs h-8">
                  {showSimulator ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />}
                  {showSimulator ? '닫기' : '열기'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 고객 시뮬레이터 */}
      <Card className="mb-4 sm:mb-8">
        <CardHeader className="p-3 sm:p-6 pb-2">
          <CardTitle className="flex items-center text-sm sm:text-base">
            <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
            고객 시뮬레이터
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">고객의 관점에서 시스템을 테스트할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 mb-2">
                실제 고객 계정으로 시뮬레이션하여 고객 대시보드, 내 정보, 내 예약 페이지를 테스트할 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-gray-500">
                <span>• 고객 대시보드</span>
                <span>• 예약 확인</span>
                <span>• 프로필 관리</span>
              </div>
            </div>
            <Button
              onClick={() => router.push(`/${locale}/admin/dev-tools/customer-simulator`)}
              className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm h-8 sm:h-9 shrink-0"
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              고객 시뮬레이션 시작
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 고급 시뮬레이터 */}
      <Card className="mb-4 sm:mb-8">
        <CardHeader className="p-3 sm:p-6 pb-2">
          <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center text-sm sm:text-base">
              <Code className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
              고급 Position 시뮬레이터
            </div>
            <Button
              onClick={() => setShowSimulator(!showSimulator)}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto text-xs h-8"
            >
              {showSimulator ? <ChevronUp className="w-3.5 h-3.5 mr-1.5" /> : <ChevronDown className="w-3.5 h-3.5 mr-1.5" />}
              {showSimulator ? '시뮬레이터 닫기' : '시뮬레이터 열기'}
            </Button>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">각 position별로 실제 시뮬레이션을 통해 어떤 페이지를 보는지 확인할 수 있습니다.</CardDescription>
        </CardHeader>
        {showSimulator && (
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="space-y-4 sm:space-y-6">
              {/* Position별 시뮬레이터 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {teamMembers.map((member) => {
                  const info = getPositionInfo(member.position)
                  const IconComponent = info.icon
                  const isCurrentlySimulating = simulatedUser?.email === member.email

                  return (
                    <Card key={member.email} className={isCurrentlySimulating ? 'border-blue-300 bg-blue-50' : ''}>
                      <CardHeader className="p-3 sm:pb-3 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <div className="min-w-0">
                              <CardTitle className="text-sm sm:text-base truncate">{info.title}</CardTitle>
                              <CardDescription className="text-[10px] sm:text-xs truncate">{member.name_ko}</CardDescription>
                            </div>
                          </div>
                          <Badge className={`${info.color} text-[10px] sm:text-xs shrink-0`} variant="outline">{member.position}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-6 pt-0">
                        <div className="space-y-2 sm:space-y-3">
                          <div>
                            <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-1">접근 가능한 페이지:</p>
                            <div className="space-y-1">
                              {info.pages.map((page, index) => (
                                <div key={index} className="flex items-center justify-between p-1.5 bg-gray-50 rounded text-[10px] sm:text-xs">
                                  <span className="font-medium truncate mr-1">{page.name}</span>
                                  <Button
                                    onClick={() => openSimulatedPage(page.url)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 shrink-0"
                                    disabled={!isCurrentlySimulating}
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <Button
                            onClick={() => handleStartSimulation(member)}
                            variant={isCurrentlySimulating ? "secondary" : "default"}
                            size="sm"
                            className="w-full h-7 sm:h-8 text-[10px] sm:text-xs"
                            disabled={isCurrentlySimulating}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            {isCurrentlySimulating ? '시뮬레이션 중' : '시뮬레이션 시작'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* 사용법 안내 */}
              <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-xs sm:text-sm mb-1.5 sm:mb-2">사용법 안내</h4>
                <div className="space-y-1.5 sm:space-y-2 text-[10px] sm:text-sm text-gray-600">
                  <p>• <strong>시뮬레이션 시작</strong>: 해당 position의 사용자로 시뮬레이션을 시작합니다.</p>
                  <p>• <strong>페이지 열기</strong>: 시뮬레이션 중일 때만 해당 position이 볼 수 있는 페이지를 열 수 있습니다.</p>
                  <p>• <strong>시뮬레이션 중지</strong>: 현재 시뮬레이션을 중지하고 원래 상태로 돌아갑니다.</p>
                  <p>• <strong>언어별 시뮬레이션</strong>: 시뮬레이션 중에도 언어를 변경할 수 있으며, 시뮬레이션 상태가 유지됩니다.</p>
                  <p>• 각 position별로 접근 가능한 페이지와 권한이 다릅니다.</p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 사용법 안내 */}
      <Card className="mt-4 sm:mt-8">
        <CardHeader className="p-3 sm:p-6 pb-2">
          <CardTitle className="text-sm sm:text-base">사용법 안내</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          <div className="space-y-2 sm:space-y-3 text-[10px] sm:text-sm text-gray-600">
            <p>• <strong>시뮬레이터 열기/닫기</strong>: 같은 페이지에서 시뮬레이터를 열고 닫을 수 있습니다.</p>
            <p>• <strong>시뮬레이션 시작</strong>: 해당 position의 사용자로 시뮬레이션을 시작합니다.</p>
            <p>• <strong>페이지 열기</strong>: 시뮬레이션 중일 때만 해당 position이 볼 수 있는 페이지를 열 수 있습니다.</p>
            <p>• 각 position별로 접근 가능한 페이지와 권한이 다릅니다.</p>
            <p>• 개발 시 각 사용자 유형별로 어떤 화면을 보는지 실제로 확인할 수 있습니다.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
