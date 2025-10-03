'use client'

import React, { createContext, useContext, useState, useRef, useEffect } from 'react'

interface AudioTrack {
  src: string
  title: string
  duration?: number
}

interface AudioPlayerContextType {
  currentTrack: AudioTrack | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  playTrack: (track: AudioTrack) => void
  pauseTrack: () => void
  resumeTrack: () => void
  stopTrack: () => void
  seekTo: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  skipBackward: () => void
  skipForward: () => void
  resetToStart: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined)

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 오디오 요소 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio()
      audioRef.current.preload = 'metadata'
      
      const audio = audioRef.current
      
      // 이벤트 리스너 설정
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration || 0)
      })
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime)
      })
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
      })
      
      audio.addEventListener('play', () => {
        setIsPlaying(true)
      })
      
      audio.addEventListener('pause', () => {
        setIsPlaying(false)
      })
      
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e)
        setIsPlaying(false)
      })
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  const playTrack = (track: AudioTrack) => {
    if (!audioRef.current) return
    
    const audio = audioRef.current
    
    // 같은 트랙이면 재생/일시정지 토글
    if (currentTrack?.src === track.src) {
      if (isPlaying) {
        audio.pause()
      } else {
        audio.play()
      }
      return
    }
    
    // 새로운 트랙 설정
    setCurrentTrack(track)
    audio.src = track.src
    audio.currentTime = 0
    setCurrentTime(0)
    
    audio.play().catch(error => {
      console.error('Error playing audio:', error)
    })
  }

  const pauseTrack = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause()
    }
  }

  const resumeTrack = () => {
    if (audioRef.current && !isPlaying) {
      audioRef.current.play().catch(error => {
        console.error('Error resuming audio:', error)
      })
    }
  }

  const stopTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      setIsPlaying(false)
    }
    setCurrentTrack(null)
  }

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    setVolumeState(clampedVolume)
    setIsMuted(clampedVolume === 0)
    
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    
    const newMuted = !isMuted
    setIsMuted(newMuted)
    
    if (newMuted) {
      audioRef.current.volume = 0
    } else {
      audioRef.current.volume = volume
    }
  }

  const skipBackward = () => {
    if (audioRef.current) {
      const newTime = Math.max(0, audioRef.current.currentTime - 10)
      seekTo(newTime)
    }
  }

  const skipForward = () => {
    if (audioRef.current) {
      const newTime = Math.min(duration, audioRef.current.currentTime + 10)
      seekTo(newTime)
    }
  }

  const resetToStart = () => {
    seekTo(0)
  }

  const value: AudioPlayerContextType = {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playTrack,
    pauseTrack,
    resumeTrack,
    stopTrack,
    seekTo,
    setVolume,
    toggleMute,
    skipBackward,
    skipForward,
    resetToStart
  }

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider')
  }
  return context
}
