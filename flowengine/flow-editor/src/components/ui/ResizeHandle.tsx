/**
 * Resize Handle Component
 * Draggable handle for resizing panels
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
  onResizeEnd?: () => void
}

export function ResizeHandle({ direction, onResize, onResizeEnd }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const startPosRef = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY
    },
    [direction]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = currentPos - startPosRef.current
      startPosRef.current = currentPos
      onResize(delta)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      onResizeEnd?.()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Prevent text selection while dragging
    document.body.style.userSelect = 'none'
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, direction, onResize, onResizeEnd])

  const isHorizontal = direction === 'horizontal'
  const isActive = isDragging || isHovered

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex-shrink-0 relative group"
      style={{
        width: isHorizontal ? '12px' : '100%',
        height: isHorizontal ? '100%' : '12px',
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
        zIndex: 20,
      }}
    >
      {/* Visible handle indicator */}
      <div
        className="absolute transition-all duration-150"
        style={{
          ...(isHorizontal
            ? {
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: isActive ? '4px' : '2px',
                height: '40px',
                maxHeight: '30%',
              }
            : {
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                height: isActive ? '4px' : '2px',
                width: '40px',
                maxWidth: '30%',
              }),
          backgroundColor: isDragging
            ? 'var(--primary)'
            : isHovered
              ? 'var(--outline)'
              : 'var(--outline-variant)',
          borderRadius: '2px',
          opacity: isActive ? 1 : 0.5,
        }}
      />
    </div>
  )
}
