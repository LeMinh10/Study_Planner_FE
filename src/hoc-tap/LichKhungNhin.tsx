import { useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import { mocDauNgay, nhanLoaiLich, xepKhoiLich } from './lich'
import { congNgay, gioNhap, trangThai, trongKhoang } from './time'
import type { SuKien } from './types'
import './lich.css'

const nhanThu = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const ngayAgenda = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'numeric' })
const gioTrongNgay = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0') + ':00')

type Props = {
  mode: string; first: string; days: number; date: string; today: string; zone: string
  events: SuKien[]; ready: boolean; onDay: (day: string) => void; onOpen: (event: SuKien) => void
}

export function LichKhungNhin({ mode, first, days, date, today, zone, events, ready, onDay, onOpen }: Props) {
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
    return { day, items, blocks: timeline ? xepKhoiLich(day, items, zone, start, end) : [] }
  })
  const eventDate = useMemo(() => new Intl.DateTimeFormat('vi-VN', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }), [zone])
  const starts = rows.flatMap(row => row.blocks.filter(block => block.suKien.loai !== 'GioRanh').map(block => ({ day: row.day, top: block.top })))
  const selectedStart = Math.min(...starts.filter(start => start.day === date).map(start => start.top))
  const firstBlock = Number.isFinite(selectedStart) ? selectedStart : Math.min(...starts.map(start => start.top))
  useLayoutEffect(() => {
    if (!timeline) { lastScrollKey.current = ''; return }
    if (!ready || !scroller.current || lastScrollKey.current === scrollKey) return
    scroller.current.scrollTop = Number.isFinite(firstBlock) ? Math.max(0, Math.floor(firstBlock / 60) * 60 - 60) : 7 * 60
    lastScrollKey.current = scrollKey
  }, [timeline, ready, scrollKey, firstBlock])

  function dayButton(day: string, showMonth = false) {
    return <button type="button" className={'ht-day-name' + (day === today ? ' ht-today' : day === date ? ' ht-selected-day' : '')}
      aria-current={day === today ? 'date' : undefined}
      aria-label={'Xem lịch ' + ngayAgenda.format(new Date(day + 'T12:00Z'))}
      onClick={() => onDay(day)}>{showMonth ? day.slice(8) + '/' + day.slice(5, 7) : Number(day.slice(8))}</button>
  }

  function card(event: SuKien, variant: 'chip' | 'block' | 'agenda', style?: CSSProperties, compact = false) {
    const start = gioNhap(event.batDau, zone).slice(11)
    const time = variant !== 'chip' && event.ketThuc ? start + '–' + gioNhap(event.ketThuc, zone).slice(11) : start
    const info = [nhanLoaiLich[event.loai], event.tieuDe, eventDate.format(new Date(event.batDau)),
      event.ketThuc && eventDate.format(new Date(event.ketThuc)), event.trangThai && trangThai[event.trangThai]].filter(Boolean).join(' · ')
    return <button type="button" key={event.ma} className={`ht-event ht-event-${event.loai} ht-calendar-${variant}${compact ? ' ht-calendar-compact' : ''}`}
      title={info} aria-label={info} onClick={() => onOpen(event)} style={{ borderInlineStartColor: event.mauSac ?? undefined, ...style }}>
      <strong>{event.tieuDe}</strong>
      {!(compact && variant === 'block') && <small>{time}</small>}
      {variant === 'agenda' && <span className="ht-calendar-kind">{nhanLoaiLich[event.loai]}{event.trangThai && trangThai[event.trangThai] ? ' · ' + trangThai[event.trangThai] : ''}</span>}
    </button>
  }

  if (timeline) {
    return <div className="ht-time-grid-wrap" ref={scroller}>
      <div className="ht-time-grid" style={{ gridTemplateColumns: `48px repeat(${days}, minmax(0, 1fr))`, minWidth: days === 1 ? 0 : 48 + days * 104 }}>
        <div className="ht-time-heading ht-time-label">Giờ</div>
        {rows.map(({ day, items }) => {
          const deadlines = items.filter(event => event.loai === 'HanNhiemVu')
          return <header className={'ht-time-heading' + (day === today ? ' ht-current-day' : '')} key={day}>
            <div className="ht-time-date"><span>{nhanThu[(new Date(day + 'T12:00Z').getUTCDay() + 6) % 7]}</span>{dayButton(day, true)}</div>
            {!!deadlines.length && <div className="ht-calendar-deadlines">
              {deadlines.slice(0, mode === 'day' ? deadlines.length : 2).map(event => card(event, 'chip', undefined, true))}
              {mode !== 'day' && deadlines.length > 2 && <button type="button" className="ht-calendar-more" onClick={() => onDay(day)}>+{deadlines.length - 2} hạn</button>}
            </div>}
          </header>
        })}
        <div className="ht-hour-column" aria-hidden="true">{gioTrongNgay.map((label, hour) => <span key={label} style={{ top: hour * 60 }}>{label}</span>)}</div>
        {rows.map(({ day, blocks }) => <div className={'ht-time-column' + (day === today ? ' ht-current-day' : '')} key={day}>
          {blocks.map(block => card(block.suKien, 'block', {
            top: block.top, height: block.height,
            left: `calc(${block.cot / block.soCot * 100}% + 2px)`, width: `calc(${100 / block.soCot}% - 4px)`,
          }, block.height < 42))}
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
