import { useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '../components/Icon'
import { mocDauNgay, nhanLoaiLich, xepKhoiLich } from './lich'
import { congNgay, gioNhap, trangThai, trongKhoang } from './time'
import type { SuKien } from './types'
import './lich.css'

const nhanThu = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const ngayAgenda = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'numeric' })
const gioTrongNgay = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0') + ':00')
const chieuCaoMotGio = 48
const chieuCaoToiThieuTheoPhut = Math.ceil(22 * 60 / chieuCaoMotGio)

type CardActions = {
  onOpen: (event: SuKien) => void
  onToggle: (event: SuKien) => void
  toggleDisabled: boolean
}
type Props = CardActions & {
  mode: string; first: string; days: number; date: string; today: string; zone: string
  events: SuKien[]; ready: boolean; compactDeadlines: boolean; onDay: (day: string) => void
}
type CardVariant = 'chip' | 'block' | 'agenda' | 'overflow'

function TheLich({ event, variant, zone, eventDate, style, compact = false, onOpen, onToggle, toggleDisabled }: CardActions & {
  event: SuKien; variant: CardVariant; zone: string; eventDate: Intl.DateTimeFormat; style?: CSSProperties; compact?: boolean
}) {
  const done = event.trangThai === 'Completed'
  const canToggle = event.coTheDanhDauHoanThanh === true && event.tienDoNhiemVu != null
  const start = gioNhap(event.batDau, zone).slice(11)
  const time = (variant === 'block' || variant === 'agenda') && event.ketThuc
    ? start + '–' + gioNhap(event.ketThuc, zone).slice(11)
    : start
  const info = [nhanLoaiLich[event.loai], event.tieuDe, eventDate.format(new Date(event.batDau)),
    event.ketThuc && eventDate.format(new Date(event.ketThuc)), event.trangThai && trangThai[event.trangThai]].filter(Boolean).join(' · ')
  return <div className={`ht-event ht-event-${event.loai} ht-calendar-${variant}${compact ? ' ht-calendar-compact' : ''}`}
    data-completed={done || undefined} style={{ '--event-source-accent': event.mauSac || undefined, ...style } as CSSProperties}>
    {canToggle
      ? <label className="ht-calendar-toggle">
        <input type="checkbox" className="ht-calendar-check" checked={done} disabled={toggleDisabled}
          aria-label={(done ? 'Mở lại ' : 'Hoàn thành ') + event.tieuDe} onChange={() => onToggle(event)} />
      </label>
      : done && <span className="ht-calendar-status-mark" aria-hidden="true"><Icon name="check" size={11} /></span>}
    <button type="button" className={'ht-calendar-open' + (variant === 'overflow' ? ' ht-calendar-deadline-item' : '')}
      title={info} aria-label={info} onClick={() => onOpen(event)}>
      <strong>{event.tieuDe}</strong>
      {!(compact && variant === 'block') && <small><time dateTime={event.batDau}>{time}</time></small>}
      {variant === 'agenda' && <span className="ht-calendar-kind">{nhanLoaiLich[event.loai]}{event.trangThai && trangThai[event.trangThai] ? ' · ' + trangThai[event.trangThai] : ''}</span>}
    </button>
  </div>
}

function HanTrongNgay({ day, deadlines, zone, eventDate, summary = false, onOpen, onToggle, toggleDisabled }: CardActions & {
  day: string; deadlines: SuKien[]; zone: string; eventDate: Intl.DateTimeFormat; summary?: boolean
}) {
  const id = useId()
  const headingId = id + '-heading'
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const dayLabel = ngayAgenda.format(new Date(day + 'T12:00Z'))
  const buttonLabel = summary ? deadlines.length + ' hạn' : 'Xem thêm ' + (deadlines.length - 2) + ' hạn'

  useEffect(() => {
    const button = trigger.current, box = panel.current
    if (!button || !box) return
    function position() {
      if (!button || !box || !box.matches(':popover-open')) return
      const anchor = button.getBoundingClientRect()
      const { width, height } = box.getBoundingClientRect()
      const left = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))
      const below = anchor.bottom + 6
      const above = anchor.top - height - 6
      const top = below + height <= window.innerHeight - 12 ? below : above >= 12 ? above : Math.max(12, window.innerHeight - height - 12)
      box.style.left = left + 'px'
      box.style.top = top + 'px'
    }
    box.addEventListener('toggle', position)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      box.removeEventListener('toggle', position)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [])

  return <>
    <button ref={trigger} type="button" className={'ht-calendar-more' + (summary ? ' ht-calendar-deadline-count' : '')} popoverTarget={id}
      aria-label={(summary ? 'Xem ' : '') + buttonLabel + ' · ' + dayLabel}>
      {summary ? <><span><strong>{deadlines.length}</strong> hạn</span><Icon name="chevron-right" size={11} /></> : buttonLabel}
    </button>
    <div ref={panel} id={id} role="region" aria-labelledby={headingId} className="ht-calendar-deadline-popover" popover="auto">
      <header><h3 id={headingId}>Hạn nộp · {dayLabel}</h3>
        <button type="button" className="ht-calendar-deadline-close" popoverTarget={id} popoverTargetAction="hide">Đóng</button></header>
      <ul>
        {deadlines.map(event => <li key={event.ma}>
          <TheLich event={event} variant="overflow" zone={zone} eventDate={eventDate} onToggle={onToggle} toggleDisabled={toggleDisabled}
            onOpen={item => { panel.current?.hidePopover(); onOpen(item) }} />
        </li>)}
      </ul>
    </div>
  </>
}

export function LichKhungNhin({ mode, first, days, date, today, zone, events, ready, compactDeadlines, onDay, ...actions }: Props) {
  const timeline = mode === 'day' || mode === 'week' || mode === 'threeDays'
  const scroller = useRef<HTMLDivElement>(null)
  const lastScrollKey = useRef('')
  const scrollKey = [mode, first, zone].join(':')
  const dates = useMemo(() => Array.from({ length: days + 1 }, (_, index) => {
    const day = congNgay(first, index)
    return { day, start: mocDauNgay(day, zone) }
  }), [first, days, zone])
  const rows = dates.slice(0, -1).map(({ day, start }, index) => {
    const end = dates[index + 1].start
    const items = start < end ? events.filter(e => trongKhoang(e.batDau, e.ketThuc, start, end)) : []
    return { day, items, blocks: timeline ? xepKhoiLich(day, items, zone, start, end, chieuCaoToiThieuTheoPhut) : [] }
  })
  const eventDate = useMemo(() => new Intl.DateTimeFormat('vi-VN', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }), [zone])
  const starts = rows.flatMap(row => row.blocks.filter(block => block.suKien.loai !== 'GioRanh').map(block => ({ day: row.day, top: block.top })))
  const selectedStart = Math.min(...starts.filter(start => start.day === date).map(start => start.top))
  const firstBlock = Number.isFinite(selectedStart) ? selectedStart : Math.min(...starts.map(start => start.top))
  useLayoutEffect(() => {
    if (!timeline) { lastScrollKey.current = ''; return }
    if (!ready || !scroller.current || lastScrollKey.current === scrollKey) return
    // Desktop dùng vùng cuộn chung với thanh điều khiển.
    if (scroller.current.scrollHeight <= scroller.current.clientHeight + 1) return
    const firstHour = Number.isFinite(firstBlock) ? Math.max(0, Math.floor(firstBlock / 60) - 1) : 7
    scroller.current.scrollTop = firstHour * chieuCaoMotGio
    lastScrollKey.current = scrollKey
  }, [timeline, ready, scrollKey, firstBlock])

  function dayButton(day: string, showMonth = false) {
    return <button type="button" className={'ht-day-name' + (day === today ? ' ht-today' : day === date ? ' ht-selected-day' : '')}
      aria-current={day === today ? 'date' : undefined}
      aria-label={'Xem lịch ' + ngayAgenda.format(new Date(day + 'T12:00Z'))}
      onClick={() => onDay(day)}>{showMonth ? day.slice(8) + '/' + day.slice(5, 7) : Number(day.slice(8))}</button>
  }

  function card(event: SuKien, variant: CardVariant, style?: CSSProperties, compact = false) {
    return <TheLich key={event.ma} event={event} variant={variant} style={style} compact={compact}
      zone={zone} eventDate={eventDate} {...actions} />
  }

  if (timeline) {
    return <div className="ht-time-grid-wrap" ref={scroller}>
      <div className="ht-time-grid" data-single-day={days === 1 || undefined} style={{
        '--ht-hour-height': chieuCaoMotGio + 'px',
        gridTemplateColumns: `48px repeat(${days}, minmax(0, 1fr))`, minWidth: days === 1 ? 0 : 48 + days * 104,
      } as CSSProperties}>
        <div className="ht-time-heading ht-time-label">Giờ</div>
        {rows.map(({ day, items }) => {
          const deadlines = items.filter(event => event.loai === 'HanNhiemVu')
          return <header className={'ht-time-heading' + (day === today ? ' ht-current-day' : '')} key={day}>
            <div className="ht-time-date"><span>{nhanThu[(new Date(day + 'T12:00Z').getUTCDay() + 6) % 7]}</span>{dayButton(day, true)}</div>
            {!!deadlines.length && (compactDeadlines ? <div className="ht-calendar-deadline-summary">
              <HanTrongNgay day={day} deadlines={deadlines} zone={zone} eventDate={eventDate} summary {...actions} />
            </div> : <div className="ht-calendar-deadlines">
              {deadlines.slice(0, 2).map(event => card(event, 'chip'))}
              {deadlines.length > 2 && <HanTrongNgay day={day} deadlines={deadlines} zone={zone} eventDate={eventDate} {...actions} />}
            </div>)}
          </header>
        })}
        <div className="ht-hour-column" aria-hidden="true">{gioTrongNgay.map((label, hour) => <span key={label} style={{ top: hour * chieuCaoMotGio }}>{label}</span>)}</div>
        {rows.map(({ day, blocks }) => <div className={'ht-time-column' + (day === today ? ' ht-current-day' : '')} key={day}>
          {blocks.map(block => {
            const height = block.height * chieuCaoMotGio / 60
            return card(block.suKien, 'block', {
              top: block.top * chieuCaoMotGio / 60, height,
              left: `calc(${block.cot / block.soCot * 100}% + 2px)`, width: `calc(${100 / block.soCot}% - 4px)`,
            }, height < 42)
          })}
        </div>)}
      </div>
    </div>
  }

  if (mode === 'agenda') {
    const populated = rows.filter(row => row.items.length)
    return <div className="ht-calendar-agenda">
      {ready && !populated.length && <p className="ht-empty">Không có lịch trong 7 ngày đang xem</p>}
      {populated.map(({ day, items }) => <section key={day} className="ht-agenda-day">
        <header>{dayButton(day)}<h3>{day === today ? 'Hôm nay' : ngayAgenda.format(new Date(day + 'T12:00Z'))}</h3><span>{items.length} mục</span></header>
        <div>{items.map(event => card(event, 'agenda'))}</div>
      </section>)}
    </div>
  }

  return <div className="ht-month-scroll"><div className="ht-calendar ht-calendar-month">
    {nhanThu.map(label => <div className="ht-month-weekday" key={label}>{label}</div>)}
    {rows.map(({ day, items }) => <section key={day} className={'ht-day' + (mode === 'month' && day.slice(0, 7) !== date.slice(0, 7) ? ' ht-other-month' : '') + (day === today ? ' ht-current-day' : '')}>
      {dayButton(day)}
      {items.slice(0, 3).map(event => card(event, 'chip'))}
      {items.length > 3 && <button type="button" className="ht-calendar-more" onClick={() => onDay(day)}>+{items.length - 3} mục</button>}
    </section>)}
  </div></div>
}
