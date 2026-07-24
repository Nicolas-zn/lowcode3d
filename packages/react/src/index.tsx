import React, { useEffect, useRef } from 'react'
import { LowCode3DViewer } from '@lowcode3d/runtime'
import type { ViewerOptions } from '@lowcode3d/runtime'

export interface LowCode3DViewProps {
  config: any
  models?: Array<{ name: string; url: string }>
  options?: ViewerOptions
  style?: React.CSSProperties
  className?: string
}

export const LowCode3DView: React.FC<LowCode3DViewProps> = ({
  config,
  models,
  options,
  style,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<LowCode3DViewer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const viewer = new LowCode3DViewer(containerRef.current)
    viewerRef.current = viewer

    viewer.init(options).then(async () => {
      if (config) {
        await viewer.loadScene(config, models)
      }
    })

    return () => {
      viewer.dispose()
      viewerRef.current = null
    }
  }, []) // Empty dependency array for init only once if possible, or handle updates.

  // Handle config updates
  useEffect(() => {
    const viewer = viewerRef.current
    if (viewer && config) {
      viewer.loadScene(config, models).catch(console.error)
    }
  }, [config, models])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', ...style }}
      className={className}
    />
  )
}
