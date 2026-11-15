import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

const storageKey = 'studyplanner:task-detail-width'
const minimum = 260
const defaultWidth = 400

export function KhungChiaChiTiet({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  const container = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startX: number; width: number } | null>(null)
  const [preferredWidth, setPreferredWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey))
      if (Number.isFinite(saved) && saved >= minimum && saved <= 640) return saved
    } catch { /* Kích thước vẫn điều chỉnh được khi trình duyệt chặn lưu tùy chọn. */ }
    return defaultWidth
  })
  const [maximum, setMaximum] = useState(640)
  const [dragging, setDragging] = useState(false)
  const width = Math.min(preferredWidth, maximum)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      // Dành tối thiểu 360px cho danh sách và 8px cho thanh chia.
      setMaximum(Math.max(minimum, Math.min(640, Math.floor(entry.contentRect.width - 368))))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    try { localStorage.setItem(storageKey, String(preferredWidth)) }
    catch { /* Tùy chọn trong phiên vẫn hoạt động. */ }
  }, [preferredWidth])

  function resize(value: number) {
    setPreferredWidth(Math.round(Math.min(maximum, Math.max(minimum, value))))
  }

  return <div ref={container} className={'ht-page-body' + (detail ? ' ht-has-detail' : '') + (dragging ? ' ht-resizing' : '')}
    style={{ '--ht-detail-width': width + 'px' } as CSSProperties}>
    {children}
    {detail && <>
      <div className="ht-detail-divider" role="separator" tabIndex={0} aria-orientation="vertical"
        aria-label="Điều chỉnh độ rộng phần chi tiết" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={width}
        aria-valuetext={width + ' pixel'} title="Kéo để đổi độ rộng · Phím trái/phải để điều chỉnh"
        onPointerDown={event => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { pointerId: event.pointerId, startX: event.clientX, width }
          setDragging(true)
        }}
        onPointerMove={event => {
          const active = drag.current
          if (active?.pointerId === event.pointerId) resize(active.width + active.startX - event.clientX)
        }}
        onPointerUp={event => {
          if (drag.current?.pointerId !== event.pointerId) return
          drag.current = null
          setDragging(false)
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onLostPointerCapture={() => { drag.current = null; setDragging(false) }}
        onPointerCancel={() => { drag.current = null; setDragging(false) }}
        onDoubleClick={() => resize(defaultWidth)}
        onKeyDown={event => {
          const step = event.shiftKey ? 40 : 16
          if (event.key === 'ArrowLeft') resize(width + step)
          else if (event.key === 'ArrowRight') resize(width - step)
          else if (event.key === 'Home') resize(minimum)
          else if (event.key === 'End') resize(maximum)
          else return
          event.preventDefault()
        }}
      ><span aria-hidden="true" /></div>
      {detail}
    </>}
  </div>
}
