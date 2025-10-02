'use client'

import { useState } from 'react'
import { Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface MigrationResult {
  success: boolean
  message: string
  uploadedUrls?: string[]
}

interface FileInfo {
  fileName: string
  fileId: string
  googleDriveUrl: string
  hotelId?: string
  photoNumber?: number
  date?: string
}

interface Hotel {
  id: string
  hotel: string
  pick_up_location: string
}

export default function MigrateImagesPage() {
  const [googleDriveUrls, setGoogleDriveUrls] = useState('')
  const [hotelId, setHotelId] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [hotels, setHotels] = useState<Hotel[]>([])
  
  // 대량 처리 관련 상태
  const [bulkMode, setBulkMode] = useState(false)
  const [extractedFiles, setExtractedFiles] = useState<FileInfo[]>([])
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 })
  const [bulkResults, setBulkResults] = useState<{[hotelId: string]: { success: number, failed: number, urls: string[]}}>({})

  // 픽업 호텔 목록 로드
  const loadHotels = async () => {
    const { data, error } = await supabase
      .from('pickup_hotels')
      .select('id, hotel, pick_up_location')
      .order('hotel')

    if (error) {
      console.error('호텔 목록 로드 실패:', error)
      return
    }

    setHotels(data || [])
  }

  // 파일명에서 호텔 정보 추출
  const parseFileName = (fileName: string) => {
    const match = fileName.match(/^([a-f0-9]{8})\.Photo\s+(\d+)\.(\d+)\.png$/i)
    if (match) {
      return {
        hotelId: match[1],
        photoNumber: parseInt(match[2]),
        date: match[3],
        isValid: true
      }
    }
    return { isValid: false }
  }

  // 구글 드라이브 URL을 직접 다운로드 URL로 변환
  const convertGoogleDriveUrl = (url: string) => {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileIdMatch) {
      const fileId = fileIdMatch[1]
      return `https://drive.google.com/uc?export=download&id=${fileId}`
    }
    return url
  }

  // 추출된 파일 목록 파싱
  const parseExtractedFiles = (fileList: FileInfo[]) => {
    const parsedFiles: FileInfo[] = []
    const invalidFiles: string[] = []

    fileList.forEach(file => {
      const parsed = parseFileName(file.fileName)
      if (parsed.isValid) {
        parsedFiles.push({
          ...file,
          hotelId: parsed.hotelId,
          photoNumber: parsed.photoNumber,
          date: parsed.date
        })
      } else {
        invalidFiles.push(file.fileName)
      }
    })

    return { parsedFiles, invalidFiles }
  }

  // 호텔별로 파일 그룹화
  const groupFilesByHotel = (files: FileInfo[]) => {
    const grouped: {[hotelId: string]: FileInfo[]} = {}
    
    files.forEach(file => {
      if (file.hotelId) {
        if (!grouped[file.hotelId]) {
          grouped[file.hotelId] = []
        }
        grouped[file.hotelId].push(file)
      }
    })

    // 각 호텔별로 사진 번호 순으로 정렬
    Object.keys(grouped).forEach(hotelId => {
      grouped[hotelId].sort((a, b) => (a.photoNumber || 0) - (b.photoNumber || 0))
    })

    return grouped
  }

  // 이미지 다운로드 및 업로드
  const migrateImages = async () => {
    if (!googleDriveUrls.trim() || !hotelId) {
      setResult({
        success: false,
        message: '구글 드라이브 URL과 호텔을 선택해주세요.'
      })
      return
    }

    setMigrating(true)
    setResult(null)

    try {
      const urls = googleDriveUrls.split('\n').filter(url => url.trim())
      const uploadedUrls: string[] = []

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i].trim()
        
        try {
          // 구글 드라이브 URL 변환
          const downloadUrl = convertGoogleDriveUrl(url)
          
          // 이미지 다운로드
          const response = await fetch(downloadUrl)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          const blob = await response.blob()
          
          // 파일명 생성
          const timestamp = Date.now()
          const fileName = `${hotelId}_${timestamp}_${i + 1}.jpg`
          
          // Supabase에 업로드
          const { error: uploadError } = await supabase.storage
            .from('pickup-hotel-media')
            .upload(`hotels/${hotelId}/${fileName}`, blob, {
              contentType: 'image/jpeg',
              upsert: true
            })

          if (uploadError) {
            throw uploadError
          }

          // 공개 URL 생성
          const { data: { publicUrl } } = supabase.storage
            .from('pickup-hotel-media')
            .getPublicUrl(`hotels/${hotelId}/${fileName}`)

          uploadedUrls.push(publicUrl)
          
        } catch (error) {
          console.error(`이미지 ${i + 1} 처리 실패:`, error)
          continue
        }
      }

      if (uploadedUrls.length > 0) {
        // 기존 미디어 URL 가져오기
        const { data: hotel, error: fetchError } = await supabase
          .from('pickup_hotels')
          .select('media')
          .eq('id', hotelId)
          .single()

        if (fetchError) {
          throw fetchError
        }

        // 기존 미디어와 새 미디어 합치기
        const existingMedia = (hotel as { media?: string[] }).media || []
        const updatedMedia = [...existingMedia, ...uploadedUrls]

        // 데이터베이스 업데이트
        const { error: updateError } = await supabase
          .from('pickup_hotels')
          .update({ media: updatedMedia } as never)
          .eq('id', hotelId)

        if (updateError) {
          throw updateError
        }

        setResult({
          success: true,
          message: `${uploadedUrls.length}개 이미지가 성공적으로 마이그레이션되었습니다.`,
          uploadedUrls
        })
      } else {
        setResult({
          success: false,
          message: '업로드된 이미지가 없습니다. URL을 확인해주세요.'
        })
      }

    } catch (error) {
      console.error('마이그레이션 실패:', error)
      setResult({
        success: false,
        message: `마이그레이션 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      })
    } finally {
      setMigrating(false)
    }
  }

  // 대량 마이그레이션 함수
  const migrateBulkImages = async () => {
    if (extractedFiles.length === 0) {
      setResult({
        success: false,
        message: '추출된 파일 목록이 없습니다.'
      })
      return
    }

    setMigrating(true)
    setResult(null)
    setBulkResults({})
    setProcessingProgress({ current: 0, total: 0 })

    try {
      // 파일 파싱
      const { parsedFiles } = parseExtractedFiles(extractedFiles)
      
      if (parsedFiles.length === 0) {
        setResult({
          success: false,
          message: '유효한 파일이 없습니다. 파일명 패턴을 확인해주세요.'
        })
        return
      }

      // 호텔별로 그룹화
      const groupedFiles = groupFilesByHotel(parsedFiles)
      const hotelIds = Object.keys(groupedFiles)
      const totalFiles = parsedFiles.length

      setProcessingProgress({ current: 0, total: totalFiles })

      console.log(`🚀 대량 마이그레이션 시작: ${hotelIds.length}개 호텔, ${totalFiles}개 파일`)

      let processedFiles = 0
      const results: {[hotelId: string]: { success: number, failed: number, urls: string[]}} = {}

      // 각 호텔별로 처리
      for (const hotelId of hotelIds) {
        const files = groupedFiles[hotelId]
        console.log(`🏨 호텔 처리 중: ${hotelId} (${files.length}개 파일)`)
        
        results[hotelId] = { success: 0, failed: 0, urls: [] }
        const uploadedUrls: string[] = []
        
        for (const file of files) {
          try {
            // 구글 드라이브 URL 변환
            const downloadUrl = convertGoogleDriveUrl(file.googleDriveUrl)
            
            // 이미지 다운로드
            const response = await fetch(downloadUrl)
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            
            const blob = await response.blob()
            
            // Supabase에 업로드
            const { error: uploadError } = await supabase.storage
              .from('pickup-hotel-media')
              .upload(`hotels/${hotelId}/${file.fileName}`, blob, {
                contentType: 'image/png',
                upsert: true
              })

            if (uploadError) {
              throw uploadError
            }

            // 공개 URL 생성
            const { data: { publicUrl } } = supabase.storage
              .from('pickup-hotel-media')
              .getPublicUrl(`hotels/${hotelId}/${file.fileName}`)

            uploadedUrls.push(publicUrl)
            results[hotelId].success++
            
            processedFiles++
            setProcessingProgress({ current: processedFiles, total: totalFiles })
            
            // 요청 간격 조절
            await new Promise(resolve => setTimeout(resolve, 500))
            
          } catch (error) {
            console.error(`이미지 처리 실패 (${file.fileName}):`, error)
            results[hotelId].failed++
            processedFiles++
            setProcessingProgress({ current: processedFiles, total: totalFiles })
          }
        }
        
        // 호텔 데이터 업데이트
        if (uploadedUrls.length > 0) {
          try {
            // 기존 미디어 URL 가져오기
            const { data: hotel, error: fetchError } = await supabase
              .from('pickup_hotels')
              .select('media')
              .eq('id', hotelId)
              .single()

            if (!fetchError && hotel) {
              // 기존 미디어와 새 미디어 합치기
              const existingMedia = (hotel as { media?: string[] }).media || []
              const updatedMedia = [...existingMedia, ...uploadedUrls]

              // 데이터베이스 업데이트
              await supabase
                .from('pickup_hotels')
                .update({ media: updatedMedia } as never)
                .eq('id', hotelId)
            }
          } catch (error) {
            console.error(`호텔 데이터 업데이트 실패 (${hotelId}):`, error)
          }
        }
        
        results[hotelId].urls = uploadedUrls
      }

      setBulkResults(results)
      
      const totalSuccess = Object.values(results).reduce((sum, r) => sum + r.success, 0)
      const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0)
      
      setResult({
        success: true,
        message: `대량 마이그레이션 완료! 성공: ${totalSuccess}개, 실패: ${totalFailed}개`
      })

    } catch (error) {
      console.error('대량 마이그레이션 실패:', error)
      setResult({
        success: false,
        message: `대량 마이그레이션 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      })
    } finally {
      setMigrating(false)
    }
  }

  // 파일 목록 입력 처리
  const handleFileListInput = (input: string) => {
    try {
      const files = JSON.parse(input)
      if (Array.isArray(files)) {
        setExtractedFiles(files)
        const { parsedFiles, invalidFiles } = parseExtractedFiles(files)
        
        if (invalidFiles.length > 0) {
          console.warn('무효한 파일명:', invalidFiles)
        }
        
        console.log(`파일 목록 로드됨: ${files.length}개 파일, ${parsedFiles.length}개 유효`)
      } else {
        throw new Error('잘못된 형식')
      }
    } catch (error) {
      console.error('파일 목록 파싱 실패:', error)
      setResult({
        success: false,
        message: '파일 목록 형식이 올바르지 않습니다. JSON 배열 형식이어야 합니다.'
      })
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">이미지 마이그레이션</h1>
        <p className="text-gray-600">
          구글 드라이브에 저장된 픽업 호텔 이미지를 Supabase Storage로 마이그레이션합니다.
        </p>
      </div>

      {/* 모드 선택 */}
      <div className="mb-6">
        <div className="flex space-x-4">
          <button
            onClick={() => setBulkMode(false)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              !bulkMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            개별 마이그레이션
          </button>
          <button
            onClick={() => setBulkMode(true)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              bulkMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            대량 마이그레이션
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {!bulkMode ? (
          <>
            {/* 개별 마이그레이션 모드 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                픽업 호텔 선택
              </label>
              <div className="flex space-x-4">
                <select
                  value={hotelId}
                  onChange={(e) => setHotelId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={migrating}
                >
                  <option value="">호텔을 선택하세요</option>
                  {hotels.map((hotel) => (
                    <option key={hotel.id} value={hotel.id}>
                      {hotel.hotel} - {hotel.pick_up_location}
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadHotels}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={migrating}
                >
                  새로고침
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 대량 마이그레이션 모드 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                구글 드라이브 파일 목록 (JSON 형식)
              </label>
              <textarea
                placeholder='[{"fileName": "0f7f30a4.Photo 1.041046.png", "fileId": "FILE_ID", "googleDriveUrl": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing"}, ...]'
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                onChange={(e) => handleFileListInput(e.target.value)}
                disabled={migrating}
              />
              <p className="text-sm text-gray-500 mt-1">
                구글 드라이브 폴더에서 추출한 JSON 배열을 붙여넣으세요.
              </p>
            </div>

            {/* 파일 목록 미리보기 */}
            {extractedFiles.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  파일 목록 미리보기 ({extractedFiles.length}개 파일)
                </h3>
                <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                  {extractedFiles.map((file, index) => {
                    const parsed = parseFileName(file.fileName)
                    return (
                      <div key={index} className="text-xs text-gray-600 mb-1">
                        <span className={parsed.isValid ? 'text-green-600' : 'text-red-600'}>
                          {parsed.isValid ? '✅' : '❌'}
                        </span>
                        {' '}{file.fileName}
                        {parsed.isValid && (
                          <span className="text-blue-600 ml-2">
                            (호텔: {parsed.hotelId}, 사진: {parsed.photoNumber})
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* 구글 드라이브 URL 입력 (개별 모드에서만) */}
        {!bulkMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              구글 드라이브 이미지 URL (한 줄에 하나씩)
            </label>
            <textarea
              value={googleDriveUrls}
              onChange={(e) => setGoogleDriveUrls(e.target.value)}
              placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing&#10;https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={migrating}
            />
            <p className="text-sm text-gray-500 mt-1">
              구글 드라이브 공유 링크를 한 줄에 하나씩 입력하세요.
            </p>
          </div>
        )}


        {/* 마이그레이션 버튼 */}
        <div className="flex justify-center">
          <button
            onClick={bulkMode ? migrateBulkImages : migrateImages}
            disabled={
              migrating || 
              (bulkMode ? extractedFiles.length === 0 : (!googleDriveUrls.trim() || !hotelId))
            }
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {migrating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{bulkMode ? '대량 마이그레이션 중...' : '마이그레이션 중...'}</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>{bulkMode ? '대량 마이그레이션 시작' : '마이그레이션 시작'}</span>
              </>
            )}
          </button>
        </div>

        {/* 진행률 표시 (대량 모드에서만) */}
        {bulkMode && migrating && processingProgress.total > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">진행률</span>
              <span className="text-sm text-blue-700">
                {processingProgress.current} / {processingProgress.total}
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(processingProgress.current / processingProgress.total) * 100}%` 
                }}
              />
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {Math.round((processingProgress.current / processingProgress.total) * 100)}% 완료
            </p>
          </div>
        )}

        {/* 결과 표시 */}
        {result && (
          <div className={`p-4 rounded-lg ${
            result.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start space-x-3">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {result.message}
                </p>
                
                {result.uploadedUrls && result.uploadedUrls.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-green-700 mb-2">업로드된 이미지:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {result.uploadedUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`업로드된 이미지 ${index + 1}`}
                            className="w-full h-20 object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs opacity-0 group-hover:opacity-100">
                              {index + 1}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 대량 처리 결과 표시 */}
        {bulkMode && Object.keys(bulkResults).length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">호텔별 처리 결과</h3>
            <div className="space-y-3">
              {Object.entries(bulkResults).map(([hotelId, result]) => {
                const hotel = hotels.find(h => h.id === hotelId)
                return (
                  <div key={hotelId} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900">
                          {hotel ? `${hotel.hotel} - ${hotel.pick_up_location}` : hotelId}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">({hotelId})</span>
                      </div>
                      <div className="flex space-x-4 text-sm">
                        <span className="text-green-600">✅ {result.success}개 성공</span>
                        {result.failed > 0 && (
                          <span className="text-red-600">❌ {result.failed}개 실패</span>
                        )}
                      </div>
                    </div>
                    
                    {result.urls.length > 0 && (
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mt-2">
                        {result.urls.slice(0, 6).map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`호텔 ${hotelId} 이미지 ${index + 1}`}
                            className="w-full h-16 object-cover rounded"
                          />
                        ))}
                        {result.urls.length > 6 && (
                          <div className="w-full h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                            +{result.urls.length - 6}개 더
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 사용법 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">사용법:</h3>
          
          {!bulkMode ? (
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>구글 드라이브에서 이미지를 공개로 공유 설정</li>
              <li>공유 링크를 복사 (https://drive.google.com/file/d/FILE_ID/view?usp=sharing 형식)</li>
              <li>위의 텍스트 영역에 링크를 한 줄에 하나씩 입력</li>
              <li>마이그레이션할 호텔을 선택</li>
              <li>&quot;마이그레이션 시작&quot; 버튼 클릭</li>
            </ol>
          ) : (
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>구글 드라이브 폴더에서 파일 목록 추출</li>
              <li>개발자 도구(F12) → Console에서 JavaScript 코드 실행</li>
              <li>추출된 JSON 배열을 위의 텍스트 영역에 붙여넣기</li>
              <li>파일 목록 미리보기에서 패턴 검증 확인</li>
              <li>&quot;대량 마이그레이션 시작&quot; 버튼 클릭</li>
            </ol>
          )}
          
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
            <h4 className="font-medium text-green-900 mb-2">📁 픽업 호텔 이미지 폴더:</h4>
            <p className="text-sm text-green-800 mb-2">
              파일명 패턴: <code className="bg-green-100 px-1 rounded">{'{hotelId}.Photo {number}.{date}.png'}</code>
            </p>
            <p className="text-sm text-green-800">
              예시: <code className="bg-green-100 px-1 rounded">0f7f30a4.Photo 1.041046.png</code>
            </p>
            <p className="text-sm text-green-800 mt-1">
              폴더 링크: <a href="https://drive.google.com/drive/u/0/folders/1-1isDupdB8umUlcyUGP2IoX9x8CGZrCv" target="_blank" rel="noopener noreferrer" className="underline">구글 드라이브 픽업 호텔 이미지 폴더</a>
            </p>
          </div>

          {bulkMode && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <h4 className="font-medium text-yellow-900 mb-2">🔧 파일 목록 추출 방법:</h4>
              
              <div className="space-y-3">
                {/* 방법 1: 최신 강력한 추출기 */}
                <div>
                  <h5 className="font-medium text-yellow-800 mb-1">방법 1: 최신 강력한 추출기 (권장)</h5>
                  <p className="text-sm text-yellow-700 mb-2">
                    구글 드라이브 폴더에서 다음 코드를 복사하여 콘솔에 붙여넣고 실행하세요:
                  </p>
                  <div className="bg-yellow-100 rounded p-2 text-xs font-mono overflow-x-auto">
                    <pre>{`// 최신 구글 드라이브 파일 추출기 v2.0
console.log('🚀 구글 드라이브 파일 추출기 v2.0 시작...');

// 페이지 소스에서 직접 추출
function extractFromPageSource() {
  const files = [];
  const pageSource = document.documentElement.innerHTML;
  
  // 파일 ID 패턴 찾기
  const fileIdPattern = /\\/file\\/d\\/([a-zA-Z0-9_-]+)/g;
  const fileIds = [...pageSource.matchAll(fileIdPattern)].map(match => match[1]);
  
  // 파일명 패턴 찾기 (픽업 호텔 이미지)
  const fileNamePattern = /([a-f0-9]{8}\\.Photo\\s+\\d+\\.\\d+\\.png)/gi;
  const fileNames = [...pageSource.matchAll(fileNamePattern)].map(match => match[1]);
  
  console.log(\`발견된 파일 ID: \${fileIds.length}개\`);
  console.log(\`발견된 파일명: \${fileNames.length}개\`);
  
  // 파일명과 ID 매칭 시도
  fileNames.forEach((fileName, index) => {
    if (fileIds[index]) {
      files.push({
        fileName: fileName,
        fileId: fileIds[index],
        googleDriveUrl: \`https://drive.google.com/file/d/\${fileIds[index]}/view?usp=sharing\`
      });
    }
  });
  
  return files;
}

// 모든 클릭 가능한 요소에서 추출
function extractFromClickableElements() {
  const files = [];
  const clickableElements = document.querySelectorAll('[role="button"], a, [data-id], [data-tooltip]');
  
  clickableElements.forEach(element => {
    try {
      // 파일명 추출
      let fileName = null;
      const nameSelectors = ['[data-tooltip]', '[aria-label]', '.a-s-fa-Ha-pa', 'span', 'div'];
      
      for (const selector of nameSelectors) {
        const nameElement = element.querySelector(selector);
        if (nameElement) {
          fileName = nameElement.getAttribute('data-tooltip') || 
                    nameElement.getAttribute('aria-label') || 
                    nameElement.textContent?.trim();
          if (fileName && fileName.includes('.png')) break;
        }
      }
      
      // 링크 추출
      let fileId = null;
      const linkElement = element.querySelector('a[href*="/file/d/"]') || element;
      if (linkElement.href) {
        const fileIdMatch = linkElement.href.match(/\\/file\\/d\\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          fileId = fileIdMatch[1];
        }
      }
      
      if (fileName && fileId) {
        files.push({
          fileName: fileName,
          fileId: fileId,
          googleDriveUrl: \`https://drive.google.com/file/d/\${fileId}/view?usp=sharing\`
        });
      }
    } catch (error) {
      // 무시
    }
  });
  
  return files;
}

// 실행
const results = {
  pageSource: extractFromPageSource(),
  clickable: extractFromClickableElements()
};

console.log('📊 결과 요약:');
console.log(\`페이지 소스: \${results.pageSource.length}개 파일\`);
console.log(\`클릭 가능 요소: \${results.clickable.length}개 파일\`);

const bestResult = results.pageSource.length > results.clickable.length ? results.pageSource : results.clickable;

if (bestResult.length > 0) {
  console.log('\\n📋 추출된 파일 목록:');
  bestResult.forEach((file, index) => {
    console.log(\`\${index + 1}. \${file.fileName}\`);
  });
  
  console.log('\\n📄 JSON 결과:');
  console.log(JSON.stringify(bestResult, null, 2));
} else {
  console.log('❌ 자동 추출 실패. 수동 입력 도우미를 사용하세요.');
}`}</pre>
                  </div>
                </div>

                {/* 방법 2: 고급 수동 입력 도우미 */}
                <div>
                  <h5 className="font-medium text-yellow-800 mb-1">방법 2: 고급 수동 입력 도우미</h5>
                  <p className="text-sm text-yellow-700 mb-2">
                    자동 추출이 실패할 경우 사용하세요. 더 강력한 기능을 제공합니다:
                  </p>
                  <div className="bg-yellow-100 rounded p-2 text-xs font-mono overflow-x-auto">
                    <pre>{`// 고급 수동 입력 도우미 생성
const helperHTML = \`
<div id="advanced-file-extractor" style="position: fixed; top: 20px; right: 20px; width: 450px; max-height: 80vh; background: white; border: 2px solid #4285f4; border-radius: 12px; padding: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); z-index: 10000; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; overflow-y: auto;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <h3 style="margin: 0; color: #4285f4; font-size: 18px;">🚀 고급 파일 추출기</h3>
    <button onclick="closeAdvancedHelper()" style="background: #ea4335; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">✕</button>
  </div>
  
  <div style="margin-bottom: 15px;">
    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">파일명:</label>
    <input type="text" id="advancedFileName" placeholder="예: 0f7f30a4.Photo 1.041046.png" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px;">
  </div>
  
  <div style="margin-bottom: 15px;">
    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">구글 드라이브 URL:</label>
    <input type="text" id="advancedFileUrl" placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px;">
  </div>
  
  <div style="display: flex; gap: 10px; margin-bottom: 20px;">
    <button onclick="addFileToAdvancedHelper()" style="background: #4285f4; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; flex: 1;">➕ 파일 추가</button>
    <button onclick="copyAdvancedHelperResult()" style="background: #34a853; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; flex: 1;">📋 복사</button>
  </div>
  
  <div style="margin-bottom: 15px;">
    <button onclick="autoDetectFiles()" style="background: #ff9800; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold;">🔍 자동 감지 시도</button>
  </div>
  
  <div id="advancedFileList" style="margin-top: 15px; max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 6px; padding: 15px; background: #f8f9fa;">
    <p style="margin: 0; color: #666; text-align: center;">추가된 파일이 여기에 표시됩니다...</p>
  </div>
  
  <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 6px;">
    <p style="margin: 0; font-size: 12px; color: #1976d2;">💡 <strong>팁:</strong> 파일을 우클릭 → "링크 복사" 또는 "공유"를 사용하세요.</p>
  </div>
</div>\`;

document.body.insertAdjacentHTML('beforeend', helperHTML);

window.advancedHelperFiles = [];
window.addFileToAdvancedHelper = function() {
  const fileName = document.getElementById('advancedFileName').value.trim();
  const fileUrl = document.getElementById('advancedFileUrl').value.trim();
  
  if (!fileName || !fileUrl) {
    alert('파일명과 URL을 모두 입력해주세요.');
    return;
  }
  
  const fileIdMatch = fileUrl.match(/\\/file\\/d\\/([a-zA-Z0-9_-]+)/);
  if (!fileIdMatch) {
    alert('올바른 구글 드라이브 URL을 입력해주세요.');
    return;
  }
  
  const fileId = fileIdMatch[1];
  const fileData = { fileName: fileName, fileId: fileId, googleDriveUrl: fileUrl };
  
  const exists = window.advancedHelperFiles.some(f => f.fileName === fileName);
  if (exists) {
    alert('이미 추가된 파일입니다.');
    return;
  }
  
  window.advancedHelperFiles.push(fileData);
  updateAdvancedHelperFileList();
  
  document.getElementById('advancedFileName').value = '';
  document.getElementById('advancedFileUrl').value = '';
  
  console.log(\`파일 추가됨: \${fileName}\`);
};

window.copyAdvancedHelperResult = function() {
  if (!window.advancedHelperFiles || window.advancedHelperFiles.length === 0) {
    alert('추가된 파일이 없습니다.');
    return;
  }
  
  const result = JSON.stringify(window.advancedHelperFiles, null, 2);
  navigator.clipboard.writeText(result).then(() => {
    alert(\`✅ \${window.advancedHelperFiles.length}개 파일의 JSON 데이터가 클립보드에 복사되었습니다!\`);
    console.log('복사된 데이터:', result);
  }).catch(err => {
    console.error('클립보드 복사 실패:', err);
    alert('JSON 데이터가 복사되었습니다!');
  });
};

window.closeAdvancedHelper = function() {
  const helper = document.getElementById('advanced-file-extractor');
  if (helper) helper.remove();
};

window.autoDetectFiles = function() {
  console.log('🔍 자동 감지 시도 중...');
  const allText = document.body.textContent;
  const pngFiles = allText.match(/[a-f0-9]{8}\\.Photo\\s+\\d+\\.\\d+\\.png/gi);
  
  if (pngFiles && pngFiles.length > 0) {
    console.log(\`발견된 파일명: \${pngFiles.length}개\`);
    pngFiles.forEach(fileName => console.log(\`- \${fileName}\`));
    alert(\`자동으로 \${pngFiles.length}개의 파일명을 발견했습니다! 콘솔을 확인하세요.\`);
  } else {
    alert('자동 감지된 파일이 없습니다. 수동으로 입력해주세요.');
  }
};

window.updateAdvancedHelperFileList = function() {
  const fileListDiv = document.getElementById('advancedFileList');
  if (window.advancedHelperFiles && window.advancedHelperFiles.length > 0) {
    fileListDiv.innerHTML = window.advancedHelperFiles.map((file, index) => \`
      <div style="margin-bottom: 10px; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #4285f4;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <strong style="color: #333; font-size: 14px;">\${file.fileName}</strong><br>
            <small style="color: #666;">ID: \${file.fileId}</small>
          </div>
          <button onclick="removeFileFromAdvancedHelper(\${index})" style="background: #ea4335; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
        </div>
      </div>
    \`).join('');
  } else {
    fileListDiv.innerHTML = '<p style="margin: 0; color: #666; text-align: center;">추가된 파일이 여기에 표시됩니다...</p>';
  }
};

window.removeFileFromAdvancedHelper = function(index) {
  window.advancedHelperFiles.splice(index, 1);
  updateAdvancedHelperFileList();
};

console.log('✅ 고급 수동 입력 도우미가 생성되었습니다!');`}</pre>
                  </div>
                </div>

                {/* 방법 3: 디버깅 */}
                <div>
                  <h5 className="font-medium text-yellow-800 mb-1">방법 3: 디버깅 정보</h5>
                  <p className="text-sm text-yellow-700 mb-2">
                    문제 진단을 위한 디버깅 코드:
                  </p>
                  <div className="bg-yellow-100 rounded p-2 text-xs font-mono overflow-x-auto">
                    <pre>{`// 디버깅 정보 출력
console.log('페이지 구조 분석:');
console.log('총 요소 수:', document.querySelectorAll('*').length);
console.log('data-id 속성을 가진 요소:', document.querySelectorAll('[data-id]').length);
console.log('data-tooltip 속성을 가진 요소:', document.querySelectorAll('[data-tooltip]').length);
console.log('구글 드라이브 링크:', document.querySelectorAll('a[href*="/file/d/"]').length);

console.log('발견된 링크들:');
document.querySelectorAll('a[href*="/file/d/"]').forEach((link, index) => {
  if (index < 10) console.log(index + 1 + '.', link.href);
});

console.log('발견된 파일명들:');
const allText = document.body.textContent;
const pngFiles = allText.match(/[a-f0-9]{8}\\.Photo\\s+\\d+\\.\\d+\\.png/gi);
if (pngFiles) {
  pngFiles.slice(0, 10).forEach((file, index) => {
    console.log(index + 1 + '.', file);
  });
}`}</pre>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                <h5 className="font-medium text-red-900 mb-2">🚨 문제 해결 가이드</h5>
                <div className="text-sm text-red-800 space-y-2">
                  <p><strong>문제 1:</strong> &quot;추출된 파일: 0개&quot;가 나오는 경우</p>
                  <ul className="ml-4 list-disc space-y-1">
                    <li>페이지가 완전히 로딩될 때까지 기다리세요</li>
                    <li>구글 드라이브 폴더를 새로고침(F5) 후 다시 시도하세요</li>
                    <li>다른 브라우저(Chrome, Firefox, Edge)에서 시도해보세요</li>
                    <li>고급 수동 입력 도우미를 사용하세요</li>
                  </ul>
                  
                  <p><strong>문제 2:</strong> CORS 오류가 발생하는 경우</p>
                  <ul className="ml-4 list-disc space-y-1">
                    <li>이는 정상적인 현상입니다. 구글 드라이브의 보안 정책 때문입니다</li>
                    <li>파일 추출에는 영향을 주지 않습니다</li>
                    <li>오류 메시지를 무시하고 계속 진행하세요</li>
                  </ul>
                  
                  <p><strong>문제 3:</strong> 파일명이 감지되지 않는 경우</p>
                  <ul className="ml-4 list-disc space-y-1">
                    <li>파일명 패턴이 정확한지 확인하세요: <code className="bg-red-100 px-1 rounded">0f7f30a4.Photo 1.041046.png</code></li>
                    <li>파일이 실제로 폴더에 있는지 확인하세요</li>
                    <li>파일 공유 설정이 &quot;링크가 있는 모든 사용자&quot;로 되어 있는지 확인하세요</li>
                  </ul>
                  
                  <p><strong>최종 해결책:</strong> 모든 자동 방법이 실패하면</p>
                  <ul className="ml-4 list-disc space-y-1">
                    <li>각 파일을 우클릭 → &quot;링크 복사&quot; 또는 &quot;공유&quot; 사용</li>
                    <li>고급 수동 입력 도우미에서 파일명과 URL을 수동으로 입력</li>
                    <li>개별 마이그레이션 모드로 전환하여 파일별로 처리</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>주의:</strong> 구글 드라이브 이미지는 &quot;링크가 있는 모든 사용자&quot;로 공개 설정되어야 합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
