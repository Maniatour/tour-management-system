'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'

interface AudioPlayerProps {
  src: string
  title: string
  audioDuration?: number
  language?: string | null
  attraction?: string
  category?: string
  fileSize?: string
  className?: string
  isExpanded?: boolean
  onToggleExpanded?: () => void
}

export default function AudioPlayer({ 
  src, 
  title, 
  audioDuration, 
  language,
  attraction,
  category,
  fileSize,
  className = '',
  isExpanded = false,
  onToggleExpanded
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 오디오 메타데이터 로드
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const handleError = () => {
      setError('오디오 파일을 로드할 수 없습니다.')
      setIsLoading(false)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', handleCanPlay)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('canplay', handleCanPlay)
    }
  }, [src])

  // 재생/일시정지 토글
  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  // 시간 이동
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const newTime = parseFloat(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  // 볼륨 조절
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const newVolume = parseFloat(e.target.value)
    audio.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  // 음소거 토글
  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = volume
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }

  // 10초 뒤로
  const skipBackward = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = Math.max(0, audio.currentTime - 10)
  }

  // 10초 앞으로
  const skipForward = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10)
  }

  // 처음으로
  const resetToStart = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = 0
    setCurrentTime(0)
  }

  // 시간 포맷팅
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // 언어를 국기 아이콘으로 표시
  const getLanguageFlag = (language: string | null) => {
    switch (language?.toLowerCase()) {
      case 'ko':
        return 'KR'
      case 'en':
        return 'US'
      case 'ja':
        return 'JP'
      case 'zh':
        return 'CN'
      default:
        return 'KR'
    }
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-red-600">
          <VolumeX className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* 아코디언 헤더 */}
      <div className="p-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* 재생/일시정지 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                togglePlayPause()
              }}
              disabled={isLoading}
              className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {isLoading ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
            </button>
            
            {/* 제목 영역 */}
            <div 
              className="flex items-center space-x-2 flex-1 min-w-0 cursor-pointer"
              onClick={onToggleExpanded}
            >
              <h4 className="font-medium text-gray-900 text-sm truncate">{title}</h4>
              <ReactCountryFlag
                countryCode={getLanguageFlag(language)}
                svg
                style={{
                  width: '20px',
                  height: '15px',
                  borderRadius: '2px'
                }}
              />
            </div>
          </div>
          
          {/* 아코디언 화살표 */}
          <div 
            className="ml-2 cursor-pointer flex items-center space-x-2"
            onClick={onToggleExpanded}
          >
            <span className="text-xs text-gray-500">
              {formatTime(duration)}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* 아코디언 콘텐츠 */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-gray-100">
          <div className="pt-3 space-y-3">
            {/* 뱃지들 */}
            <div className="flex flex-wrap gap-1">
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                {attraction}
              </span>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                {category}
              </span>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                {fileSize}
              </span>
            </div>

            {/* 진행 바 */}
            <div>
              <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                disabled={isLoading}
              />
            </div>

            {/* 컨트롤 버튼들 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                {/* 10초 뒤로 */}
                <button
                  onClick={skipBackward}
                  disabled={isLoading}
                  className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <SkipBack className="w-3 h-3" />
                </button>

                {/* 처음으로 */}
                <button
                  onClick={resetToStart}
                  disabled={isLoading}
                  className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>

                {/* 10초 앞으로 */}
                <button
                  onClick={skipForward}
                  disabled={isLoading}
                  className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <SkipForward className="w-3 h-3" />
                </button>
              </div>

              {/* 볼륨 컨트롤 */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={toggleMute}
                  disabled={isLoading}
                  className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-12 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 스타일 */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  )
}
