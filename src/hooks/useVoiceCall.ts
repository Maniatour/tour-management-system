'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'error'

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
  const [callError, setCallError] = useState<string | null>(null)
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
  const endCallRef = useRef<(() => void) | null>(null)

  // callStatus를 ref로 추적하여 stale closure 문제 방지
  const callStatusRef = useRef<CallStatus>('idle')
  useEffect(() => {
    callStatusRef.current = callStatus
  }, [callStatus])

  // Supabase Realtime 채널 구독
  useEffect(() => {
    if (!roomId) return

    const channel = supabase.channel(`voice-call-${roomId}`)
    
    // 통화 요청 수신
    channel.on('broadcast', { event: 'call-offer' }, (payload) => {
      try {
        const payloadData = payload.payload
        // 현재 사용자에게 보낸 통화 요청인지 확인 (to가 없거나 현재 userId와 일치)
        const isForMe = !payloadData.to || payloadData.to === userId
        if (payloadData.from !== userId && callStatusRef.current === 'idle' && isForMe) {
          // offer가 올바른 형태인지 확인
          if (payloadData.offer && payloadData.offer.type && payloadData.offer.sdp) {
            setIncomingOffer(payloadData.offer as RTCSessionDescriptionInit)
            setCallerName(payloadData.userName || '상대방')
            setCallStatus('ringing')
          } else {
            console.error('Invalid offer received:', payloadData.offer)
          }
        }
      } catch (error) {
        console.error('Error handling call-offer:', error)
      }
    })

    // 통화 수락 수신
    channel.on('broadcast', { event: 'call-answer' }, async (payload) => {
      try {
        if (payload.payload.from !== userId && callStatusRef.current === 'calling') {
          const answer = payload.payload.answer
          if (peerConnectionRef.current && answer && answer.type && answer.sdp) {
            const answerDescription = new RTCSessionDescription({
              type: answer.type as RTCSdpType,
              sdp: answer.sdp
            })
            await peerConnectionRef.current.setRemoteDescription(answerDescription)
            setCallStatus('connected')
            startCallTimer()
          } else {
            console.error('Invalid answer received:', answer)
          }
        }
      } catch (error) {
        console.error('Error handling call-answer:', error)
        setCallStatus('error')
        setCallError('통화 연결에 실패했습니다.')
      }
    })

    // 통화 거절 수신
    channel.on('broadcast', { event: 'call-reject' }, (payload) => {
      if (payload.payload.from !== userId) {
        endCallRef.current?.()
      }
    })

    // 통화 종료 수신
    channel.on('broadcast', { event: 'call-end' }, (payload) => {
      if (payload.payload.from !== userId) {
        endCallRef.current?.()
      }
    })

    // ICE candidate 수신
    channel.on('broadcast', { event: 'ice-candidate' }, async (payload) => {
      try {
        if (payload.payload.from !== userId && peerConnectionRef.current) {
          const candidate = payload.payload.candidate
          if (candidate && candidate.candidate) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate({
                candidate: candidate.candidate,
                sdpMLineIndex: candidate.sdpMLineIndex,
                sdpMid: candidate.sdpMid
              }))
            } catch (iceError) {
              // ICE candidate 추가 실패는 일반적으로 무시해도 됨 (이미 처리된 candidate일 수 있음)
              console.warn('Error adding ICE candidate:', iceError)
            }
          }
        }
      } catch (error) {
        console.error('Error handling ice-candidate:', error)
      }
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      // 컴포넌트 언마운트 시에만 endCall 호출
      if (callStatusRef.current !== 'idle') {
        endCallRef.current?.()
      }
    }
  }, [roomId, userId])

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

    // 연결 상태 모니터링
    pc.onconnectionstatechange = () => {
      console.log('PeerConnection state:', pc.connectionState)
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.error('PeerConnection failed or disconnected')
        if (callStatusRef.current === 'connected' || callStatusRef.current === 'calling') {
          setCallError('연결이 끊어졌습니다.')
          endCallRef.current?.()
        }
      }
    }

    // ICE 연결 상태 모니터링
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'failed') {
        console.error('ICE connection failed')
        setCallError('네트워크 연결에 실패했습니다.')
      }
    }

    // 원격 스트림 처리
    pc.ontrack = (event) => {
      console.log('Received remote track:', event)
      const [remoteStream] = event.streams
      remoteStreamRef.current = remoteStream
      
      // 오디오 요소에 연결
      const audio = new Audio()
      audio.srcObject = remoteStream
      audio.autoplay = true
      audio.onerror = (error) => {
        console.error('Audio playback error:', error)
      }
      setRemoteAudio(audio)
    }

    // ICE candidate 전송
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        console.log('Sending ICE candidate:', event.candidate)
        // candidate는 이미 객체 형태이므로 직접 사용
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: userId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid
            }
          }
        })
      } else if (!event.candidate) {
        console.log('All ICE candidates have been sent')
      }
    }

    return pc
  }, [userId])

  // 통화 시작
  const startCall = useCallback(async (overrideTargetUserId?: string, overrideTargetUserName?: string) => {
    try {
      const finalTargetUserId = overrideTargetUserId || targetUserId
      const finalTargetUserName = overrideTargetUserName || targetUserName
      
      if (!finalTargetUserId) {
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
        // offer는 이미 객체 형태이므로 직접 사용
        channelRef.current.send({
          type: 'broadcast',
          event: 'call-offer',
          payload: {
            from: userId,
            userName: userName,
            to: finalTargetUserId, // 특정 사용자에게만 전송
            offer: {
              type: offer.type,
              sdp: offer.sdp
            }
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
          if (currentStatus === 'calling' && endCallRef.current) {
            endCallRef.current()
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
      // 에러 상태로 설정하여 모달이 유지되도록 함
      setCallStatus('error')
      setCallError(error.message || '통화를 시작할 수 없습니다.')
      // 에러를 throw하지 않고 false를 반환하여 호출자가 처리할 수 있도록 함
      return false
    }
  }, [userId, userName, targetUserId, targetUserName, setupPeerConnection])

  // 통화 수락
  const acceptCall = useCallback(async (offer: RTCSessionDescriptionInit) => {
    try {
      if (!offer || !offer.sdp) {
        console.error('Invalid offer received')
        setCallStatus('idle')
        return
      }

      setCallStatus('connected')

      // 마이크 권한 요청 및 스트림 가져오기
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false 
        })
      } catch (mediaError: any) {
        console.error('Error getting user media:', mediaError)
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          alert('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.')
        } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          alert('마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.')
        } else {
          alert('마이크에 접근할 수 없습니다. 브라우저 설정을 확인해주세요.')
        }
        setCallStatus('idle')
        return
      }

      localStreamRef.current = stream
      setLocalStream(stream)

      // PeerConnection 설정
      const pc = await setupPeerConnection()

      // Offer 설정 - offer가 { type, sdp } 형태이므로 RTCSessionDescription으로 변환
      const offerDescription = new RTCSessionDescription({
        type: offer.type as RTCSdpType,
        sdp: offer.sdp
      })
      
      await pc.setRemoteDescription(offerDescription)

      // Answer 생성 및 전송
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      if (channelRef.current) {
        // answer는 이미 객체 형태이므로 직접 사용
        channelRef.current.send({
          type: 'broadcast',
          event: 'call-answer',
          payload: {
            from: userId,
            userName: userName,
            answer: {
              type: answer.type,
              sdp: answer.sdp
            }
          }
        })
      }

      startCallTimer()
    } catch (error: any) {
      console.error('Error accepting call:', error)
      // 스트림 정리
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
        setLocalStream(null)
      }
      // PeerConnection 정리
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      alert(error.message || '통화를 수락할 수 없습니다.')
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

  // endCall을 ref에 저장하여 startCall에서 사용할 수 있도록
  useEffect(() => {
    endCallRef.current = endCall
  }, [endCall])

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
    if (!incomingOffer) {
      console.error('No incoming offer to accept')
      setCallStatus('idle')
      return
    }
    
    // incomingOffer를 직접 사용 (이미 RTCSessionDescriptionInit 형태)
    try {
      await acceptCall(incomingOffer)
      // 성공적으로 수락한 후에만 incomingOffer를 null로 설정
      setIncomingOffer(null)
    } catch (error) {
      console.error('Error in acceptIncomingCall:', error)
      // 에러가 발생하면 상태를 idle로 설정
      setCallStatus('idle')
    }
  }, [incomingOffer, acceptCall])

  return {
    callStatus,
    callError,
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

