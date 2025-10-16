'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { 
  Play, 
  Square, 
  CheckCircle, 
  AlertCircle, 
  FileText,
  User,
  ArrowRight,
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
  is_active: boolean
  is_required: boolean
  node_shape?: 'rectangle' | 'rounded' | 'diamond' | 'oval' | 'circle'
  node_color?: string
  text_color?: string
  group_id?: string
  position?: { x: number; y: number }
}

interface WorkflowDiagramProps {
  steps: WorkflowStep[]
  workflowName?: string
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

// 노드 타입별 아이콘
const getNodeIcon = (stepType: string) => {
  switch (stepType) {
    case 'start':
      return <Play size={16} />
    case 'end':
      return <Square size={16} />
    case 'action':
      return <Play size={16} />
    case 'condition':
      return <AlertCircle size={16} />
    case 'decision':
      return <CheckCircle size={16} />
    case 'template':
      return <FileText size={16} />
    case 'manual':
      return <User size={16} />
    default:
      return <Square size={16} />
  }
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
  const icon = getNodeIcon(step.step_type)
  
  const customStyle = {
    backgroundColor: step.node_color || (nodeStyle as unknown as { backgroundColor: string }).backgroundColor,
    borderColor: step.node_color || (nodeStyle as unknown as { borderColor: string }).borderColor,
    color: step.text_color || (nodeStyle as unknown as { color: string }).color,
  }

  const handleClick = () => {
    onClick?.(step)
  }

  const handleDoubleClick = () => {
    onDoubleClick?.(step)
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
        <rect
          x={x - width/2 - 4}
          y={y - height/2 - 4}
          width={width + 8}
          height={height + 8}
          rx={step.node_shape === 'rounded' ? 16 : step.node_shape === 'oval' ? (height+8)/2 : 8}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="4"
          className="animate-pulse"
        />
      )}
      
      {/* 아이콘 */}
      <foreignObject x={x - 12} y={y - 20} width="24" height="24">
        <div className="flex items-center justify-center w-6 h-6 bg-white bg-opacity-80 rounded-full">
          {icon}
        </div>
      </foreignObject>
      
      {/* 텍스트 */}
      <text
        x={x}
        y={y + 8}
        textAnchor="middle"
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

export default function WorkflowDiagram({ steps, workflowName, onClose, mode = 'diagram', onSave, initialSettings }: WorkflowDiagramProps) {
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null)
  const [showStepDetail, setShowStepDetail] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [localSteps, setLocalSteps] = useState<WorkflowStep[]>(steps)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [modalSize, setModalSize] = useState({ width: 1200, height: 800 })
  const [isResizing, setIsResizing] = useState(false)
  const [panelPosition, setPanelPosition] = useState(initialSettings?.panelPosition || { x: 16, y: 16 })
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const [panelDragOffset, setPanelDragOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(initialSettings?.zoom || 1)
  const [backgroundSize, setBackgroundSize] = useState(initialSettings?.backgroundSize || { width: 800, height: 600 })
  const [isResizingBackground, setIsResizingBackground] = useState(false)
  const [nodeSize, setNodeSize] = useState(initialSettings?.nodeSize || { width: 120, height: 60 })

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
      type: 'success' | 'failure'
      label: string
    }> = []
    
    sortedSteps.forEach((step) => {
      const fromPos = nodePositions[step.id]
      if (!fromPos) return
      
      // 다음 단계로의 연결
      if (step.next_step_id) {
        const toPos = nodePositions[step.next_step_id]
        if (toPos) {
          connections.push({
            id: `${step.id}-${step.next_step_id}`,
            from: fromPos,
            to: toPos,
            type: 'success',
            label: '성공'
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
            label: '실패'
          })
        }
      }
    })
    
    return connections
  }, [localSteps, nodePositions])

  // 노드 클릭 핸들러 (한 번 클릭 - 선택)
  const handleNodeClick = useCallback((step: WorkflowStep) => {
    if (mode === 'edit') {
      setSelectedNodes(prev => 
        prev.includes(step.id) 
          ? prev.filter(id => id !== step.id)
          : [...prev, step.id]
      )
      setSelectedStep(step)
    } else {
      setSelectedStep(step)
      setShowStepDetail(true)
    }
  }, [mode])

  // 노드 더블클릭 핸들러 (두 번 클릭 - 편집)
  const handleNodeDoubleClick = useCallback((step: WorkflowStep) => {
    setEditingStep(step)
    setShowEditModal(true)
  }, [])

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

  // 모달 리사이즈 핸들러
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(800, e.clientX - 100)
      const newHeight = Math.max(600, e.clientY - 100)
      setModalSize({ width: newWidth, height: newHeight })
    }
  }, [isResizing])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  // 리사이즈 이벤트 리스너 등록
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
    return undefined
  }, [isResizing, handleResizeMove, handleResizeEnd])

  // 드래그 종료 핸들러
  const handleMouseUp = useCallback(() => {
    setDraggedNode(null)
    setDragOffset({ x: 0, y: 0 })
    setIsDraggingPanel(false)
    setPanelDragOffset({ x: 0, y: 0 })
  }, [])

  // 패널 드래그 시작 핸들러
  const handlePanelMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingPanel(true)
    setPanelDragOffset({
      x: e.clientX - panelPosition.x,
      y: e.clientY - panelPosition.y
    })
  }, [panelPosition])

  // 패널 드래그 중 핸들러
  const handlePanelMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingPanel) {
      const newX = e.clientX - panelDragOffset.x
      const newY = e.clientY - panelDragOffset.y
      setPanelPosition({ x: newX, y: newY })
    }
  }, [isDraggingPanel, panelDragOffset])

  // 패널 드래그 이벤트 리스너 등록
  React.useEffect(() => {
    if (isDraggingPanel) {
      document.addEventListener('mousemove', handlePanelMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handlePanelMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    return undefined
  }, [isDraggingPanel, handlePanelMouseMove, handleMouseUp])

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

  // 성공 연결 추가 기능
  const addSuccessConnection = useCallback(() => {
    if (selectedNodes.length < 2) {
      alert(`연결하려면 최소 2개의 박스를 선택해주세요. (현재 선택된 박스: ${selectedNodes.length}개)`)
      return
    }
    
    const [sourceId, targetId] = selectedNodes.slice(0, 2)
    setLocalSteps(prev => 
      prev.map(step => 
        step.id === sourceId 
          ? { ...step, next_step_id: targetId }
          : step
      )
    )
    setSelectedNodes([])
    alert(`성공 연결이 추가되었습니다! (${sourceId} → ${targetId})`)
  }, [selectedNodes])

  // 실패 연결 추가 기능
  const addFailureConnection = useCallback(() => {
    if (selectedNodes.length < 2) {
      alert(`연결하려면 최소 2개의 박스를 선택해주세요. (현재 선택된 박스: ${selectedNodes.length}개)`)
      return
    }
    
    const [sourceId, targetId] = selectedNodes.slice(0, 2)
    setLocalSteps(prev => 
      prev.map(step => 
        step.id === sourceId 
          ? { ...step, alternative_step_id: targetId }
          : step
      )
    )
    setSelectedNodes([])
    alert(`실패 연결이 추가되었습니다! (${sourceId} → ${targetId})`)
  }, [selectedNodes])

  // 노드 추가 기능
  const addNewNode = useCallback(() => {
    const newNodeId = `step_${Date.now()}`
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
    
    setLocalSteps(prev => [...prev, newStep])
  }, [localSteps.length])

  const handleSave = () => {
    if (onSave) {
      onSave({
        steps: localSteps,
        zoom,
        backgroundSize,
        nodeSize,
        panelPosition
      })
    }
  }

  const handleStepUpdate = (updatedStep: WorkflowStep) => {
    setLocalSteps(prev => 
      prev.map(step => step.id === updatedStep.id ? updatedStep : step)
    )
    setShowEditModal(false)
    setEditingStep(null)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-lg flex flex-col relative"
        style={{ width: modalSize.width, height: modalSize.height }}
      >
        {/* 리사이즈 핸들 */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-300 hover:bg-gray-400"
          onMouseDown={handleResizeStart}
        />
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
                <span>상세보기</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span>편집</span>
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
        <div className="flex-1 bg-gray-50 relative overflow-hidden">
          <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${backgroundSize.width} ${backgroundSize.height}`}
            className="absolute inset-0"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
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
            {connections.map((connection) => (
              <g key={connection.id}>
                <path
                  d={`M ${connection.from.x} ${connection.from.y} L ${connection.to.x} ${connection.to.y}`}
                  stroke={connection.type === 'success' ? '#10b981' : '#ef4444'}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={connection.type === 'failure' ? '5,5' : '0'}
                  markerEnd={`url(#arrow-${connection.type})`}
                />
                <text
                  x={(connection.from.x + connection.to.x) / 2}
                  y={(connection.from.y + connection.to.y) / 2 - 5}
                  textAnchor="middle"
                  fontSize="10"
                  fill={connection.type === 'success' ? '#10b981' : '#ef4444'}
                  fontWeight="bold"
                >
                  {connection.label}
                </text>
              </g>
            ))}
            
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
          
          {/* 박스 사이즈 컨트롤 패널 */}
          {mode === 'edit' && (
            <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg">
              <h3 className="font-semibold text-sm mb-2">박스 사이즈</h3>
              <div className="space-y-2">
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
            </div>
          )}
          {mode === 'edit' && (
            <div className="absolute bottom-4 left-4 bg-white p-2 rounded-lg shadow-lg flex items-center gap-2">
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
          )}

          {/* 배경 사이즈 입력 패널 */}
          {mode === 'edit' && (
            <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg">
              <div className="text-sm font-medium text-gray-700 mb-2">배경 크기</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 w-8">폭:</label>
                  <input
                    type="number"
                    min="400"
                    max="2000"
                    value={backgroundSize.width}
                    onChange={(e) => setBackgroundSize(prev => ({ 
                      ...prev, 
                      width: Math.max(400, Math.min(2000, parseInt(e.target.value) || 400))
                    }))}
                    className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 w-8">높이:</label>
                  <input
                    type="number"
                    min="300"
                    max="1500"
                    value={backgroundSize.height}
                    onChange={(e) => setBackgroundSize(prev => ({ 
                      ...prev, 
                      height: Math.max(300, Math.min(1500, parseInt(e.target.value) || 300))
                    }))}
                    className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
                <button
                  onClick={() => setBackgroundSize({ width: 800, height: 600 })}
                  className="w-full px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                >
                  기본값으로 리셋
                </button>
              </div>
            </div>
          )}
          {mode === 'edit' && (
            <div 
              className="absolute bg-white p-4 rounded-lg shadow-lg cursor-move"
              style={{ 
                width: '400px',
                left: panelPosition.x,
                top: panelPosition.y,
                zIndex: 10
              }}
              onMouseDown={handlePanelMouseDown}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">편집 도구</h3>
                <div className="text-xs text-gray-500">드래그하여 이동</div>
              </div>
              <div className="space-y-2" onMouseDown={(e) => e.stopPropagation()}>
                <div className="flex gap-2">
                  <button 
                    onClick={addNewNode}
                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
                  >
                    <Plus size={16} />
                    박스 추가
                  </button>
                  {selectedNodes.length > 0 && (
                    <button 
                      onClick={() => {
                        const nodeIds = selectedNodes
                        setLocalSteps(prev => prev.filter(step => !nodeIds.includes(step.id)))
                        setSelectedNodes([])
                      }}
                      className="flex-1 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      선택 삭제 ({selectedNodes.length})
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={addSuccessConnection}
                    className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
                  >
                    <ArrowRight size={16} />
                    성공 연결
                  </button>
                  <button 
                    onClick={addFailureConnection}
                    className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
                  >
                    <ArrowRight size={16} />
                    실패 연결
                  </button>
                </div>
              </div>
              
              {selectedNodes.length > 0 && (
                <div className="mt-3 pt-3 border-t" onMouseDown={(e) => e.stopPropagation()}>
                  <p className="text-sm text-gray-600">
                    {selectedNodes.length}개 박스 선택됨
                  </p>
                  {selectedNodes.length >= 2 && (
                    <p className="text-xs text-blue-600 mt-1">
                      연결 추가 가능
                    </p>
                  )}
                  {selectedNodes.length < 2 && (
                    <p className="text-xs text-orange-600 mt-1">
                      연결 추가를 위해 2개 이상 선택하세요
                    </p>
                  )}
                </div>
              )}

              {/* 선택된 노드 상세 정보 */}
              {selectedStep && (
                <div className="mt-4 pt-4 border-t" onMouseDown={(e) => e.stopPropagation()}>
                  <h4 className="font-medium text-gray-900 mb-2">{selectedStep.step_name_ko}</h4>
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
                      className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center gap-2"
                    >
                      <Edit size={16} />
                      수정
                    </button>
                  </div>
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
                <span>성공 경로</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-dashed"></div>
                <span>실패 경로</span>
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

                {/* 설명 */}
                {selectedStep.step_description_ko && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">설명</h4>
                    <p className="text-gray-700">{selectedStep.step_description_ko}</p>
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
    step_description_ko: step.step_description_ko || '',
    step_type: step.step_type,
    action_type: step.action_type || '',
    condition_type: step.condition_type || '',
    condition_value: step.condition_value || '',
    node_shape: step.node_shape || 'rectangle',
    node_color: step.node_color || '',
    text_color: step.text_color || '',
    is_active: step.is_active,
    is_required: step.is_required,
  })

  const handleSave = () => {
    const updatedStep = {
      ...step,
      ...formData,
    }
    onSave(updatedStep)
  }

  const colorOptions = [
    { name: '파란색', value: '#3b82f6' },
    { name: '초록색', value: '#10b981' },
    { name: '빨간색', value: '#ef4444' },
    { name: '노란색', value: '#f59e0b' },
    { name: '보라색', value: '#8b5cf6' },
    { name: '회색', value: '#6b7280' },
    { name: '핑크색', value: '#ec4899' },
    { name: '주황색', value: '#f97316' },
  ]

  const shapeOptions = [
    { name: '사각형', value: 'rectangle' },
    { name: '둥근 사각형', value: 'rounded' },
    { name: '마름모', value: 'diamond' },
    { name: '타원', value: 'oval' },
    { name: '원', value: 'circle' },
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              단계 편집
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {/* 기본 정보 */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 text-sm">기본 정보</h4>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  단계 이름
                </label>
                <input
                  type="text"
                  value={formData.step_name_ko}
                  onChange={(e) => setFormData(prev => ({ ...prev, step_name_ko: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={formData.step_description_ko}
                  onChange={(e) => setFormData(prev => ({ ...prev, step_description_ko: e.target.value }))}
                  rows={2}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  단계 타입
                </label>
                <select
                  value={formData.step_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, step_type: e.target.value as 'start' | 'action' | 'condition' | 'decision' | 'template' | 'manual' | 'end' }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="start">시작</option>
                  <option value="action">액션</option>
                  <option value="condition">조건</option>
                  <option value="decision">결정</option>
                  <option value="template">템플릿</option>
                  <option value="manual">수동</option>
                  <option value="end">종료</option>
                </select>
              </div>
            </div>

            {/* 도형 설정 */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 text-sm">도형 설정</h4>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  도형 모양
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {shapeOptions.map((shape) => (
                    <button
                      key={shape.value}
                      onClick={() => setFormData(prev => ({ ...prev, node_shape: shape.value as 'rectangle' | 'rounded' | 'oval' | 'diamond' | 'circle' }))}
                      className={`p-2 border rounded text-xs ${
                        formData.node_shape === shape.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {shape.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  배경색
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setFormData(prev => ({ ...prev, node_color: color.value }))}
                      className={`p-2 rounded text-xs text-white font-medium ${
                        formData.node_color === color.value
                          ? 'ring-1 ring-blue-500 ring-offset-1'
                          : ''
                      }`}
                      style={{ backgroundColor: color.value }}
                    >
                      {color.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  텍스트 색상
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setFormData(prev => ({ ...prev, text_color: color.value }))}
                      className={`p-2 rounded text-xs font-medium border ${
                        formData.text_color === color.value
                          ? 'ring-1 ring-blue-500 ring-offset-1'
                          : 'border-gray-300'
                      }`}
                      style={{ color: color.value }}
                    >
                      텍스트
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 액션/조건 정보 */}
            {(formData.step_type === 'action' || formData.step_type === 'condition') && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 text-sm">
                  {formData.step_type === 'action' ? '액션 정보' : '조건 정보'}
                </h4>
                
                {formData.step_type === 'action' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      액션 타입
                    </label>
                    <input
                      type="text"
                      value={formData.action_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, action_type: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                {formData.step_type === 'condition' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        조건 타입
                      </label>
                      <input
                        type="text"
                        value={formData.condition_type}
                        onChange={(e) => setFormData(prev => ({ ...prev, condition_type: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 상태 설정 */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 text-sm">상태 설정</h4>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-xs text-gray-700">활성</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_required: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-xs text-gray-700">필수</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const newStep = {
                    ...step,
                    id: `step_${Date.now()}`,
                    step_name_ko: `${step.step_name_ko} (복사)`,
                    step_order: 999,
                    position: {
                      x: (step.position?.x || 0) + 50,
                      y: (step.position?.y || 0) + 50,
                    }
                  }
                  const currentSteps = JSON.parse(JSON.stringify(localSteps))
                  currentSteps.push(newStep)
                  setLocalSteps(currentSteps)
                  onClose()
                }}
                className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 flex items-center gap-1"
              >
                <Copy size={14} />
                복사
              </button>
              <button
                onClick={() => {
                  if (confirm(`"${step.step_name_ko}" 단계를 삭제하시겠습니까?`)) {
                    setLocalSteps(prev => prev.filter(s => s.id !== step.id))
                    onClose()
                  }
                }}
                className="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 flex items-center gap-1"
              >
                <Trash2 size={14} />
                삭제
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600 flex items-center gap-1"
              >
                <Save size={14} />
                저장
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}