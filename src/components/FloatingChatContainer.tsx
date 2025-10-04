'use client'

import React from 'react'
import { useFloatingChat } from '@/contexts/FloatingChatContext'
import FloatingChat from './FloatingChat'

export default function FloatingChatContainer() {
  const { openChats, closeChat } = useFloatingChat()

  return (
    <>
      {openChats.map((chatInfo, index) => (
        <FloatingChat
          key={chatInfo.id}
          chatInfo={chatInfo}
          onClose={closeChat}
          index={index}
        />
      ))}
    </>
  )
}
