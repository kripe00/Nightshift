import React, { useEffect, useRef, useState } from 'react'
import {
  BASE_VIEWPORT_HEIGHT,
  BASE_VIEWPORT_WIDTH,
  ViewportScaleContext,
  type ViewportScaleContextValue,
} from './viewportScaleContext'

interface ViewportScalerProps {
  children: React.ReactNode
}

export const ViewportScaler: React.FC<ViewportScalerProps> = ({ children }) => {
  const [scale, setScale] = useState<number>(1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateScale = () => {
      const padding = 16
      const availW = Math.max(320, window.innerWidth - padding)
      const availH = Math.max(180, window.innerHeight - padding)
      const rawScale = Math.min(
        availW / BASE_VIEWPORT_WIDTH,
        availH / BASE_VIEWPORT_HEIGHT
      )
      // Snap scale to 0.005 increments to prevent sub-pixel jitter
      const snappedScale = Math.round(rawScale * 200) / 200
      setScale(snappedScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const contextValue = React.useMemo<ViewportScaleContextValue>(() => {
    const safeScale = scale > 0 ? scale : 1
    return {
      scale: safeScale,
      toViewportDelta: (screenDelta: number) => Math.round(screenDelta / safeScale),
      toLocalCoords: (clientX: number, clientY: number, elementRect: DOMRect) => ({
        x: Math.round((clientX - elementRect.left) / safeScale),
        y: Math.round((clientY - elementRect.top) / safeScale),
      }),
    }
  }, [scale])

  return (
    <ViewportScaleContext.Provider value={contextValue}>
      <div
        ref={wrapperRef}
        className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#080a08] select-none"
      >
        <div
          style={{
            width: `${BASE_VIEWPORT_WIDTH}px`,
            height: `${BASE_VIEWPORT_HEIGHT}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            imageRendering: 'pixelated',
          }}
          className="relative shrink-0 overflow-hidden border-4 border-[#090b09] bg-[#1e281d] text-[#dfd2a3] shadow-[0_12px_36px_rgba(0,0,0,0.95)]"
        >
          {children}
        </div>
      </div>
    </ViewportScaleContext.Provider>
  )
}
