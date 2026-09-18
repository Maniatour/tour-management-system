'use client'

import { useCallback, useEffect, useRef, type PointerEvent, type WheelEvent } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 5
const DOUBLE_TAP_MS = 280
const SWIPE_PX = 56

type Point = { x: number; y: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function clampPan(scale: number, tx: number, ty: number, width: number, height: number) {
  const maxX = Math.max(0, (width * (scale - 1)) / 2)
  const maxY = Math.max(0, (height * (scale - 1)) / 2)
  return {
    x: clamp(tx, -maxX, maxX),
    y: clamp(ty, -maxY, maxY),
  }
}

type ZoomablePhotoProps = {
  src: string
  alt?: string
  rotation?: number
  onSwipeLeft?: (() => void) | undefined
  onSwipeRight?: (() => void) | undefined
}

export default function ZoomablePhoto({ src, alt = '', rotation = 0, onSwipeLeft, onSwipeRight }: ZoomablePhotoProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const scaleRef = useRef(1)
  const txRef = useRef(0)
  const tyRef = useRef(0)
  const pointersRef = useRef(new Map<number, Point>())
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
  const pinchActiveRef = useRef(false)
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const swipeRef = useRef<Point | null>(null)
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const movedRef = useRef(false)

  const applyTransform = useCallback(() => {
    const image = imageRef.current
    if (!image) return
    image.style.transform = `translate3d(${txRef.current}px, ${tyRef.current}px, 0) scale(${scaleRef.current}) rotate(${rotation}deg)`
  }, [rotation])

  const reset = useCallback(() => {
    scaleRef.current = 1
    txRef.current = 0
    tyRef.current = 0
    applyTransform()
  }, [applyTransform])

  const zoomAt = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const viewport = viewportRef.current
      if (!viewport) return
      const rect = viewport.getBoundingClientRect()
      const cx = clientX - rect.left - rect.width / 2
      const cy = clientY - rect.top - rect.height / 2
      const prev = scaleRef.current
      const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
      const ratio = scale / prev
      const pan = clampPan(
        scale,
        (txRef.current - cx) * ratio + cx,
        (tyRef.current - cy) * ratio + cy,
        rect.width,
        rect.height
      )
      scaleRef.current = scale
      txRef.current = scale === 1 ? 0 : pan.x
      tyRef.current = scale === 1 ? 0 : pan.y
      applyTransform()
    },
    [applyTransform]
  )

  useEffect(() => {
    reset()
  }, [src, reset])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    movedRef.current = false
    const points = [...pointersRef.current.values()]
    if (points.length === 2) {
      swipeRef.current = null
      panRef.current = null
      pinchActiveRef.current = true
      pinchRef.current = {
        dist: distance(points[0], points[1]),
        scale: scaleRef.current,
      }
      return
    }
    pinchRef.current = null
    if (scaleRef.current > 1) {
      panRef.current = { x: event.clientX, y: event.clientY, tx: txRef.current, ty: tyRef.current }
      swipeRef.current = null
    } else {
      panRef.current = null
      swipeRef.current = { x: event.clientX, y: event.clientY }
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointersRef.current.values()]
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()

    if (points.length >= 2 && pinchRef.current) {
      const nextDist = distance(points[0], points[1])
      const mid = midpoint(points[0], points[1])
      const factor = nextDist / Math.max(1, pinchRef.current.dist)
      zoomAt(mid.x, mid.y, pinchRef.current.scale * factor)
      movedRef.current = true
      return
    }

    if (panRef.current && scaleRef.current > 1) {
      const pan = clampPan(
        scaleRef.current,
        panRef.current.tx + (event.clientX - panRef.current.x),
        panRef.current.ty + (event.clientY - panRef.current.y),
        rect.width,
        rect.height
      )
      txRef.current = pan.x
      tyRef.current = pan.y
      applyTransform()
      movedRef.current = true
      return
    }

    if (swipeRef.current && scaleRef.current === 1) {
      const dx = event.clientX - swipeRef.current.x
      const dy = event.clientY - swipeRef.current.y
      if (Math.hypot(dx, dy) > 10) movedRef.current = true
    }
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current
    const wasPinch = pinchActiveRef.current
    pointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pinchRef.current = null
    panRef.current = null

    if (pointersRef.current.size > 0) {
      swipeRef.current = null
      return
    }

    pinchActiveRef.current = false

    if (!wasPinch && start && !movedRef.current) {
      const now = Date.now()
      const last = lastTapRef.current
      if (last && now - last.time < DOUBLE_TAP_MS && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 40) {
        if (scaleRef.current > 1) reset()
        else zoomAt(event.clientX, event.clientY, 2.5)
        lastTapRef.current = null
      } else {
        lastTapRef.current = { time: now, x: event.clientX, y: event.clientY }
      }
    } else if (!wasPinch && scaleRef.current === 1 && start) {
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) onSwipeLeft?.()
        else onSwipeRight?.()
      }
    }

    swipeRef.current = null
    if (scaleRef.current <= 1.02) reset()
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
    zoomAt(event.clientX, event.clientY, scaleRef.current * factor)
  }

  return (
    <div
      ref={viewportRef}
      className="flex h-full w-full touch-none items-center justify-center overflow-hidden"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        draggable={false}
        className={
          Math.abs(rotation % 180) === 90
            ? 'max-h-[100vw] max-w-[100vh] select-none object-contain'
            : 'max-h-full max-w-full select-none object-contain'
        }
        style={{ transformOrigin: 'center center', willChange: 'transform' }}
      />
    </div>
  )
}
