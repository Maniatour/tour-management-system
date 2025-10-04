'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface ChatRoomInfo {
  id: string // 유니크 식별자
  tourId: string
  tourDate: string
  guideEmail: string
  tourName?: string
}

interface FloatingChatContextType {
  openChats: ChatRoomInfo[]
  openChat: (chatInfo: ChatRoomInfo) => void
  closeChat: (chatRoomId: string) => void
  closeAllChats: () => void
  isChatOpen: (chatRoomId: string) => boolean
}

const FloatingChatContext = createContext<FloatingChatContextType | undefined>(undefined)

interface FloatingChatProviderProps {
  children: ReactNode
}

export function FloatingChatProvider({ children }: FloatingChatProviderProps) {
  const [openChats, setOpenChats] = useState<ChatRoomInfo[]>([])

  const openChat = (chatInfo: ChatRoomInfo) => {
    // 이미 열려있는 채팅인지 확인
    const existingIndex = openChats.findIndex(chat => chat.tourId === chatInfo.tourId)
    
    if (existingIndex >= 0) {
      // 이미 열려있으면 맨 앞으로 이동 (최신 순으로)
      const updatedChats = [
        ...openChats.slice(0, existingIndex),
        ...openChats.slice(existingIndex + 1),
        chatInfo
      ]
      setOpenChats(updatedChats)
    } else {
      // 새 채팅 추가 (최대 5개까지)
      if (openChats.length >= 5) {
        // 가장 오래된 채팅 제거
        setOpenChats([...openChats.slice(1), chatInfo])
      } else {
        setOpenChats([...openChats, chatInfo])
      }
    }
  }

  const closeChat = (chatRoomId: string) => {
    setOpenChats(openChats.filter(chat => chat.id !== chatRoomId))
  }

  const closeAllChats = () => {
    setOpenChats([])
  }

  const isChatOpen = (chatRoomId: string) => {
    return openChats.some(chat => chat.id === chatRoomId)
  }

  return (
    <FloatingChatContext.Provider
      value={{
        openChats,
        openChat,
        closeChat,
        closeAllChats,
        isChatOpen,
      }}
    >
      {children}
    </FloatingChatContext.Provider>
  )
}

export function useFloatingChat() {
  const context = useContext(FloatingChatContext)
  if (context === undefined) {
    throw new Error('useFloatingChat must be used within a FloatingChatProvider')
  }
  return context
}
