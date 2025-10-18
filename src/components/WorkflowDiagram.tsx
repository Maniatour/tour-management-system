'use client'

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import LightRichEditor from './LightRichEditor'
import { 
  ArrowRight,
  ArrowLeft,
  X,
  Copy,
  Save,
  Plus,
  Trash2,
  Edit,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react'

// UUID 생성 함수
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

interface WorkflowStep {
  id: string
  step_name_ko: string
  step_name_en: string
  step_description_ko?: string
  step_description_en?: string
  step_order: number
  step_type: 'action' | 'decision' | 'condition' | 'template' | 'manual' | 'start' | 'end'
  action_type?: string
  condition_type?: string
  condition_value?: string
  next_step_id?: string
  alternative_step_id?: string
  // 다중 연결 지원
  connections?: Array<{
    id: string
    target_step_id: string
    label: string
    type: 'success' | 'failure' | 'conditional' | 'default'
    condition?: string
  }>
  is_active: boolean
  is_required: boolean
  node_shape?: 'rectangle' | 'rounded' | 'diamond' | 'oval' | 'circle'
  node_color?: string
  text_color?: string
  group_id?: string
  position?: { x: number; y: number }
  // 고급 편집 필드들
  links?: Array<{ title: string; url: string; description?: string }>
  images?: Array<{ url: string; alt: string; caption?: string }>
  notes_ko?: string
  notes_en?: string
  tags?: string[]
  priority?: 'low' | 'medium' | 'high'
  estimated_time?: number // 분 단위
  // 리치 텍스트 설명
  rich_description_ko?: string
  rich_description_en?: string
}



interface WorkflowDiagramProps {
  steps: WorkflowStep[]
  workflowName?: string
  workflowId?: string
  onClose?: () => void
  mode?: 'diagram' | 'manual' | 'edit'
  onSave?: (data: { 
    steps: WorkflowStep[]
    zoom: number
    backgroundSize: { width: number; height: number }
    nodeSize: { width: number; height: number }
    panelPosition: { x: number; y: number }
  }) => void
  initialSettings?: {
    zoom?: number
    backgroundSize?: { width: number; height: number }
    nodeSize?: { width: number; height: number }
    panelPosition?: { x: number; y: number }
  }
}

// 노드 타입별 기본 스타일 정의
const getDefaultNodeStyle = (stepType: string, nodeShape?: string) => {
  const baseStyle = {
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'center' as const,
    cursor: 'pointer',
    minWidth: '120px',
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid',
    color: '#1f2937',
  }

  // 도형별 기본 스타일
  let shapeStyle = {}
  switch (nodeShape) {
    case 'oval':
      shapeStyle = {
        borderRadius: '50px',
        width: '140px',
        height: '60px',
      }
      break
    case 'rounded':
      shapeStyle = {
        borderRadius: '12px',
        width: '120px',
        height: '60px',
      }
      break
    case 'diamond':
      shapeStyle = {
        width: '120px',
        height: '60px',
        transform: 'rotate(45deg)',
        borderRadius: '8px',
      }
      break
    case 'circle':
      shapeStyle = {
        borderRadius: '50%',
        width: '80px',
        height: '80px',
      }
      break
    default: // rectangle
      shapeStyle = {
        borderRadius: '4px',
        width: '120px',
        height: '60px',
      }
  }

  // 타입별 색상
  let colorStyle = {}
  switch (stepType) {
    case 'start':
      colorStyle = {
        backgroundColor: '#f0f9ff',
        borderColor: '#0ea5e9',
        color: '#0c4a6e',
      }
      break
    case 'end':
      colorStyle = {
        backgroundColor: '#fef2f2',
        borderColor: '#ef4444',
        color: '#991b1b',
      }
      break
    case 'action':
      colorStyle = {
        backgroundColor: '#f0f9ff',
        borderColor: '#0ea5e9',
        color: '#0c4a6e',
      }
      break
    case 'condition':
      colorStyle = {
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        color: '#92400e',
      }
      break
    case 'decision':
      colorStyle = {
        backgroundColor: '#f3e8ff',
        borderColor: '#8b5cf6',
        color: '#5b21b6',
      }
      break
    case 'template':
      colorStyle = {
        backgroundColor: '#ecfdf5',
        borderColor: '#10b981',
        color: '#064e3b',
      }
      break
    case 'manual':
      colorStyle = {
        backgroundColor: '#fef2f2',
        borderColor: '#ef4444',
        color: '#991b1b',
      }
      break
    default:
      colorStyle = {
        backgroundColor: '#f9fafb',
        borderColor: '#6b7280',
        color: '#374151',
      }
  }

  return { ...baseStyle, ...shapeStyle, ...colorStyle }
}

// SVG 노드 컴포넌트
const SVGNode = ({ 
  step, 
  x, 
  y, 
  isSelected, 
  onClick, 
  onDoubleClick,
  onMouseDown,
  isDragging,
  nodeSize
}: {
  step: WorkflowStep
  x: number
  y: number
  isSelected: boolean
  onClick?: (step: WorkflowStep) => void
  onDoubleClick?: (step: WorkflowStep) => void
  onMouseDown?: (step: WorkflowStep, e: React.MouseEvent) => void
  isDragging?: boolean
  nodeSize: { width: number; height: number }
}) => {
  const nodeStyle = getDefaultNodeStyle(step.step_type, step.node_shape)
  
  const customStyle = {
    backgroundColor: step.node_color || (nodeStyle as unknown as { backgroundColor: string }).backgroundColor,
    borderColor: step.node_color || (nodeStyle as unknown as { borderColor: string }).borderColor,
    color: step.text_color || (nodeStyle as unknown as { color: string }).color,
  }

  const handleClick = () => {
    onClick?.(step)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDoubleClick?.(step, e)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onMouseDown?.(step, e)
  }

  const width = nodeSize.width
  const height = nodeSize.height

  return (
    <g>
      {/* 노드 배경 */}
      {step.node_shape === 'diamond' ? (
        <polygon
          points={`${x},${y-height/2} ${x+width/2},${y} ${x},${y+height/2} ${x-width/2},${y}`}
          fill={customStyle.backgroundColor}
          stroke={customStyle.borderColor}
          strokeWidth="2"
          className={`cursor-pointer hover:opacity-80 transition-opacity ${isDragging ? 'opacity-50' : ''}`}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
        />
      ) : (
        <rect
          x={x - width/2}
          y={y - height/2}
          width={width}
          height={height}
          rx={step.node_shape === 'rounded' ? 12 : step.node_shape === 'oval' ? height/2 : 4}
          fill={customStyle.backgroundColor}
          stroke={customStyle.borderColor}
          strokeWidth="2"
          className={`cursor-pointer hover:opacity-80 transition-opacity ${isDragging ? 'opacity-50' : ''}`}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
        />
      )}
      
      {/* 선택 표시 */}
      {isSelected && (
        <>
          {/* 선택된 박스 배경 */}
          <rect
            x={x - width/2}
            y={y - height/2}
            width={width}
            height={height}
            rx={step.node_shape === 'rounded' ? 12 : step.node_shape === 'oval' ? height/2 : 4}
            fill="rgba(239, 68, 68, 0.2)"
            stroke="none"
          />
          {/* 선택된 박스 테두리 */}
          <rect
            x={x - width/2 - 4}
            y={y - height/2 - 4}
            width={width + 8}
            height={height + 8}
            rx={step.node_shape === 'rounded' ? 16 : step.node_shape === 'oval' ? (height+8)/2 : 8}
            fill="none"
            stroke="#ef4444"
            strokeWidth="3"
            className="animate-pulse"
          />
        </>
      )}
      
      {/* 텍스트 */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="600"
        fill={customStyle.color}
        className="pointer-events-none"
      >
        {step.step_name_ko}
      </text>
      
      {/* 편집 버튼들 제거됨 */}
    </g>
  )
}

export default function WorkflowDiagram({ steps, workflowName, workflowId, onClose, mode = 'diagram', onSave, initialSettings }: WorkflowDiagramProps) {
  console.log('WorkflowDiagram rendered with mode:', mode)
  
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
  const [showStepDetail, setShowStepDetail] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [localSteps, setLocalSteps] = useState<WorkflowStep[]>(steps)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(initialSettings?.zoom || 1)
  const [backgroundSize, setBackgroundSize] = useState(initialSettings?.backgroundSize || { width: 1200, height: 900 })
  const [isResizingBackground, setIsResizingBackground] = useState(false)
  const [nodeSize, setNodeSize] = useState(initialSettings?.nodeSize || { width: 120, height: 60 })
  const [editingConnection, setEditingConnection] = useState<string | null>(null)
  const [connectionLabel, setConnectionLabel] = useState('')
  const [copiedNodes, setCopiedNodes] = useState<WorkflowStep[]>([])
  const [history, setHistory] = useState<WorkflowStep[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isDoubleClick, setIsDoubleClick] = useState(false)
  const [accordionOpen, setAccordionOpen] = useState({
    boxSize: true,
    zoom: false,
    backgroundSize: false,
    editTools: true,
    selectedNode: true
  })

  // 노드 위치 계산
  const nodePositions = useMemo(() => {
    const sortedSteps = [...localSteps].sort((a, b) => a.step_order - b.step_order)
    const positions: { [key: string]: { x: number; y: number } } = {}
    
    sortedSteps.forEach((step, index) => {
      positions[step.id] = step.position || {
        x: (index % 3) * 200 + 150,
        y: Math.floor(index / 3) * 150 + 100,
      }
    })
    
    return positions
  }, [localSteps])

  // 연결선 계산
  const connections = useMemo(() => {
    const sortedSteps = [...localSteps].sort((a, b) => a.step_order - b.step_order)
    const connections: Array<{
      id: string
      from: { x: number; y: number }
      to: { x: number; y: number }
      type: 'success' | 'failure' | 'conditional' | 'default'
      label: string
      condition?: string
    }> = []
    
    sortedSteps.forEach((step) => {
      const fromPos = nodePositions[step.id]
      if (!fromPos) return
      
      // 다중 연결 처리
      if (step.connections && step.connections.length > 0) {
        step.connections.forEach((connection) => {
          const toPos = nodePositions[connection.target_step_id]
          if (toPos) {
            connections.push({
              id: connection.id,
              from: fromPos,
              to: toPos,
              type: connection.type,
              label: connection.label,
              ...(connection.condition && { condition: connection.condition })
            })
          }
        })
      } else {
        // 기존 단일 연결 방식 (하위 호환성)
        // 다음 단계로의 연결
        if (step.next_step_id) {
          const toPos = nodePositions[step.next_step_id]
          if (toPos) {
            connections.push({
              id: `${step.id}-${step.next_step_id}`,
              from: fromPos,
              to: toPos,
              type: 'success',
              label: 'YES'
            })
          }
        }
        
        // 대안 단계로의 연결
        if (step.alternative_step_id) {
          const toPos = nodePositions[step.alternative_step_id]
          if (toPos) {
            connections.push({
              id: `${step.id}-alt-${step.alternative_step_id}`,
              from: fromPos,
              to: toPos,
              type: 'failure',
              label: 'NO'
            })
          }
        }
      }
    })
    
    return connections
  }, [localSteps, nodePositions])

  // 노드 클릭 핸들러 (한 번 클릭 - 선택)
  const handleNodeClick = useCallback((step: WorkflowStep) => {
    console.log('Node clicked:', step.step_name_ko, 'mode:', mode, 'isDoubleClick:', isDoubleClick)
    
    if (isDoubleClick) {
      setIsDoubleClick(false)
      return
    }
    
    if (mode === 'edit') {
      const isCurrentlySelected = selectedNodes.includes(step.id)
      console.log('Currently selected:', isCurrentlySelected, 'selectedNodes:', selectedNodes)
      
      setSelectedNodes(prev => 
        isCurrentlySelected
          ? prev.filter(id => id !== step.id)
          : [...prev, step.id]
      )
      // 선택 해제 시에는 selectedStep도 null로 설정
      if (isCurrentlySelected) {
        setSelectedStep(null)
      } else {
        setSelectedStep(step)
      }
    } else {
      setSelectedStep(step)
      setShowStepDetail(true)
    }
  }, [mode, selectedNodes, isDoubleClick])

  // 노드 더블클릭 핸들러 (두 번 클릭 - 편집)
  const handleNodeDoubleClick = useCallback((step: WorkflowStep, e: React.MouseEvent) => {
    console.log('Node double clicked:', step.step_name_ko, 'mode:', mode)
    e.preventDefault()
    e.stopPropagation()
    setIsDoubleClick(true)
    setEditingStep(step)
    setShowEditModal(true)
  }, [mode])

  // 드래그 시작 핸들러
  const handleMouseDown = useCallback((step: WorkflowStep, e: React.MouseEvent) => {
    if (mode === 'edit') {
      setDraggedNode(step.id)
      // SVG 컨테이너를 찾아서 좌표 계산
      const svgElement = (e.target as SVGElement).closest('svg')
      if (svgElement) {
        const svgRect = svgElement.getBoundingClientRect()
        const nodePosition = nodePositions[step.id]
        setDragOffset({
          x: e.clientX - svgRect.left - nodePosition.x,
          y: e.clientY - svgRect.top - nodePosition.y
        })
      }
    }
  }, [mode, nodePositions])

  // 드래그 중 핸들러
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggedNode && mode === 'edit') {
      const svgRect = (e.currentTarget as SVGElement).getBoundingClientRect()
      const newX = e.clientX - svgRect.left - dragOffset.x
      const newY = e.clientY - svgRect.top - dragOffset.y
      
      setLocalSteps(prev => 
        prev.map(step => 
          step.id === draggedNode 
            ? { ...step, position: { x: newX, y: newY } }
            : step
        )
      )
    }
  }, [draggedNode, mode, dragOffset])


  // 드래그 종료 핸들러
  const handleMouseUp = useCallback(() => {
    if (draggedNode) {
      setDraggedNode(null)
      setDragOffset({ x: 0, y: 0 })
      // 드래그 완료 시 히스토리 저장은 나중에 처리
    }
  }, [draggedNode])

  // 줌 핸들러들
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.1, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.1, 0.1))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoom(1)
  }, [])

  // 배경 리사이즈 핸들러들
  const handleBackgroundResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingBackground(true)
  }, [])

  const handleBackgroundResizeMove = useCallback((e: MouseEvent) => {
    if (isResizingBackground) {
      const newWidth = Math.max(400, e.clientX - 200)
      const newHeight = Math.max(300, e.clientY - 200)
      setBackgroundSize({ width: newWidth, height: newHeight })
    }
  }, [isResizingBackground])

  const handleBackgroundResizeEnd = useCallback(() => {
    setIsResizingBackground(false)
  }, [])

  // 배경 리사이즈 이벤트 리스너 등록
  React.useEffect(() => {
    if (isResizingBackground) {
      document.addEventListener('mousemove', handleBackgroundResizeMove)
      document.addEventListener('mouseup', handleBackgroundResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleBackgroundResizeMove)
        document.removeEventListener('mouseup', handleBackgroundResizeEnd)
      }
    }
    return undefined
  }, [isResizingBackground, handleBackgroundResizeMove, handleBackgroundResizeEnd])

  // 노드 복사 핸들러 제거됨 (사용하지 않음)

  // 노드 상세보기 핸들러 제거됨 (클릭으로 대체)

  // 히스토리에 현재 상태 저장
  const saveToHistory = useCallback((steps: WorkflowStep[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push([...steps])
    
    // 히스토리 크기 제한 (최대 50개)
    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      setHistoryIndex(historyIndex + 1)
    }
    
    setHistory(newHistory)
  }, [history, historyIndex])

  // 실행 취소 (Undo)
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setLocalSteps([...history[newIndex]])
    }
  }, [historyIndex, history])

  // 다시 실행 (Redo)
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setLocalSteps([...history[newIndex]])
    }
  }, [historyIndex, history])

  // 초기 히스토리 설정
  useEffect(() => {
    if (history.length === 0) {
      saveToHistory(localSteps)
    }
  }, [localSteps, history.length, saveToHistory])

  // 드래그 완료 시 히스토리 저장
  useEffect(() => {
    if (!draggedNode && history.length > 0) {
      // 드래그가 완료되었을 때 히스토리 저장
      const timeoutId = setTimeout(() => {
        saveToHistory(localSteps)
      }, 100) // 100ms 지연으로 중복 저장 방지
      
      return () => clearTimeout(timeoutId)
    }
    return undefined
  }, [draggedNode, localSteps, saveToHistory, history.length])

  // 성공 연결 추가 기능
  const addSuccessConnection = useCallback(() => {
    if (selectedNodes.length < 2) {
      alert(`연결하려면 최소 2개의 박스를 선택해주세요. (현재 선택된 박스: ${selectedNodes.length}개)`)
      return
    }
    
    const [sourceId, targetId] = selectedNodes.slice(0, 2)
    const updatedSteps = localSteps.map(step => 
      step.id === sourceId 
        ? { ...step, next_step_id: targetId }
        : step
    )
    setLocalSteps(updatedSteps)
    setSelectedNodes([])
    saveToHistory(updatedSteps)
  }, [selectedNodes, localSteps, saveToHistory])

  // 실패 연결 추가 기능
  const addFailureConnection = useCallback(() => {
    if (selectedNodes.length < 2) {
      alert(`연결하려면 최소 2개의 박스를 선택해주세요. (현재 선택된 박스: ${selectedNodes.length}개)`)
      return
    }
    
    const [sourceId, targetId] = selectedNodes.slice(0, 2)
    const updatedSteps = localSteps.map(step => 
      step.id === sourceId 
        ? { ...step, alternative_step_id: targetId }
        : step
    )
    setLocalSteps(updatedSteps)
    setSelectedNodes([])
    saveToHistory(updatedSteps)
  }, [selectedNodes, localSteps, saveToHistory])

  // 다중 연결 추가 기능
  const addConnection = useCallback((fromStepId: string, toStepId: string, label: string = '연결', type: 'success' | 'failure' | 'conditional' | 'default' = 'default') => {
    const connectionId = generateUUID()
    
    const updatedSteps = localSteps.map(step => {
      if (step.id === fromStepId) {
        const connections = step.connections || []
        return {
          ...step,
          connections: [...connections, {
            id: connectionId,
            target_step_id: toStepId,
            label,
            type
          }]
        }
      }
      return step
    })
    
    setLocalSteps(updatedSteps)
    saveToHistory(updatedSteps)
  }, [localSteps, saveToHistory])

  // 복사 기능
  const copySelectedNodes = useCallback(() => {
    if (selectedNodes.length === 0) {
      alert('복사할 박스를 선택해주세요.')
      return
    }
    
    const nodesToCopy = localSteps.filter(step => selectedNodes.includes(step.id))
    setCopiedNodes(nodesToCopy)
    alert(`${nodesToCopy.length}개 박스가 복사되었습니다.`)
  }, [selectedNodes, localSteps])

  // 붙여넣기 기능
  const pasteNodes = useCallback(() => {
    if (copiedNodes.length === 0) {
      alert('복사된 박스가 없습니다.')
      return
    }
    
    const newNodes = copiedNodes.map(node => ({
      ...node,
      id: generateUUID(),
      step_name_ko: `${node.step_name_ko} (복사본)`,
      step_name_en: `${node.step_name_en} (Copy)`,
      position: {
        x: (node.position?.x || 0) + 50,
        y: (node.position?.y || 0) + 50
      }
    }))
    
    const newSteps = [...localSteps, ...newNodes]
    setLocalSteps(newSteps)
    setSelectedNodes(newNodes.map(node => node.id))
    saveToHistory(newSteps)
    alert(`${newNodes.length}개 박스가 붙여넣기되었습니다.`)
  }, [copiedNodes, localSteps, saveToHistory])

  // 연결 라벨 편집 시작
  const startEditingConnection = useCallback((connectionId: string, currentLabel: string) => {
    setEditingConnection(connectionId)
    setConnectionLabel(currentLabel)
  }, [])

  // 연결 라벨 편집 완료
  const finishEditingConnection = useCallback(() => {
    if (!editingConnection) return
    
    const updatedSteps = localSteps.map(step => {
      if (step.connections) {
        return {
          ...step,
          connections: step.connections.map(conn => 
            conn.id === editingConnection 
              ? { ...conn, label: connectionLabel }
              : conn
          )
        }
      }
      return step
    })
    
    setLocalSteps(updatedSteps)
    saveToHistory(updatedSteps)
    setEditingConnection(null)
    setConnectionLabel('')
  }, [editingConnection, connectionLabel, localSteps, saveToHistory])

  // 연결 라벨 편집 취소
  const cancelEditingConnection = useCallback(() => {
    setEditingConnection(null)
    setConnectionLabel('')
  }, [])

  // 특정 연결 삭제 기능 (향후 사용 예정)
  // const removeSpecificConnection = useCallback((fromStepId: string, connectionId: string) => {
  //   setLocalSteps(prev => prev.map(step => {
  //     if (step.id === fromStepId) {
  //       return {
  //         ...step,
  //         connections: step.connections?.filter(conn => conn.id !== connectionId) || []
  //       }
  //     }
  //     return step
  //   }))
  // }, [])

  // 연결 해제 기능
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeConnection = useCallback(() => {
    if (selectedNodes.length !== 1) {
      alert(`연결을 해제하려면 1개의 박스만 선택해주세요. (현재 선택된 박스: ${selectedNodes.length}개)`)
      return
    }
    
    const nodeId = selectedNodes[0]
    const step = localSteps.find(s => s.id === nodeId)
    if (!step) return
    
    const hasConnections = step.next_step_id || step.alternative_step_id || (step.connections && step.connections.length > 0)
    if (!hasConnections) {
      alert('이 박스에는 연결된 다른 박스가 없습니다.')
      return
    }
    
    if (confirm(`"${step.step_name_ko}" 박스의 모든 연결을 해제하시겠습니까?`)) {
      setLocalSteps(prev => 
        prev.map(s => {
          if (s.id === nodeId) {
            // 다중 연결과 기존 단일 연결 모두 제거
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { next_step_id: _next_step_id, alternative_step_id: _alternative_step_id, connections: _connections, ...rest } = s
            return rest
          }
          return s
        })
      )
      setSelectedNodes([])
    }
  }, [selectedNodes, localSteps])

  // 노드 추가 기능
  const addNewNode = useCallback(() => {
    const newNodeId = generateUUID()
    const newStep: WorkflowStep = {
      id: newNodeId,
      step_name_ko: '새 단계',
      step_name_en: 'New Step',
      step_description_ko: '새로운 단계입니다',
      step_description_en: 'This is a new step',
      step_order: localSteps.length + 1,
      step_type: 'action',
      is_active: true,
      is_required: false,
      node_shape: 'rectangle',
      node_color: '#3b82f6',
      text_color: '#ffffff',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100,
      }
    }
    
    const newSteps = [...localSteps, newStep]
    setLocalSteps(newSteps)
    saveToHistory(newSteps)
  }, [localSteps, saveToHistory])

  const handleSave = async () => {
    try {
      console.log('워크플로우 저장 시작:', {
        stepsCount: localSteps.length,
        steps: localSteps.map(step => ({
          id: step.id,
          step_name_ko: step.step_name_ko,
          rich_description_ko_length: step.rich_description_ko?.length || 0,
          rich_description_en_length: step.rich_description_en?.length || 0
        }))
      })
      
    if (onSave) {
      onSave({
        steps: localSteps,
        zoom,
        backgroundSize,
        nodeSize,
          panelPosition: { x: 16, y: 16 }
        })
      }
      
      // 모든 단계를 데이터베이스에 저장
      const savePromises = localSteps.map(async (step) => {
        console.log('단계 저장 중:', step.id, {
          rich_description_ko: step.rich_description_ko,
          rich_description_en: step.rich_description_en
        })
        
        const response = await fetch('/api/workflow-steps', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(step),
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('저장 실패:', step.id, errorText)
          throw new Error(`Failed to save step ${step.id}: ${errorText}`)
        }
        
        const result = await response.json()
        console.log('단계 저장 성공:', step.id, result)
        return result
      })
      
      await Promise.all(savePromises)
      console.log('모든 단계 저장 완료')
      
    } catch (error) {
      console.error('워크플로우 저장 오류:', error)
      alert('워크플로우 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  const handleStepUpdate = useCallback(async (updatedStep: WorkflowStep) => {
    try {
      console.log('단계 업데이트 시작:', {
        id: updatedStep.id,
        workflow_id: workflowId,
        step_name_ko: updatedStep.step_name_ko,
        rich_description_ko_length: updatedStep.rich_description_ko?.length || 0,
        rich_description_en_length: updatedStep.rich_description_en?.length || 0,
        rich_description_ko: updatedStep.rich_description_ko,
        rich_description_en: updatedStep.rich_description_en
      })
      
      // 로컬 상태 업데이트
      const updatedSteps = localSteps.map(step => step.id === updatedStep.id ? updatedStep : step)
      setLocalSteps(updatedSteps)
      saveToHistory(updatedSteps)
      
      // 데이터베이스에 저장
      const response = await fetch('/api/workflow-steps', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updatedStep,
          workflow_id: workflowId
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('단계 저장 실패:', errorText)
        throw new Error(`Failed to save step: ${errorText}`)
      }
      
      const result = await response.json()
      console.log('단계 저장 성공:', result)
      
    setShowEditModal(false)
    setEditingStep(null)
    } catch (error) {
      console.error('Error saving step:', error)
      alert('단계 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }, [localSteps, saveToHistory, workflowId])

  // 어코디언 토글 함수
  const toggleAccordion = (key: keyof typeof accordionOpen) => {
    setAccordionOpen(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'edit') return
      
      // Ctrl+C: 복사
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault()
        copySelectedNodes()
      }
      
      // Ctrl+V: 붙여넣기
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault()
        pasteNodes()
      }
      
      // Ctrl+Z: 실행 취소
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      
      // Ctrl+Y 또는 Ctrl+Shift+Z: 다시 실행
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault()
        redo()
      }
      
      // Delete: 선택된 노드 삭제
      if (e.key === 'Delete' && selectedNodes.length > 0) {
        e.preventDefault()
        const newSteps = localSteps.filter(step => !selectedNodes.includes(step.id))
        setLocalSteps(newSteps)
        saveToHistory(newSteps)
        setSelectedNodes([])
      }
      
      // Escape: 편집 취소
      if (e.key === 'Escape') {
        if (editingConnection) {
          cancelEditingConnection()
        } else {
          setSelectedNodes([])
        }
      }
      
      // Enter: 연결 라벨 편집 완료
      if (e.key === 'Enter' && editingConnection) {
        e.preventDefault()
        finishEditingConnection()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mode, copySelectedNodes, pasteNodes, selectedNodes, editingConnection, finishEditingConnection, cancelEditingConnection, undo, redo, localSteps, saveToHistory])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-lg flex flex-col relative"
        style={{ width: '90vw', height: '90vh' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'edit' ? '워크플로우 편집' : mode === 'manual' ? '워크플로우 메뉴얼' : '워크플로우 다이어그램'}
            </h2>
            {workflowName && (
              <p className="text-sm text-gray-600 mt-1">{workflowName}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>YES 연결</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded border-2 border-dashed"></div>
                <span>NO 연결</span>
              </div>
            </div>
            {mode === 'edit' && (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
              >
                <Save size={16} />
                저장
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                닫기
              </button>
            )}
          </div>
        </div>

        {/* 다이어그램 영역 */}
        <div className="flex-1 bg-gray-50 relative overflow-hidden flex">
          {/* 왼쪽 편집 영역 */}
          <div className="flex-1 relative">
          <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${backgroundSize.width} ${backgroundSize.height}`}
            className="absolute inset-0"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={(e) => {
              // 배경 클릭 시 선택 해제
              if (e.target === e.currentTarget && mode === 'edit') {
                setSelectedNodes([])
                setSelectedStep(null)
              }
            }}
            onMouseLeave={handleMouseUp}
          >
            {/* 배경 격자 */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
              </pattern>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* 배경 리사이즈 핸들 */}
            <rect
              x={backgroundSize.width - 10}
              y={backgroundSize.height - 10}
              width="10"
              height="10"
              fill="#6b7280"
              className="cursor-se-resize hover:fill-gray-500"
              onMouseDown={handleBackgroundResizeStart}
            />
            
            {/* 연결선 그리기 */}
            {connections.map((connection) => {
              // 연결 타입별 스타일 정의
              const getConnectionStyle = (type: string) => {
                switch (type) {
                  case 'success':
                    return { color: '#10b981', dashArray: '0' }
                  case 'failure':
                    return { color: '#ef4444', dashArray: '5,5' }
                  case 'conditional':
                    return { color: '#8b5cf6', dashArray: '3,3' }
                  case 'default':
                    return { color: '#3b82f6', dashArray: '0' }
                  default:
                    return { color: '#6b7280', dashArray: '0' }
                }
              }
              
              const style = getConnectionStyle(connection.type)
              
              return (
                <g key={connection.id}>
                  <path
                    d={`M ${connection.from.x} ${connection.from.y} L ${connection.to.x} ${connection.to.y}`}
                    stroke={style.color}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={style.dashArray}
                    markerEnd={`url(#arrow-${connection.type})`}
                  />
                  <text
                    x={(connection.from.x + connection.to.x) / 2}
                    y={(connection.from.y + connection.to.y) / 2 - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill={style.color}
                    fontWeight="bold"
                    className="pointer-events-auto cursor-pointer"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      startEditingConnection(connection.id, connection.label)
                    }}
                  >
                    {editingConnection === connection.id ? '' : connection.label}
                  </text>
                  
                  {/* 연결 라벨 편집 입력 필드 */}
                  {editingConnection === connection.id && (
                    <foreignObject
                      x={(connection.from.x + connection.to.x) / 2 - 50}
                      y={(connection.from.y + connection.to.y) / 2 - 15}
                      width="100"
                      height="30"
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={connectionLabel}
                          onChange={(e) => setConnectionLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              finishEditingConnection()
                            } else if (e.key === 'Escape') {
                              cancelEditingConnection()
                            }
                          }}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={finishEditingConnection}
                          className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditingConnection}
                          className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    </foreignObject>
                  )}
                  {connection.condition && (
                    <text
                      x={(connection.from.x + connection.to.x) / 2}
                      y={(connection.from.y + connection.to.y) / 2 + 10}
                      textAnchor="middle"
                      fontSize="8"
                      fill={style.color}
                      className="pointer-events-none"
                    >
                      ({connection.condition})
                    </text>
                  )}
                </g>
              )
            })}
            
            {/* 화살표 마커 정의 */}
            <defs>
              <marker
                id="arrow-success"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
              </marker>
              <marker
                id="arrow-failure"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
              </marker>
              <marker
                id="arrow-conditional"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="#8b5cf6" />
              </marker>
              <marker
                id="arrow-default"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
              </marker>
            </defs>
            
            {/* 노드 그리기 */}
            {localSteps.map((step) => {
              const position = nodePositions[step.id]
              if (!position) return null
              
              return (
                <SVGNode
                  key={step.id}
                  step={step}
                  x={position.x}
                  y={position.y}
                  isSelected={selectedNodes.includes(step.id)}
                  onClick={handleNodeClick}
                  onDoubleClick={handleNodeDoubleClick}
                  onMouseDown={handleMouseDown}
                  isDragging={draggedNode === step.id}
                  nodeSize={nodeSize}
                />
              )
            })}
          </svg>
          </div>
          
          {/* 오른쪽 조정 도구들 */}
          {mode === 'edit' && (
            <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
              <h3 className="font-semibold text-gray-900 mb-4">편집 도구</h3>
              
              {/* 박스 사이즈 컨트롤 패널 */}
              <div className="mb-2 border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleAccordion('boxSize')}
                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
                >
                  <h4 className="font-medium text-sm text-gray-700">박스 사이즈</h4>
                  <div className={`transform transition-transform duration-200 ${accordionOpen.boxSize ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {accordionOpen.boxSize && (
                  <div className="px-3 pb-3 space-y-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">폭</label>
                  <input
                    type="range"
                    min="80"
                    max="200"
                    value={nodeSize.width}
                    onChange={(e) => setNodeSize(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 text-center">{nodeSize.width}px</div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">높이</label>
                  <input
                    type="range"
                    min="40"
                    max="120"
                    value={nodeSize.height}
                    onChange={(e) => setNodeSize(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 text-center">{nodeSize.height}px</div>
                </div>
                <button
                  onClick={() => setNodeSize({ width: 120, height: 60 })}
                  className="w-full px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                >
                  기본값으로 리셋
                </button>
            </div>
          )}
              </div>

              {/* 줌 컨트롤 */}
              <div className="mb-2 border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleAccordion('zoom')}
                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
                >
                  <h4 className="font-medium text-sm text-gray-700">줌 컨트롤</h4>
                  <div className={`transform transition-transform duration-200 ${accordionOpen.zoom ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {accordionOpen.zoom && (
                  <div className="px-3 pb-3">
                    <div className="flex items-center gap-2">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                title="줌 아웃"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-sm font-medium min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                title="줌 인"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={handleZoomReset}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                title="줌 리셋"
              >
                <RotateCcw size={16} />
              </button>
                    </div>
            </div>
          )}
              </div>

          {/* 배경 사이즈 입력 패널 */}
              <div className="mb-2 border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleAccordion('backgroundSize')}
                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
                >
                  <h4 className="font-medium text-sm text-gray-700">배경 크기</h4>
                  <div className={`transform transition-transform duration-200 ${accordionOpen.backgroundSize ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {accordionOpen.backgroundSize && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">폭</label>
                        <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="400"
                    max="2000"
                    value={backgroundSize.width}
                    onChange={(e) => setBackgroundSize(prev => ({ 
                      ...prev, 
                      width: Math.max(400, Math.min(2000, parseInt(e.target.value) || 400))
                    }))}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">높이</label>
                        <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="300"
                    max="1500"
                    value={backgroundSize.height}
                    onChange={(e) => setBackgroundSize(prev => ({ 
                      ...prev, 
                      height: Math.max(300, Math.min(1500, parseInt(e.target.value) || 300))
                    }))}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">px</span>
                        </div>
                      </div>
                </div>
                <button
                      onClick={() => setBackgroundSize({ width: 1200, height: 900 })}
                  className="w-full px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                >
                  기본값으로 리셋
                </button>
            </div>
          )}
              </div>

              {/* 편집 도구 패널 */}
              <div className="mb-2 border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleAccordion('editTools')}
                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
                >
                  <h4 className="font-medium text-sm text-gray-700">편집 도구</h4>
                  <div className={`transform transition-transform duration-200 ${accordionOpen.editTools ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
              </div>
                </button>
                {accordionOpen.editTools && (
                  <div className="px-3 pb-3 space-y-2">
                <div className="flex gap-2">
                  <button 
                    onClick={addNewNode}
                        className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2 text-sm"
                  >
                        <Plus size={14} />
                    박스 추가
                  </button>
                  {selectedNodes.length > 0 && (
                    <button 
                      onClick={() => {
                        const nodeIds = selectedNodes
                        setLocalSteps(prev => prev.filter(step => !nodeIds.includes(step.id)))
                        setSelectedNodes([])
                      }}
                          className="flex-1 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2 text-sm"
                    >
                          <Trash2 size={14} />
                          삭제 ({selectedNodes.length})
                    </button>
                  )}
                </div>
                
                {/* 실행 취소/다시 실행 버튼 */}
                <div className="flex gap-2">
                  <button 
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="flex-1 px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <ArrowLeft size={14} />
                    실행 취소
                  </button>
                  <button 
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="flex-1 px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <ArrowRight size={14} />
                    다시 실행
                  </button>
                </div>
                
                {/* 복사/붙여넣기 버튼 */}
                <div className="flex gap-2">
                  <button 
                    onClick={copySelectedNodes}
                    disabled={selectedNodes.length === 0}
                    className="flex-1 px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <Copy size={14} />
                    복사 ({selectedNodes.length})
                  </button>
                  <button 
                    onClick={pasteNodes}
                    disabled={copiedNodes.length === 0}
                    className="flex-1 px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <Save size={14} />
                    붙여넣기 ({copiedNodes.length})
                  </button>
                </div>
                
                    <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={addSuccessConnection}
                        className="px-2 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center gap-1 text-sm"
                  >
                        <ArrowRight size={12} />
                        YES
                  </button>
                  <button 
                    onClick={addFailureConnection}
                      className="px-2 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center gap-1 text-sm"
                    >
                        <ArrowRight size={12} />
                        NO
                      </button>
                </div>
                
                {/* 다중 연결 버튼들 */}
                <div className="border-t pt-2">
                  <h5 className="text-xs font-medium text-gray-600 mb-2">다중 연결</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => {
                        if (selectedNodes.length >= 2) {
                          const [fromId, toId] = selectedNodes.slice(0, 2)
                          addConnection(fromId, toId, '연결', 'default')
                        } else {
                          alert('연결하려면 최소 2개의 박스를 선택해주세요.')
                        }
                      }}
                      className="px-2 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-1 text-sm"
                    >
                      <ArrowRight size={12} />
                      연결 추가
                    </button>
                    <button 
                      onClick={() => {
                        if (selectedNodes.length >= 2) {
                          const [fromId, toId] = selectedNodes.slice(0, 2)
                          addConnection(fromId, toId, '조건부', 'conditional')
                        } else {
                          alert('연결하려면 최소 2개의 박스를 선택해주세요.')
                        }
                      }}
                      className="px-2 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center justify-center gap-1 text-sm"
                    >
                      <ArrowRight size={12} />
                      조건부
                    </button>
                  </div>
                </div>
                
                {/* 키보드 단축키 안내 */}
                <div className="border-t pt-2">
                  <h5 className="text-xs font-medium text-gray-600 mb-2">키보드 단축키</h5>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Ctrl+C: 복사</div>
                    <div>Ctrl+V: 붙여넣기</div>
                    <div>Ctrl+Z: 실행 취소</div>
                    <div>Ctrl+Y: 다시 실행</div>
                    <div>Delete: 삭제</div>
                    <div>Escape: 취소</div>
                    <div>Enter: 완료</div>
                  </div>
                </div>
              
              {selectedNodes.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-600">
                    {selectedNodes.length}개 박스 선택됨
                  </p>
                  {selectedNodes.length >= 2 && (
                    <p className="text-xs text-blue-600 mt-1">
                      연결 추가 가능
                    </p>
                  )}
                        {selectedNodes.length === 1 && (
                          <div className="mt-1 space-y-1">
                            {(() => {
                              const selectedStep = localSteps.find(s => s.id === selectedNodes[0])
                              const hasConnections = selectedStep?.next_step_id || selectedStep?.alternative_step_id
                              return hasConnections ? (
                                <p className="text-xs text-orange-600">
                                  연결 해제 가능
                                </p>
                              ) : (
                                <p className="text-xs text-gray-500">
                                  연결된 박스가 없음
                                </p>
                              )
                            })()}
                          </div>
                        )}
                        {selectedNodes.length < 2 && selectedNodes.length !== 1 && (
                    <p className="text-xs text-orange-600 mt-1">
                      연결 추가를 위해 2개 이상 선택하세요
                    </p>
                  )}
                </div>
              )}
                  </div>
                )}
              </div>

              {/* 선택된 노드 상세 정보 */}
              {selectedStep && (
                <div className="mb-2 border border-gray-200 rounded-lg">
                  <button
                    onClick={() => toggleAccordion('selectedNode')}
                    className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
                  >
                    <h4 className="font-medium text-sm text-gray-700">선택된 박스</h4>
                    <div className={`transform transition-transform duration-200 ${accordionOpen.selectedNode ? 'rotate-180' : ''}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {accordionOpen.selectedNode && (
                    <div className="px-3 pb-3">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <h5 className="font-medium text-gray-900 mb-2">{selectedStep.step_name_ko}</h5>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">타입:</span>
                      <span className="ml-2 font-medium">{selectedStep.step_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">순서:</span>
                      <span className="ml-2 font-medium">{selectedStep.step_order}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">상태:</span>
                      <span className="ml-2 font-medium">{selectedStep.is_active ? '활성' : '비활성'}</span>
                    </div>
                    {selectedStep.step_description_ko && (
                      <div>
                        <span className="text-gray-600">설명:</span>
                        <p className="mt-1 text-gray-700">{selectedStep.step_description_ko}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t">
                    <button
                      onClick={() => {
                        setEditingStep(selectedStep)
                        setShowEditModal(true)
                      }}
                            className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center gap-2 text-sm"
                    >
                            <Edit size={14} />
                      수정
                    </button>
                        </div>
                  </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 정보 */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              총 {localSteps.length}개 박스
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>YES 경로</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-dashed"></div>
                <span>NO 경로</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 단계 상세 정보 모달 */}
      {showStepDetail && selectedStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedStep.step_name_ko}
                </h3>
                <button
                  onClick={() => setShowStepDetail(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* 기본 정보 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">기본 정보</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">단계 번호:</span>
                      <span className="ml-2 font-medium">{selectedStep.step_order}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">단계 타입:</span>
                      <span className="ml-2 font-medium">{selectedStep.step_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">활성 상태:</span>
                      <span className="ml-2 font-medium">{selectedStep.is_active ? '활성' : '비활성'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">필수 여부:</span>
                      <span className="ml-2 font-medium">{selectedStep.is_required ? '필수' : '선택'}</span>
                    </div>
                  </div>
                </div>

                {/* 설명 - 한국어 */}
                {(selectedStep.rich_description_ko || selectedStep.step_description_ko) && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">설명 (한국어)</h4>
                    <div 
                      className="text-gray-700 prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:hover:text-blue-800 [&_a]:underline"
                      dangerouslySetInnerHTML={{ 
                        __html: (selectedStep.rich_description_ko || selectedStep.step_description_ko || '')
                          .replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=')
                      }}
                    />
                  </div>
                )}

                {/* 설명 - 영어 */}
                {(selectedStep.rich_description_en || selectedStep.step_description_en) && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">설명 (영어)</h4>
                    <div 
                      className="text-gray-700 prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:hover:text-blue-800 [&_a]:underline"
                      dangerouslySetInnerHTML={{ 
                        __html: (selectedStep.rich_description_en || selectedStep.step_description_en || '')
                          .replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=')
                      }}
                    />
                  </div>
                )}

                {/* 액션 정보 */}
                {selectedStep.step_type === 'action' && selectedStep.action_type && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">수행할 작업</h4>
                    <p className="text-gray-700">{selectedStep.action_type}</p>
                  </div>
                )}

                {/* 조건 정보 */}
                {selectedStep.step_type === 'condition' && selectedStep.condition_type && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">조건 확인</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-gray-600">조건 타입:</span>
                        <span className="ml-2 font-medium">{selectedStep.condition_type}</span>
                      </div>
                      {selectedStep.condition_value && (
                        <div>
                          <span className="text-gray-600">조건 값:</span>
                          <span className="ml-2 font-medium">{selectedStep.condition_value}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 노트 - 한국어 */}
                {selectedStep.notes_ko && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">노트 (한국어)</h4>
                    <div 
                      className="text-gray-700 prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:hover:text-blue-800 [&_a]:underline"
                      dangerouslySetInnerHTML={{ 
                        __html: selectedStep.notes_ko.replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=')
                      }}
                    />
                  </div>
                )}

                {/* 노트 - 영어 */}
                {selectedStep.notes_en && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">노트 (영어)</h4>
                    <div 
                      className="text-gray-700 prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:hover:text-blue-800 [&_a]:underline"
                      dangerouslySetInnerHTML={{ 
                        __html: selectedStep.notes_en.replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=')
                      }}
                    />
                  </div>
                )}

                {/* 링크 */}
                {selectedStep.links && selectedStep.links.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">관련 링크</h4>
                    <div className="space-y-2">
                      {selectedStep.links.map((link, index) => (
                        <div key={index} className="text-sm">
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            {link.title}
                          </a>
                          {link.description && (
                            <p className="text-gray-600 text-xs mt-1">{link.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 이미지 */}
                {selectedStep.images && selectedStep.images.length > 0 && (
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">관련 이미지</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {selectedStep.images.map((image, index) => (
                        <div key={index} className="text-sm">
                          <Image 
                            src={image.url} 
                            alt={image.alt}
                            width={400}
                            height={300}
                            className="max-w-full h-auto rounded-lg border"
                          />
                          {image.caption && (
                            <p className="text-gray-600 text-xs mt-1">{image.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 태그 */}
                {selectedStep.tags && selectedStep.tags.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">태그</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedStep.tags.map((tag, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 우선순위 및 예상 시간 */}
                {(selectedStep.priority || selectedStep.estimated_time) && (
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">추가 정보</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {selectedStep.priority && (
                        <div>
                          <span className="text-gray-600">우선순위:</span>
                          <span className="ml-2 font-medium capitalize">{selectedStep.priority}</span>
                        </div>
                      )}
                      {selectedStep.estimated_time && (
                        <div>
                          <span className="text-gray-600">예상 시간:</span>
                          <span className="ml-2 font-medium">{selectedStep.estimated_time}분</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 다음 단계 정보 */}
                {(selectedStep.next_step_id || selectedStep.alternative_step_id) && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">다음 단계</h4>
                    <div className="space-y-2">
                      {selectedStep.next_step_id && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm">성공 시: 다음 단계로 이동</span>
                        </div>
                      )}
                      {selectedStep.alternative_step_id && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-dashed"></div>
                          <span className="text-sm">실패 시: 대안 단계로 이동</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowStepDetail(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 편집 모달 */}
      {showEditModal && editingStep && (
        <StepEditModal
          step={editingStep}
          onSave={handleStepUpdate}
          onClose={() => {
            setShowEditModal(false)
            setEditingStep(null)
          }}
          localSteps={localSteps}
          setLocalSteps={setLocalSteps}
        />
      )}
    </div>
  )
}

// 단계 편집 모달 컴포넌트
function StepEditModal({ 
  step, 
  onSave, 
  onClose, 
  localSteps, 
  setLocalSteps 
}: { 
  step: WorkflowStep, 
  onSave: (step: WorkflowStep) => void, 
  onClose: () => void,
  localSteps: WorkflowStep[],
  setLocalSteps: React.Dispatch<React.SetStateAction<WorkflowStep[]>>
}) {
  const [formData, setFormData] = useState({
    step_name_ko: step.step_name_ko,
    step_name_en: step.step_name_en,
    step_description_ko: step.step_description_ko || '',
    step_description_en: step.step_description_en || '',
    step_type: step.step_type,
    action_type: step.action_type || '',
    condition_type: step.condition_type || '',
    condition_value: step.condition_value || '',
    node_shape: step.node_shape || 'rectangle',
    node_color: step.node_color || '#3b82f6',
    text_color: step.text_color || '#ffffff',
    is_active: step.is_active,
    is_required: step.is_required,
    // 고급 필드들
    links: step.links || [],
    images: step.images || [],
    notes_ko: step.notes_ko || '',
    notes_en: step.notes_en || '',
    tags: step.tags || [],
    priority: step.priority || 'medium',
    estimated_time: step.estimated_time || 0,
    // 리치 텍스트 설명
    rich_description_ko: step.rich_description_ko || step.step_description_ko || '',
    rich_description_en: step.rich_description_en || step.step_description_en || '',
  })

  const [newTag, setNewTag] = useState('')
  const koToEnButtonRef = useRef<HTMLButtonElement>(null)
  const enToKoButtonRef = useRef<HTMLButtonElement>(null)

  // 한글↔영어 복사 함수들
  const copyKoToEn = () => {
    console.log('한국어 → 영어 복사 시작')
    console.log('현재 한국어 내용:', formData.rich_description_ko)
    
    setFormData(prev => {
      const newData = { ...prev, rich_description_en: prev.rich_description_ko }
      console.log('복사된 영어 내용:', newData.rich_description_en)
      return newData
    })
  }

  const copyEnToKo = () => {
    console.log('영어 → 한국어 복사 시작')
    console.log('현재 영어 내용:', formData.rich_description_en)
    
    setFormData(prev => {
      const newData = { ...prev, rich_description_ko: prev.rich_description_en }
      console.log('복사된 한국어 내용:', newData.rich_description_ko)
      return newData
    })
  }

  const handleSave = () => {
    const updatedStep = {
      ...step,
      ...formData,
    }
    onSave(updatedStep)
  }

  // 태그 관리 함수들
  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  const shapeOptions = [
    { name: '사각형', value: 'rectangle' },
    { name: '둥근 사각형', value: 'rounded' },
    { name: '마름모', value: 'diamond' },
    { name: '타원', value: 'oval' },
    { name: '원', value: 'circle' },
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-2">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-3 border-b bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">
            고급 단계 편집
            </h3>
            <button
              onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 왼쪽: 기본 정보 */}
          <div className="space-y-4">
            {/* 기본 정보 */}
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-3 border-b pb-1">기본 정보</h4>
                <div className="space-y-4">
                  {/* 다국어 기본 정보 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900 border-b pb-1 text-sm">한국어</h5>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                          단계 이름 (한국어)
                </label>
                <input
                  type="text"
                  value={formData.step_name_ko}
                  onChange={(e) => setFormData(prev => ({ ...prev, step_name_ko: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="한국어 단계 이름을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                          노트 (한국어)
                </label>
                <textarea
                          value={formData.notes_ko}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes_ko: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                          placeholder="한국어 노트를 입력하세요"
                />
                      </div>
              </div>

                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900 border-b pb-1 text-sm">English</h5>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                          Step Name (English)
                </label>
                        <input
                          type="text"
                          value={formData.step_name_en}
                          onChange={(e) => setFormData(prev => ({ ...prev, step_name_en: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter English step name"
                        />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                          Notes (English)
                </label>
                        <textarea
                          value={formData.notes_en}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes_en: e.target.value }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                          placeholder="Enter English notes"
                        />
                </div>
                </div>
              </div>

                  {/* 단계 타입 및 설정 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                          단계 타입
                </label>
                        <select
                          value={formData.step_type}
                          onChange={(e) => setFormData(prev => ({ ...prev, step_type: e.target.value as 'start' | 'action' | 'condition' | 'decision' | 'template' | 'manual' | 'end' }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="start">시작 (Start)</option>
                          <option value="action">액션 (Action)</option>
                          <option value="condition">조건 (Condition)</option>
                          <option value="decision">결정 (Decision)</option>
                          <option value="template">템플릿 (Template)</option>
                          <option value="manual">수동 (Manual)</option>
                          <option value="end">종료 (End)</option>
                        </select>
                </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      액션 타입
                    </label>
                    <input
                      type="text"
                      value={formData.action_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, action_type: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="액션 타입을 입력하세요"
                    />
                  </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          우선순위
                        </label>
                        <select
                          value={formData.priority}
                          onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="low">낮음 (Low)</option>
                          <option value="medium">보통 (Medium)</option>
                          <option value="high">높음 (High)</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        조건 타입
                      </label>
                      <input
                        type="text"
                        value={formData.condition_type}
                        onChange={(e) => setFormData(prev => ({ ...prev, condition_type: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="조건 타입을 입력하세요"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        조건 값
                      </label>
                      <input
                        type="text"
                        value={formData.condition_value}
                        onChange={(e) => setFormData(prev => ({ ...prev, condition_value: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="조건 값을 입력하세요"
                      />
                    </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          예상 시간 (분)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.estimated_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, estimated_time: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="예상 소요 시간"
                        />
              </div>
                    </div>
                  </div>

                  {/* 체크박스 설정 */}
                  <div className="flex gap-4">
                    <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="mr-1.5"
                  />
                  <span className="text-xs text-gray-700">활성</span>
                </label>
                    <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_required: e.target.checked }))}
                        className="mr-1.5"
                  />
                  <span className="text-xs text-gray-700">필수</span>
                </label>
              </div>

                  {/* 태그 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      태그
                    </label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full flex items-center gap-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="새 태그 입력 후 Enter"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      >
                        추가
                      </button>
            </div>
          </div>

                  {/* 노드 스타일 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      노드 스타일
                    </label>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          도형 모양
                        </label>
                        <div className="grid grid-cols-3 gap-1">
                          {shapeOptions.map((shape) => (
                            <button
                              key={shape.value}
                              onClick={() => setFormData(prev => ({ ...prev, node_shape: shape.value as 'rectangle' | 'rounded' | 'diamond' | 'oval' | 'circle' }))}
                              className={`p-2 border rounded text-xs font-medium transition-colors ${
                                formData.node_shape === shape.value
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                              }`}
                            >
                              {shape.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            배경색
                          </label>
                          <input
                            type="color"
                            value={formData.node_color}
                            onChange={(e) => setFormData(prev => ({ ...prev, node_color: e.target.value }))}
                            className="w-full h-8 border border-gray-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            텍스트 색상
                          </label>
                          <input
                            type="color"
                            value={formData.text_color}
                            onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                            className="w-full h-8 border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 우측: 리치 텍스트 에디터 */}
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-3 border-b pb-1 text-sm">리치 텍스트 에디터</h4>
                
                {/* 복사 버튼들 */}
                <div className="flex gap-2 mb-4">
                  <button
                    ref={koToEnButtonRef}
                    type="button"
                    onClick={() => {
                      copyKoToEn()
                      // 시각적 피드백
                      if (koToEnButtonRef.current) {
                        const button = koToEnButtonRef.current
                        button.style.backgroundColor = '#10B981'
                        button.textContent = '복사 완료!'
                        setTimeout(() => {
                          button.style.backgroundColor = '#3B82F6'
                          button.textContent = '한국어 → 영어'
                        }, 1000)
                      }
                    }}
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                    title="한국어 내용을 영어로 복사"
                  >
                    한국어 → 영어
                  </button>
                  <button
                    ref={enToKoButtonRef}
                    type="button"
                    onClick={() => {
                      copyEnToKo()
                      // 시각적 피드백
                      if (enToKoButtonRef.current) {
                        const button = enToKoButtonRef.current
                        button.style.backgroundColor = '#10B981'
                        button.textContent = '복사 완료!'
                        setTimeout(() => {
                          button.style.backgroundColor = '#10B981'
                          button.textContent = '영어 → 한국어'
                        }, 1000)
                      }
                    }}
                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                    title="영어 내용을 한국어로 복사"
                  >
                    영어 → 한국어
                  </button>
                </div>
                
                {/* 한국어 리치 에디터 */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    한국어 설명
                  </label>
                  <LightRichEditor
                    value={formData.rich_description_ko}
                    onChange={(value) => setFormData(prev => ({ ...prev, rich_description_ko: value || '' }))}
                    height={200}
                  />
                </div>

                {/* 영어 리치 에디터 */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    English Description
                  </label>
                  <LightRichEditor
                    value={formData.rich_description_en}
                    onChange={(value) => setFormData(prev => ({ ...prev, rich_description_en: value || '' }))}
                    height={200}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 푸터 버튼들 */}
        <div className="flex items-center justify-between p-3 border-t bg-gray-50">
            <div className="flex gap-2">
              <button
                onClick={() => {
                const newStep = { ...step, ...formData }
                const stepIndex = localSteps.findIndex(s => s.id === step.id)
                if (stepIndex !== -1) {
                  const updatedSteps = [...localSteps]
                  updatedSteps[stepIndex] = newStep
                  setLocalSteps(updatedSteps)
                }
              }}
              className="px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1 text-sm"
              >
                <Copy size={14} />
                복사
              </button>
              <button
                onClick={() => {
                if (confirm('이 단계를 삭제하시겠습니까?')) {
                    setLocalSteps(prev => prev.filter(s => s.id !== step.id))
                    onClose()
                  }
                }}
              className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1 text-sm"
              >
                <Trash2 size={14} />
                삭제
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
              className="px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSave}
              className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1 text-sm"
              >
                <Save size={14} />
                저장
              </button>
          </div>
        </div>
      </div>
    </div>
  )
}