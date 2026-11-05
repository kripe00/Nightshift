import { createContext, useContext } from 'react'

export const BASE_VIEWPORT_WIDTH = 1600
export const BASE_VIEWPORT_HEIGHT = 900

export interface ViewportScaleContextValue {
  scale: number
  /** Converts a screen-space delta (e.g. e.clientX - startX) into integer 1600x900 viewport pixels */
  toViewportDelta: (screenDelta: number) => number
  /** Converts a screen clientX/clientY point into local coordinates relative to a target element */
  toLocalCoords: (
    clientX: number,
    clientY: number,
    elementRect: DOMRect
  ) => { x: number; y: number }
}

export const ViewportScaleContext = createContext<ViewportScaleContextValue>({
  scale: 1,
  toViewportDelta: (d) => Math.round(d),
  toLocalCoords: (clientX, clientY, rect) => ({
    x: Math.round(clientX - rect.left),
    y: Math.round(clientY - rect.top),
  }),
})

export function useViewportScale(): ViewportScaleContextValue {
  return useContext(ViewportScaleContext)
}

