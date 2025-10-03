'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { bulkCreateFutureTourPhotoBuckets, createIndividualTourBuckets } from '@/lib/bulkCreateTourPhotoBuckets'

export default function BulkCreateTourPhotoBuckets() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    details?: string
  } | null>(null)

  const handleBulkCreate = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      console.log('Starting bulk creation for future tours...')
      const success = await bulkCreateFutureTourPhotoBuckets()
      
      if (success) {
        setResult({
          success: true,
          message: '앞으로의 투어 포토 버켓 생성이 완료되었습니다!',
          details: '오늘 이후의 모든 투어에 대해 tour-photos 버켓과 폴더 구조가 생성되었습니다.'
        })
      } else {
        setResult({
          success: false,
          message: '투어 포토 버켓 생성 중 오류가 발생했습니다.',
          details: 'RLS 정책으로 인한 오류일 수 있습니다. Supabase SQL Editor에서 수동으로 버켓을 생성해주세요. 콘솔을 확인하여 자세한 SQL 명령어를 확인하세요.'
        })
      }
    } catch (error) {
      console.error('Error in bulk create:', error)
      setResult({
        success: false,
        message: '예상치 못한 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleIndividualCreate = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      console.log('Starting individual bucket creation...')
      const success = await createIndividualTourBuckets()
      
      if (success) {
        setResult({
          success: true,
          message: '투어별 개별 버켓 생성이 완료되었습니다!',
          details: '각 투어에 대해 개별 tour-photos-{tourId} 버켓이 생성되었습니다.'
        })
      } else {
        setResult({
          success: false,
          message: '투어별 개별 버켓 생성 중 오류가 발생했습니다.',
          details: '콘솔을 확인하여 자세한 오류 정보를 확인하세요.'
        })
      }
    } catch (error) {
      console.error('Error in individual create:', error)
      setResult({
        success: false,
        message: '예상치 못한 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            투어 포토 버켓 일괄 생성
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              오늘 이후의 투어 데이터에 대해 tour-photos 버켓을 생성합니다. 
              이 작업은 앞으로의 투어들의 사진 업로드 기능을 활성화합니다.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-2">수동 SQL 실행 방법:</div>
              <div className="text-sm space-y-2">
                <p>1. Supabase 대시보드 → SQL Editor로 이동</p>
                <p>2. <code className="bg-gray-100 px-1 rounded">create_future_tour_photos_bucket.sql</code> 파일의 내용을 복사하여 실행</p>
                <p>3. 또는 다음 간단한 SQL을 실행:</p>
                <div className="bg-gray-100 p-2 rounded text-xs font-mono mt-2">
                  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)<br/>
                  VALUES ('tour-photos', 'tour-photos', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])<br/>
                  ON CONFLICT (id) DO NOTHING;
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">앞으로의 투어 버켓 생성</h3>
              <p className="text-sm text-gray-600">
                오늘 이후의 투어에 대해 tour-photos 버켓과 폴더 구조를 만듭니다.
              </p>
              <Button 
                onClick={handleBulkCreate} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  '앞으로의 투어 버켓 생성'
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">투어별 개별 버켓 생성</h3>
              <p className="text-sm text-gray-600">
                각 투어에 대해 개별 tour-photos-{`{tourId}`} 버켓을 생성합니다.
              </p>
              <Button 
                onClick={handleIndividualCreate} 
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  '개별 버켓 생성'
                )}
              </Button>
            </div>
          </div>

          {result && (
            <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={result.success ? 'text-green-800' : 'text-red-800'}>
                <div className="font-medium">{result.message}</div>
                {result.details && (
                  <div className="text-sm mt-1">{result.details}</div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>작업 설명</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">앞으로의 투어 버켓 생성</h3>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>tour-photos 메인 버켓 생성 (없는 경우)</li>
              <li>오늘 이후의 투어별로 tours/{`{tourId}`} 폴더 구조 생성</li>
              <li>미래 투어 데이터만 기반으로 자동 처리</li>
              <li>권장 방법: 단일 버켓으로 관리</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">투어별 개별 버켓 생성</h3>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>각 투어에 대해 tour-photos-{`{tourId}`} 개별 버켓 생성</li>
              <li>투어별로 완전히 분리된 스토리지</li>
              <li>더 많은 버켓 생성으로 관리 복잡성 증가</li>
              <li>특별한 요구사항이 있는 경우에만 사용</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
