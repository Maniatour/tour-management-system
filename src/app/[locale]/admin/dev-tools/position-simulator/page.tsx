'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClientSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, Users, Settings, Code, Monitor, Play, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface TeamMember {
  email: string
  name_ko: string
  position: string
  is_active: boolean
}

interface SimulatedUser {
  email: string
  name_ko: string
  position: string
  role: string
}

export default function PositionSimulatorPage() {
  const { user, userRole, simulatedUser, startSimulation, stopSimulation, isSimulating } = useAuth()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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
      email: member.email,
      name_ko: member.name_ko,
      position: member.position,
      role: simulatedRole
    }
    
    startSimulation(simulatedUserData)
    console.log('시뮬레이션 시작:', simulatedUserData)
  }

  const handleStopSimulation = () => {
    stopSimulation()
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Position 시뮬레이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Position 시뮬레이터</h1>
        <p className="text-gray-600">각 position별로 어떤 페이지를 보는지 실제로 시뮬레이션할 수 있습니다.</p>
      </div>

      {/* 현재 시뮬레이션 상태 */}
      {isSimulating && simulatedUser && (
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800">
              <Play className="w-5 h-5 mr-2" />
              현재 시뮬레이션 중
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{simulatedUser.name_ko} ({simulatedUser.email})</p>
                <div className="text-sm text-gray-600">
                  Position: <Badge className="bg-blue-100 text-blue-800">{simulatedUser.position}</Badge>
                  Role: <Badge className="bg-green-100 text-green-800">{simulatedUser.role}</Badge>
                </div>
              </div>
              <Button onClick={handleStopSimulation} variant="outline" size="sm">
                <Square className="w-4 h-4 mr-2" />
                시뮬레이션 중지
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Position별 시뮬레이터 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teamMembers.map((member) => {
          const info = getPositionInfo(member.position)
          const IconComponent = info.icon
          const isCurrentlySimulating = simulatedUser?.email === member.email

          return (
            <Card key={member.email} className={isCurrentlySimulating ? 'border-blue-300 bg-blue-50' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <IconComponent className="w-6 h-6" />
                    <div>
                      <CardTitle className="text-lg">{info.title}</CardTitle>
                      <CardDescription>{info.description}</CardDescription>
                    </div>
                  </div>
                  <Badge className={info.color}>{member.position}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium mb-2">사용자 정보:</p>
                    <p className="text-sm text-gray-600">{member.name_ko} ({member.email})</p>
                  </div>
                  
                  <div>
                    <p className="font-medium mb-2">접근 가능한 페이지:</p>
                    <div className="space-y-2">
                      {info.pages.map((page, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <p className="text-sm font-medium">{page.name}</p>
                            <p className="text-xs text-gray-500">{page.description}</p>
                          </div>
                          <Button
                            onClick={() => openSimulatedPage(page.url)}
                            variant="outline"
                            size="sm"
                            disabled={!isCurrentlySimulating}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handleStartSimulation(member)}
                      variant={isCurrentlySimulating ? "secondary" : "default"}
                      size="sm"
                      disabled={isCurrentlySimulating}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {isCurrentlySimulating ? '시뮬레이션 중' : '시뮬레이션 시작'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 사용법 안내 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>사용법 안내</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <p>• <strong>시뮬레이션 시작</strong>: 해당 position의 사용자로 시뮬레이션을 시작합니다.</p>
            <p>• <strong>페이지 열기</strong>: 시뮬레이션 중일 때만 해당 position이 볼 수 있는 페이지를 열 수 있습니다.</p>
            <p>• <strong>시뮬레이션 중지</strong>: 현재 시뮬레이션을 중지하고 원래 상태로 돌아갑니다.</p>
            <p>• 각 position별로 접근 가능한 페이지와 권한이 다릅니다.</p>
            <p>• 개발 시 각 사용자 유형별로 어떤 화면을 보는지 실제로 확인할 수 있습니다.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
