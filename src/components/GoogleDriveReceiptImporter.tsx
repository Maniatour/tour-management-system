'use client'

import { useState } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale } from 'next-intl'
import { Upload, Folder, CheckCircle, X, AlertCircle, Loader2 } from 'lucide-react'

interface GoogleDriveReceiptImporterProps {
  onImportComplete?: () => void
}

export default function GoogleDriveReceiptImporter({ onImportComplete }: GoogleDriveReceiptImporterProps) {
  const supabase = createClientSupabase()
  const { user, simulatedUser, isSimulating } = useAuth()
  const currentLocale = useLocale()
  
  const getText = (ko: string, en: string) => currentLocale === 'en' ? en : ko
  
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email

  const [folderId, setFolderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [receipts, setReceipts] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{
    processed: number
    total: number
    currentBatch: number
  } | null>(null)
  const [importResults, setImportResults] = useState<{
    success: number
    failed: number
    skipped: number
    errors: any[]
    skippedItems?: any[]
  } | null>(null)

  // 구글 드라이브 폴더에서 영수증 목록 가져오기
  const fetchReceiptsFromDrive = async () => {
    if (!folderId.trim()) {
      alert(getText('폴더 ID를 입력해주세요.', 'Please enter a folder ID.'))
      return
    }

    setLoadingList(true)
    setReceipts([])
    setImportResults(null)

    try {
      const response = await fetch(`/api/google-drive/receipts?folderId=${encodeURIComponent(folderId)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '영수증 목록을 가져오는데 실패했습니다.')
      }

      setReceipts(data.receipts || [])
    } catch (error: any) {
      console.error('영수증 목록 조회 오류:', error)
      alert(getText('영수증 목록을 가져오는데 실패했습니다.', 'Failed to fetch receipt list.') + '\n' + error.message)
    } finally {
      setLoadingList(false)
    }
  }

  // 선택한 영수증들을 Supabase로 가져오기
  const importReceipts = async (fileIds?: string[]) => {
    if (!folderId.trim()) {
      alert(getText('폴더 ID를 입력해주세요.', 'Please enter a folder ID.'))
      return
    }

    setImporting(true)
    setImportResults(null)

    try {
      let response
      
      if (fileIds && fileIds.length > 0) {
        // 선택한 파일들만 가져오기
        const results = []
        const errors = []

        for (const fileId of fileIds) {
          try {
            const file = receipts.find(r => r.fileId === fileId)
            const res = await fetch('/api/google-drive/receipts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fileId,
                expenseId: file?.expenseId,
                submittedBy: currentUserEmail,
              }),
            })

            const data = await res.json()

            if (data.success) {
              results.push({ fileName: file?.fileName, success: true })
            } else {
              errors.push({ fileName: file?.fileName, error: data.error })
            }

            // API 할당량 고려하여 약간의 지연
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error: any) {
            errors.push({ fileName: file?.fileName, error: error.message })
          }
        }

        setImportResults({
          success: results.length,
          failed: errors.length,
          skipped: 0,
          errors,
        })

        if (results.length > 0 && onImportComplete) {
          onImportComplete()
        }
      } else {
        // 전체 일괄 가져오기 (배치 처리)
        let totalSuccess = 0
        let totalFailed = 0
        let totalSkipped = 0
        const allErrors: any[] = []
        const allSkippedItems: any[] = []
        
        let skip = 0
        const batchSize = 20 // 한 번에 처리할 파일 수 (50 → 20으로 감소)
        let hasMore = true
        let batchNumber = 0
        let consecutiveTimeouts = 0
        const maxConsecutiveTimeouts = 3
        let totalFiles = receipts.length || 0 // 전체 파일 수 추적

        setImportProgress({
          processed: 0,
          total: totalFiles,
          currentBatch: 0,
        })

        while (hasMore) {
          batchNumber++
          setImportProgress(prev => prev ? {
            ...prev,
            currentBatch: batchNumber,
          } : null)

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 360000) // 6분 타임아웃 (4분 → 6분)

          try {
            response = await fetch('/api/google-drive/receipts', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                folderId,
                submittedBy: currentUserEmail,
                batchSize,
                skip,
              }),
              signal: controller.signal,
            })

            clearTimeout(timeoutId)
            consecutiveTimeouts = 0 // 성공하면 연속 타임아웃 카운터 리셋

            const data = await response.json()

            if (!response.ok) {
              throw new Error(data.error || '영수증 가져오기에 실패했습니다.')
            }

            // 결과 누적
            totalSuccess += data.summary?.success || 0
            totalFailed += data.summary?.failed || 0
            totalSkipped += data.summary?.skipped || 0
            if (data.errors) allErrors.push(...data.errors)
            if (data.skipped) allSkippedItems.push(...data.skipped)

            // 전체 파일 수 업데이트 (API에서 받은 값이 더 정확)
            if (data.pagination?.total) {
              totalFiles = data.pagination.total
            }

            // 진행 상황 업데이트
            setImportProgress(prev => prev ? {
              ...prev,
              processed: data.pagination?.processed || skip,
              total: totalFiles,
            } : null)

            // 다음 배치가 있는지 확인
            hasMore = data.pagination?.hasMore || false
            skip = data.pagination?.nextSkip || skip + batchSize

            // 중간 결과 표시 (배치가 많을 경우)
            if (batchNumber % 5 === 0) {
              setImportResults({
                success: totalSuccess,
                failed: totalFailed,
                skipped: totalSkipped,
                errors: allErrors.slice(-20), // 최근 20개만 표시
                skippedItems: allSkippedItems.slice(-10), // 최근 10개만 표시
              })
            }
          } catch (error: any) {
            clearTimeout(timeoutId)
            
            if (error.name === 'AbortError') {
              consecutiveTimeouts++
              
              // 연속 타임아웃이 너무 많으면 중단
              if (consecutiveTimeouts >= maxConsecutiveTimeouts) {
                throw new Error(
                  `연속 ${maxConsecutiveTimeouts}번 타임아웃이 발생했습니다. ` +
                  `네트워크 상태를 확인하고 잠시 후 다시 시도해주세요. ` +
                  `현재까지 처리된 파일: ${skip}개 (성공: ${totalSuccess}개, 실패: ${totalFailed}개)`
                )
              }
              
              // 타임아웃 발생해도 다음 배치 시도
              console.warn(`배치 ${batchNumber} 타임아웃 발생, 다음 배치 계속 진행...`)
              allErrors.push({
                fileName: `Batch ${batchNumber}`,
                error: `요청 시간 초과 (배치 ${skip} ~ ${skip + batchSize}개)`,
              })
              
              // 다음 배치로 진행
              skip += batchSize
              totalFailed += batchSize
              
              // 전체 파일 수 확인
              if (totalFiles > 0 && skip >= totalFiles) {
                hasMore = false
              }
              
              // 짧은 대기 후 다음 배치 또는 종료
              if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 2000))
                continue
              } else {
                break // 더 이상 처리할 파일이 없으면 종료
              }
            }
            
            throw error
          }

          // 배치 간 약간의 지연 (API 할당량 고려)
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        // 최종 결과 표시
        setImportResults({
          success: totalSuccess,
          failed: totalFailed,
          skipped: totalSkipped,
          errors: allErrors,
          skippedItems: allSkippedItems,
        })

        setImportProgress(null)

        if (totalSuccess > 0 && onImportComplete) {
          onImportComplete()
        }
      }
    } catch (error: any) {
      console.error('영수증 가져오기 오류:', error)
      alert(getText('영수증 가져오기에 실패했습니다.', 'Failed to import receipts.') + '\n' + error.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
          <Folder className="w-5 h-5 mr-2" />
          {getText('구글 드라이브 연동', 'Google Drive Integration')}
        </h3>
        <p className="text-sm text-blue-800 mb-4">
          {getText(
            '구글 드라이브에 있는 영수증 이미지를 Supabase로 가져옵니다. 파일명 형식은 "ID.Image.xxxxxx.jpg"여야 합니다.',
            'Import receipt images from Google Drive to Supabase. File names must be in the format "ID.Image.xxxxxx.jpg".'
          )}
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            placeholder={getText('구글 드라이브 폴더 ID 입력...', 'Enter Google Drive folder ID...')}
            className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={fetchReceiptsFromDrive}
            disabled={loadingList || !folderId.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loadingList ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {getText('조회 중...', 'Loading...')}
              </>
            ) : (
              <>
                <Folder className="w-4 h-4 mr-2" />
                {getText('목록 조회', 'List')}
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-blue-700 mt-2">
          💡 {getText(
            '구글 드라이브 폴더의 공유 링크에서 폴더 ID를 추출하세요. 예: https://drive.google.com/drive/folders/FOLDER_ID',
            'Extract folder ID from Google Drive folder share link. Example: https://drive.google.com/drive/folders/FOLDER_ID'
          )}
        </p>
      </div>

      {/* 영수증 목록 */}
      {receipts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-700">
              {getText('발견된 영수증', 'Found Receipts')}: {receipts.length}개
            </h4>
            <button
              onClick={() => importReceipts()}
              disabled={importing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {importProgress ? (
                  <span>
                    {getText('가져오는 중...', 'Importing...')} ({importProgress.processed}/{importProgress.total}, 배치 {importProgress.currentBatch})
                  </span>
                ) : (
                  getText('가져오는 중...', 'Importing...')
                )}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {getText('전체 가져오기', 'Import All')}
              </>
            )}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            <div className="divide-y">
              {receipts.map((receipt, index) => (
                <div
                  key={receipt.fileId}
                  className="p-3 hover:bg-gray-50 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {receipt.fileName}
                      </span>
                      {receipt.expenseId ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          {getText('Expense ID', 'Expense ID')}: {receipt.expenseId}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          {getText('ID 없음', 'No ID')}
                        </span>
                      )}
                    </div>
                    {receipt.modifiedTime && (
                      <p className="text-xs text-gray-500 mt-1">
                        {getText('수정일', 'Modified')}:{' '}
                        {new Date(receipt.modifiedTime).toLocaleString(currentLocale === 'en' ? 'en-US' : 'ko-KR')}
                      </p>
                    )}
                  </div>
                  {receipt.expenseId && (
                    <button
                      onClick={() => importReceipts([receipt.fileId])}
                      disabled={importing}
                      className="ml-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      {getText('가져오기', 'Import')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 진행 상황 표시 */}
      {importProgress && importing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              {getText('처리 중...', 'Processing...')}
            </span>
            <span className="text-sm text-blue-700">
              {Math.round((importProgress.processed / importProgress.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((importProgress.processed / importProgress.total) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-blue-700 mt-2">
            {importProgress.processed} / {importProgress.total} {getText('파일 처리됨', 'files processed')} 
            {importProgress.currentBatch > 0 && ` (배치 ${importProgress.currentBatch})`}
          </p>
        </div>
      )}

      {/* 가져오기 결과 */}
      {importResults && (
        <div className={`rounded-lg p-4 ${
          importResults.failed === 0
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {importResults.failed === 0 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
            <h4 className="font-semibold">
              {importResults.failed === 0
                ? getText('가져오기 완료', 'Import Complete')
                : getText('일부 실패', 'Partial Failure')}
            </h4>
          </div>
          <p className="text-sm mb-2">
            {getText('성공', 'Success')}: {importResults.success}개,{' '}
            {getText('실패', 'Failed')}: {importResults.failed}개
            {importResults.skipped > 0 && (
              <>, {getText('건너뜀', 'Skipped')}: {importResults.skipped}개</>
            )}
          </p>
          {importResults.errors.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium mb-1">{getText('오류 목록', 'Errors')}:</p>
              {importResults.errors.map((error: any, index: number) => (
                <div key={index} className="text-xs text-red-600 mb-1">
                  • {error.fileName || 'Unknown'}: {error.error || 'Unknown error'}
                </div>
              ))}
            </div>
          )}
          {importResults.skippedItems && importResults.skippedItems.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium mb-1 text-gray-600">
                {getText('건너뛴 항목 (이미 등록된 영수증)', 'Skipped Items (Already Imported)')}:
              </p>
              {importResults.skippedItems.slice(0, 10).map((item: any, index: number) => (
                <div key={index} className="text-xs text-gray-500 mb-1">
                  • {item.fileName || 'Unknown'}
                </div>
              ))}
              {importResults.skippedItems.length > 10 && (
                <div className="text-xs text-gray-400">
                  ... 외 {importResults.skippedItems.length - 10}개
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

