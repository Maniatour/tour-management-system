'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, VolumeX, GripVertical, X } from 'lucide-react'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import ReactCountryFlag from 'react-country-flag'

export default function GlobalAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    pauseTrack,
    resumeTrack,
    stopTrack,
    seekTo,
    setVolume,
    toggleMute,
    skipBackward,
    skipForward,
    resetToStart
  } = useAudioPlayer()

  const [position, setPosition] = useState({ x: 0, y: -80 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const playerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      // 화면 경계 내에서만 이동 가능
      const maxX = window.innerWidth - (playerRef.current?.offsetWidth || 400)
      const maxY = window.innerHeight - (playerRef.current?.offsetHeight || 100)
      
      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(0, newY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart])

  const handleMouseDown = (e: React.MouseEvent) => {
    // 드래그 핸들 영역에서만 드래그 허용
    if (!e.target || !(e.target as HTMLElement).closest('.drag-handle')) {
      return
    }
    
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  if (!currentTrack) {
    return null
  }

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

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div 
      ref={playerRef}
      className="fixed bg-white border border-gray-200 shadow-lg z-40 rounded-lg select-none"
      style={{
        left: position.x,
        bottom: Math.abs(position.y),
        width: '400px',
        maxWidth: '90vw'
      }}
    >
      <div className="px-3 py-2">
        {/* 드래그 핸들 */}
        <div 
          className="drag-handle flex items-center justify-center mb-1 pb-1 border-b border-gray-100 cursor-move hover:bg-gray-50 rounded-t-lg"
          onMouseDown={handleMouseDown}
        >
          <GripVertical className="w-3 h-3 text-gray-400" />
        </div>

        {/* 첫 번째 줄: 제목, 국기 아이콘, 닫기 버튼 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {currentTrack.title}
            </h3>
            <ReactCountryFlag
              countryCode={getLanguageFlag(null)} // 기본값으로 KR 사용
              svg
              style={{
                width: '16px',
                height: '12px',
                borderRadius: '2px'
              }}
            />
          </div>
          <button
            onClick={stopTrack}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 두 번째 줄: 플레이어 컨트롤 */}
        <div className="flex items-center space-x-3">
          {/* 컨트롤 버튼들 */}
          <div className="flex items-center space-x-1">
            <button
              onClick={resetToStart}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="처음으로"
            >
              <RotateCcw size={14} />
            </button>
            
            <button
              onClick={skipBackward}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="10초 뒤로"
            >
              <SkipBack size={14} />
            </button>
            
            <button
              onClick={isPlaying ? pauseTrack : resumeTrack}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              title={isPlaying ? '일시정지' : '재생'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            
            <button
              onClick={skipForward}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="10초 앞으로"
            >
              <SkipForward size={14} />
            </button>
          </div>

          {/* 시간 표시 */}
          <div className="text-xs text-gray-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* 볼륨 컨트롤 */}
          <div className="flex items-center space-x-1">
            <button
              onClick={toggleMute}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              title="볼륨 조절"
            />
          </div>
        </div>

        {/* 진행 바 */}
        <div className="mt-1">
          <div className="w-full bg-gray-200 rounded-full h-1 cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const clickX = e.clientX - rect.left
            const percentage = clickX / rect.width
            const newTime = percentage * duration
            seekTo(newTime)
          }}>
            <div
              className="bg-blue-600 h-1 rounded-full transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
