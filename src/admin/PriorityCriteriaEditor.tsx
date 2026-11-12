import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { Icon } from '../components/Icon'
import { criterionLabels } from '../priority/rules'
import type { PriorityCriterion } from '../priority/rules'

interface Props {
  order: readonly PriorityCriterion[]
  selected: readonly PriorityCriterion[]
  disabled: boolean
  onReorder: (order: PriorityCriterion[]) => void
  onSelect: (selected: readonly PriorityCriterion[]) => void
}
interface Drag {
  item: PriorityCriterion; pointerId: number; x: number; y: number; moved: boolean
  original: PriorityCriterion[]; order: PriorityCriterion[]
}
function reorder(order: readonly PriorityCriterion[], item: PriorityCriterion, target: PriorityCriterion) {
  const next = [...order]
  const from = next.indexOf(item), to = next.indexOf(target)
  if (from < 0 || to < 0 || from === to) return next
  next.splice(from, 1); next.splice(to, 0, item)
  return next
}

export function PriorityCriteriaEditor({ order, selected, disabled, onReorder, onSelect }: Props) {
  const list = useRef<HTMLOListElement>(null)
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState<PriorityCriterion | null>(null)
  const [keyboard, setKeyboard] = useState<{ item: PriorityCriterion; original: PriorityCriterion[] } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const instructions = useId()

  function announce(item: PriorityCriterion, next: readonly PriorityCriterion[]) {
    setAnnouncement(`${criterionLabels[item]}, vị trí ${next.indexOf(item) + 1} trên ${next.length}.`)
  }
  function move(item: PriorityCriterion, direction: number) {
    const target = order[order.indexOf(item) + direction]
    if (disabled || !target) return
    const next = reorder(order, item, target)
    onReorder(next); announce(item, next)
  }
  function start(event: PointerEvent<HTMLButtonElement>, item: PriorityCriterion) {
    if (disabled || event.button !== 0 || drag.current) return
    event.preventDefault()
    event.currentTarget.focus()
    setKeyboard(null)
    drag.current = { item, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, original: [...order], order: [...order] }
    list.current?.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: PointerEvent<HTMLOListElement>) {
    const current = drag.current
    if (disabled || !current || current.pointerId !== event.pointerId) return
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 5) return
    event.preventDefault()
    current.moved = true; setDragging(current.item)
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-criterion]')
    if (!target || !list.current?.contains(target)) return
    const item = target.dataset.criterion as PriorityCriterion
    if (item === current.item || !current.order.includes(item)) return
    current.order = reorder(current.order, current.item, item)
    onReorder(current.order)
  }
  function finish(event: PointerEvent<HTMLOListElement>, cancel = false) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    drag.current = null; setDragging(null)
    if (list.current?.hasPointerCapture(event.pointerId)) list.current.releasePointerCapture(event.pointerId)
    if (!disabled && current.moved) {
      if (cancel) { onReorder(current.original); setAnnouncement('Đã hủy thay đổi thứ tự.') }
      else announce(current.item, current.order)
    }
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, item: PriorityCriterion) {
    if (disabled) return
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (keyboard?.item === item) { setKeyboard(null); announce(item, order) }
      else { setKeyboard({ item, original: [...order] }); setAnnouncement(`Đã chọn ${criterionLabels[item]}. Dùng phím lên, xuống để đổi vị trí.`) }
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); move(item, event.key === 'ArrowUp' ? -1 : 1)
    } else if (event.key === 'Escape' && keyboard) {
      event.preventDefault(); onReorder(keyboard.original); setKeyboard(null); setAnnouncement('Đã hủy thay đổi thứ tự.')
    } else if (event.key === 'Tab') setKeyboard(null)
  }

  return <>
    <p id={instructions} className="sr-only">Kéo tay nắm để đổi thứ tự. Với bàn phím, nhấn phím cách để chọn, phím lên hoặc xuống để di chuyển, nhấn lại phím cách để hoàn tất hoặc Escape để hủy.</p>
    <ol ref={list} className="priority-criteria" aria-label="Thứ tự tiêu chí ưu tiên" onPointerMove={pointerMove} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}>
      {order.map((item, index) => {
        const active = selected.includes(item)
        const position = order.slice(0, index + 1).filter(value => selected.includes(value)).length
        const grabbed = !disabled && (dragging === item || keyboard?.item === item)
        return <li key={item} data-criterion={item} className={'criterion-row' + (!active ? ' is-inactive' : '') + (grabbed ? ' is-grabbed' : '')}>
          <button type="button" className="criterion-drag" disabled={disabled} aria-label={`Sắp xếp ${criterionLabels[item]}`} aria-describedby={instructions} aria-pressed={keyboard?.item === item} title="Kéo để đổi thứ tự" onPointerDown={event => start(event, item)} onKeyDown={event => keyDown(event, item)} onBlur={() => setKeyboard(current => current?.item === item ? null : current)}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor" aria-hidden="true">{[5, 10, 15].map(y => <g key={y}><circle cx="5" cy={y} r="1.4" /><circle cx="11" cy={y} r="1.4" /></g>)}</svg>
          </button>
          <span className={'criterion-rank' + (active && position === 1 ? ' is-first' : '')} aria-label={active ? `Thứ tự ${position}` : 'Không sử dụng'}>{active ? String(position).padStart(2, '0') : '—'}</span>
          <span className="criterion-name">{criterionLabels[item]}</span>
          <div className="criterion-controls">
            {item === 'Deadline' ? <span className="criterion-required" aria-label="Hạn hoàn thành luôn được sử dụng"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.6" /><path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" /></svg>Bắt buộc</span> : <label className="criterion-switch" title={active ? 'Tắt tiêu chí' : 'Bật tiêu chí'}><input type="checkbox" role="switch" aria-label={`Sử dụng ${criterionLabels[item]}`} checked={active} disabled={disabled} onChange={event => onSelect(event.target.checked ? [...selected, item] : selected.filter(value => value !== item))} /><span aria-hidden="true" /></label>}
            <div className="criterion-arrows">
              <button type="button" className="criterion-move-up" aria-label={`Đưa ${criterionLabels[item]} lên`} title="Di chuyển lên" disabled={disabled || index === 0} onClick={() => { setKeyboard(null); move(item, -1) }}><Icon name="arrow-right" size={15} /></button>
              <button type="button" className="criterion-move-down" aria-label={`Đưa ${criterionLabels[item]} xuống`} title="Di chuyển xuống" disabled={disabled || index === order.length - 1} onClick={() => { setKeyboard(null); move(item, 1) }}><Icon name="arrow-right" size={15} /></button>
            </div>
          </div>
        </li>
      })}
    </ol>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
  </>
}
