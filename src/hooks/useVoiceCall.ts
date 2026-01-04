'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'

interface UseVoiceCallProps {
  roomId: string
  userId: string
  userName: string
  isPublicView: boolean
  targetUserId?: string
  targetUserName?: string
}

export function useVoiceCall({ roomId, userId, userName, isPublicView, targetUserId, targetUserName }: UseVoiceCallProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [remoteAudio, setRemoteAudio] = useState<HTMLAudioElement | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null)
  const [callerName, setCallerName] = useState<string>('')
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Supabase Realtime 채널 구독
  useEffect(() => {
    if (!roomId) return

    const channel = supabase.channel(`voice-call-${roomId}`)
    
    // 통화 요청 수신
    channel.on('broadcast', { event: 'call-offer' }, (payload) => {
      const payloadData = payload.payload
      // 현재 사용자에게 보낸 통화 요청인지 확인 (to가 없거나 현재 userId와 일치)
      const isForMe = !payloadData.to || payloadData.to === userId
      if (payloadData.from !== userId && callStatus === 'idle' && isForMe) {
        setIncomingOffer(payloadData.offer)
        setCallerName(payloadData.userName || '상대방')
        setCallStatus('ringing')
      }
    })

    // 통화 수락 수신
    channel.on('broadcast', { event: 'call-answer' }, async (payload) => {
      if (payload.payload.from !== userId && callStatus === 'calling') {
        const answer = payload.payload.answer
        if (peerConnectionRef.current && answer) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
          setCallStatus('connected')
          startCallTimer()
        }
      }
    })

    // 통화 거절 수신
    channel.on('broadcast', { event: 'call-reject' }, (payload) => {
      if (payload.payload.from !== userId) {
        endCall()
      }
    })

    // 통화 종료 수신
    channel.on('broadcast', { event: 'call-end' }, (payload) => {
      if (payload.payload.from !== userId) {
        endCall()
      }
    })

    // ICE candidate 수신
    channel.on('broadcast', { event: 'ice-candidate' }, async (payload) => {
      if (payload.payload.from !== userId && peerConnectionRef.current) {
        const candidate = payload.payload.candidate
        if (candidate) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
        }
      }
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      endCall()
    }
  }, [roomId, userId, callStatus])

  // 통화 타이머 시작
  const startCallTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
    }
    
    setCallDuration(0)
    durationTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)
  }, [])

  // 통화 타이머 정지
  const stopCallTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    setCallDuration(0)
  }, [])

  // WebRTC PeerConnection 설정
  const setupPeerConnection = useCallback(async () => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }

    const pc = new RTCPeerConnection(configuration)
    peerConnectionRef.current = pc

    // 로컬 스트림 추가
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    // 원격 스트림 처리
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams
      remoteStreamRef.current = remoteStream
      
      // 오디오 요소에 연결
      const audio = new Audio()
      audio.srcObject = remoteStream
      audio.autoplay = true
      setRemoteAudio(audio)
    }

    // ICE candidate 전송
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: userId,
            candidate: event.candidate.toJSON()
          }
        })
      }
    }

    return pc
  }, [userId])

  // 통화 시작
  const startCall = useCallback(async () => {
    try {
      if (!targetUserId) {
        console.error('통화할 사용자가 선택되지 않았습니다.')
        return false
      }

      // 먼저 마이크 권한 요청 및 스트림 가져오기
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false 
        })
      } catch (mediaError: any) {
        console.error('Error getting user media:', mediaError)
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          throw new Error('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.')
        } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          throw new Error('마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.')
        } else {
          throw new Error('마이크에 접근할 수 없습니다. 브라우저 설정을 확인해주세요.')
        }
      }

      setCallStatus('calling')
      localStreamRef.current = stream
      setLocalStream(stream)

      // PeerConnection 설정
      const pc = await setupPeerConnection()

      // Offer 생성 및 전송
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'call-offer',
          payload: {
            from: userId,
            userName: userName,
            to: targetUserId, // 특정 사용자에게만 전송
            offer: offer.toJSON()
          }
        })
      }

      // 30초 후 자동 종료 (응답 없을 경우)
      if (callTimerRef.current) {
        clearTimeout(callTimerRef.current)
      }
      callTimerRef.current = setTimeout(() => {
        // 현재 상태를 확인하기 위해 함수형 업데이트 사용
        setCallStatus(currentStatus => {
          if (currentStatus === 'calling') {
            endCall()
          }
          return currentStatus
        })
      }, 30000)

      return true
    } catch (error: any) {
      console.error('Error starting call:', error)
      // 스트림이 이미 생성된 경우 정리
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
        setLocalStream(null)
      }
      setCallStatus('idle')
      throw error // 에러를 다시 throw하여 호출자가 처리할 수 있도록
    }
  }, [userId, userName, targetUserId, setupPeerConnection, callStatus, endCall])

  // 통화 수락
  const acceptCall = useCallback(async (offer: RTCSessionDescriptionInit) => {
    try {
      setCallStatus('connected')

      // 마이크 권한 요청 및 스트림 가져오기
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      })
      localStreamRef.current = stream
      setLocalStream(stream)

      // PeerConnection 설정
      const pc = await setupPeerConnection()

      // Offer 설정
      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      // Answer 생성 및 전송
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'call-answer',
          payload: {
            from: userId,
            userName: userName,
            answer: answer.toJSON()
          }
        })
      }

      startCallTimer()
    } catch (error) {
      console.error('Error accepting call:', error)
      alert('마이크 권한이 필요합니다.')
      setCallStatus('idle')
    }
  }, [userId, userName, setupPeerConnection, startCallTimer])

  // 통화 거절
  const rejectCall = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-reject',
        payload: {
          from: userId
        }
      })
    }
    setCallStatus('idle')
  }, [userId])

  // 통화 종료
  const endCall = useCallback(() => {
    // 스트림 정리
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
      setLocalStream(null)
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop())
      remoteStreamRef.current = null
    }

    if (remoteAudio) {
      remoteAudio.pause()
      remoteAudio.srcObject = null
      setRemoteAudio(null)
    }

    // PeerConnection 정리
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // 타이머 정리
    if (callTimerRef.current) {
      clearTimeout(callTimerRef.current)
      callTimerRef.current = null
    }
    stopCallTimer()

    // 종료 신호 전송
    if (channelRef.current && callStatus !== 'idle') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-end',
        payload: {
          from: userId
        }
      })
    }

    setCallStatus('idle')
  }, [userId, remoteAudio, callStatus, stopCallTimer])

  // 음소거 토글
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted
      })
      setIsMuted(!isMuted)
    }
  }, [isMuted])

  // 시간 포맷팅
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  // 들어오는 통화 수락 (offer 사용)
  const acceptIncomingCall = useCallback(async () => {
    if (incomingOffer) {
      await acceptCall(incomingOffer)
      setIncomingOffer(null)
    }
  }, [incomingOffer, acceptCall])

  return {
    callStatus,
    localStream,
    remoteAudio,
    isMuted,
    callDuration: formatDuration(callDuration),
    incomingOffer,
    callerName,
    startCall,
    acceptCall: acceptIncomingCall,
    rejectCall,
    endCall,
    toggleMute
  }
}

