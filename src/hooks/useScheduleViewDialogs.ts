'use client'

import { useCallback, useState } from 'react'

export type ScheduleMessageModalType = 'success' | 'error'

export type ScheduleConfirmModalContent = {
  title: string
  message: string
  onConfirm: () => void
  buttonText: string
  buttonColor: string
}

export function useScheduleViewDialogs() {
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageModalContent, setMessageModalContent] = useState({
    title: '',
    message: '',
    type: 'success' as ScheduleMessageModalType,
  })
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmModalContent, setConfirmModalContent] = useState<ScheduleConfirmModalContent>({
    title: '',
    message: '',
    onConfirm: () => {},
    buttonText: '확인',
    buttonColor: 'bg-red-500 hover:bg-red-600',
  })

  const showMessage = useCallback(
    (title: string, message: string, type: ScheduleMessageModalType = 'success') => {
      setMessageModalContent({ title, message, type })
      setShowMessageModal(true)
    },
    [],
  )

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      buttonText = '확인',
      buttonColor = 'bg-red-500 hover:bg-red-600',
    ) => {
      setConfirmModalContent({ title, message, onConfirm, buttonText, buttonColor })
      setShowConfirmModal(true)
    },
    [],
  )

  return {
    showMessageModal,
    setShowMessageModal,
    messageModalContent,
    showConfirmModal,
    setShowConfirmModal,
    confirmModalContent,
    showMessage,
    showConfirm,
  }
}
