'use client'

import { useState } from 'react'
import AudioPlayer from '@/components/AudioPlayer'

export default function AudioPlayerTestPage() {
  const [testFile, setTestFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      setTestFile(file)
      const url = URL.createObjectURL(file)
      setAudioUrl(url)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">오디오 플레이어 테스트</h1>
      
      <div className="space-y-6">
        {/* 파일 업로드 */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">테스트 파일 업로드</h2>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {testFile && (
            <p className="mt-2 text-sm text-gray-600">
              선택된 파일: {testFile.name} ({Math.round(testFile.size / 1024)}KB)
            </p>
          )}
        </div>

        {/* 오디오 플레이어 */}
        {audioUrl && testFile && (
          <div>
            <h2 className="font-semibold mb-2">오디오 플레이어</h2>
            <AudioPlayer
              src={audioUrl}
              title={testFile.name}
              audioDuration={undefined}
              className="w-full"
            />
          </div>
        )}

        {/* 사용법 안내 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">사용법</h2>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• MP3, WAV, M4A 등 오디오 파일을 업로드하세요</li>
            <li>• 재생/일시정지 버튼으로 오디오를 제어하세요</li>
            <li>• 진행 바를 클릭하여 원하는 위치로 이동하세요</li>
            <li>• 10초 뒤로/앞으로 버튼으로 빠르게 이동하세요</li>
            <li>• 볼륨 슬라이더로 음량을 조절하세요</li>
            <li>• 처음으로 버튼으로 처음부터 재생하세요</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
