import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { calendarPreferencesKey, readCalendarPreferences } from './calendarPreferences'
import { xacNhan } from './xacNhan'
import { Icon } from '../components/Icon'
import { BieuMau, ChonPhamVi, useHocTap } from './HocTapPage'
import { ChiTietNhiemVu, DoiTienDo, doiHoanThanhNhiemVu, SuaNhiemVu } from './NhiemVuView'
import { goi, thayDoi } from './api'
import { congNgay, dauTuan, doiKhoang, gioNhap, hienGio, ngay, thu, thoiDiemGui, trangThai } from './time'
import type { GioRanh, Lich, LopHoc, NhiemVu, Phien, SuKien } from './types'
import { mocDauNgay, nhanLoaiLich } from './lich'
import { LichKhungNhin } from './LichKhungNhin'
import type { FocusRecord } from '../focus/focus'
import { NgoaiLeGioRanh } from './NgoaiLeGioRanh'
import { useStudySettings } from './StudySettings'
import './planning-upgrade.css'
import './planning-design.css'

const calendarModes = { day: 'Ngày', threeDays: '3 ngày', week: 'Tuần', twoWeeks: '2 tuần', month: 'Tháng', agenda: 'Danh sách 7 ngày' }
const sessionModes = { period: '7 ngày trước đến 31 ngày tới', day: 'Ngày', week: 'Tuần', month: 'Tháng', agenda: 'Danh sách 7 ngày' }
const dayLabel = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', dateStyle: 'medium' })
const monthLabel = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const studyDayLabel = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'numeric' })
const statusTone: Record<string, string> = { Planned: 'ready', InProgress: 'live', Completed: 'done', Missed: 'missed' }

function ngayLich(value: string, formatter = dayLabel) {
  return formatter.format(new Date(value + 'T12:00Z'))
}

function theoThu<T extends { thuTrongTuan: number; gioBatDau: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.thuTrongTuan - b.thuTrongTuan || a.gioBatDau.localeCompare(b.gioBatDau))
}

export function LichView({ tab, studyBatch, scheduleDate }: { tab: string; studyBatch?: number; scheduleDate?: string }) {
  const c = useHocTap()
  const auth = useAuth()
  const owner = auth.user?.email ?? ''
  const [preferences] = useState(() => {
    try { return readCalendarPreferences(localStorage, owner) }
    catch { return readCalendarPreferences(null, owner) }
  })
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sessionStatus = params.get('sessionStatus') ?? 'all'
  const [freePresentation, setFreePresentation] = useState<'week' | 'list'>('week')
  const [date, setDate] = useState(() => scheduleDate ?? ngay(Date.now(), c.zone))
  const calendar = tab === 'calendar'
  const [mode, setMode] = useState(tab === 'sessions' ? 'period' : preferences.mode)
  const [calendarSnapshot, setCalendarSnapshot] = useState<{ key: string; revision: number; events: SuKien[]; version: number } | null>(null)
  const [free, setFree] = useState<GioRanh[]>([])
  const [classes, setClasses] = useState<LopHoc[]>([])
  const [sessions, setSessions] = useState<Phien[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const taskWrite = useRef(false)
  const [savingTask, setSavingTask] = useState(false)
  const [baseline, setBaseline] = useState<number | null>(null)
  const [layers, setLayers] = useState(() => new Set(preferences.layers))
  const [compactDeadlines, setCompactDeadlines] = useState(preferences.compactDeadlines)
  const [showCompleted, setShowCompleted] = useState(preferences.showCompleted)
  useEffect(() => {
    if (!calendar || !owner) return
    try { localStorage.setItem(calendarPreferencesKey(owner), JSON.stringify({ version: 1, mode, layers: [...layers], compactDeadlines, showCompleted })) }
    catch { /* Viewing still works when preferences cannot be stored. */ }
  }, [calendar, owner, mode, layers, compactDeadlines, showCompleted])
  const first = mode === 'period' ? congNgay(date, -7) : mode === 'month' ? dauTuan(date.slice(0, 8) + '01') : mode === 'week' || mode === 'twoWeeks' ? dauTuan(date) : date
  const days = mode === 'period' ? 38 : mode === 'month' ? 42 : mode === 'twoWeeks' ? 14 : mode === 'threeDays' ? 3 : mode === 'week' || mode === 'agenda' ? 7 : 1
  const start = new Date(mocDauNgay(first, c.zone)).toISOString()
  const end = new Date(mocDauNgay(congNgay(first, days), c.zone)).toISOString()
  const calendarKey = JSON.stringify([c.token, c.hocKy, c.monHoc, start, end])
  const snapshot = calendarSnapshot?.key === calendarKey ? calendarSnapshot : null
  const calendarVersion = snapshot?.revision === c.revision ? snapshot.version : null
  const hasDeadlineStrip = ['day', 'week', 'threeDays'].includes(mode) && layers.has('HanNhiemVu') &&
    snapshot?.events.some(event => event.loai === 'HanNhiemVu' && (showCompleted || event.trangThai !== 'Completed'))
  const emptyClassVersion = tab === 'classes' && !c.monHoc ? c.version : null
  const revision = c.revision
  const taskSessionId = c.nhiemVuXemPhien?.ma
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    const query = new URLSearchParams({ tu: start, den: end })
    if (c.hocKy) query.set('maHocKy', c.hocKy)
    if (c.monHoc) query.set('maMonHoc', c.monHoc)
    async function load() {
      if (tab === 'free') {
        const r = await goi<GioRanh[]>(c.token, '/availability-windows', { signal: controller.signal })
        if (!controller.signal.aborted) { setFree(r.duLieu); setBaseline(r.phienBan) }
      } else if (tab === 'classes') {
        if (!c.monHoc) { setClasses([]); setBaseline(emptyClassVersion); return }
        const r = await goi<LopHoc[]>(c.token, `/courses/${c.monHoc}/class-sessions`, { signal: controller.signal })
        if (!controller.signal.aborted) { setClasses(r.duLieu); setBaseline(r.phienBan) }
      } else if (tab === 'sessions') {
        const sessionQuery = new URLSearchParams(studyBatch ? { maLanApDung: String(studyBatch) } : { tu: start, den: end })
        if (!studyBatch && taskSessionId) sessionQuery.set('maNhiemVu', String(taskSessionId))
        const r = await goi<Phien[]>(c.token, '/study-sessions?' + sessionQuery, { signal: controller.signal })
        if (!controller.signal.aborted) {
          setSessions(studyBatch || taskSessionId ? r.duLieu : r.duLieu.filter(p =>
            (!c.hocKy || String(p.maHocKy) === c.hocKy) && (!c.monHoc || String(p.maMonHoc) === c.monHoc)))
          setBaseline(r.phienBan)
        }
      } else {
        query.set('gomHanKeThua', 'true')
        const r = await goi<Lich>(c.token, '/calendar?' + query, { signal: controller.signal })
        if (!controller.signal.aborted) setCalendarSnapshot({ key: calendarKey, revision, events: r.duLieu.suKien, version: r.phienBan })
      }
    }
    load().catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [tab, studyBatch, c.token, c.hocKy, c.monHoc, emptyClassVersion, taskSessionId, start, end, calendarKey, revision])
  async function openSession(id: number, selectMode = false) {
    setError('')
    try {
      const r = await goi<Phien>(c.token, `/study-sessions/${id}`)
      c.modal(<PhienChiTiet key={id} row={r.duLieu} baseline={r.phienBan} selectMode={selectMode} />)
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa mở được phiên tự học.') }
  }
  async function openEvent(event: SuKien) {
    try {
      if (event.loai === 'HanNhiemVu' || event.loai === 'SuKien') { c.modal(<ChiTietNhiemVu ma={event.maNguon} />); return }
      if (event.loai === 'GioRanh') {
        const r = await goi<GioRanh>(c.token, `/availability-windows/${event.maNguon}`)
        c.modal(<NgoaiLeGioRanh row={r.duLieu} initialDay={ngay(event.batDau, c.zone)} />)
      } else if (event.loai === 'LichHoc') {
        const r = await goi<LopHoc>(c.token, `/class-sessions/${event.maNguon}`)
        c.modal(<SuaLich row={r.duLieu} kind="classes" baseline={r.phienBan} />)
      } else {
        await openSession(event.maNguon)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa mở được chi tiết lịch.') }
  }
  async function toggleTask(event: SuKien) {
    const progress = event.tienDoNhiemVu
    if (taskWrite.current || calendarVersion === null || error || !event.coTheDanhDauHoanThanh || progress == null) return
    taskWrite.current = true
    setSavingTask(true)
    try {
      await c.run(() => doiHoanThanhNhiemVu(c, {
        ma: event.maNguon, tieuDe: event.tieuDe, tienDo: progress, coNhiemVuCon: false,
      }, calendarVersion))
    } finally {
      taskWrite.current = false
      setSavingTask(false)
    }
  }
  const today = ngay(Date.now(), c.zone)
  function openDay(day: string) {
    setDate(day)
    setMode('day')
  }
  function go(direction: number) {
    setDate(doiKhoang(date, direction, mode, days))
  }
  const calendarLabel = mode === 'month' ? monthLabel.format(new Date(date + 'T12:00Z'))
    : [first, ...(days > 1 ? [congNgay(first, days - 1)] : [])].map(day => dayLabel.format(new Date(day + 'T12:00Z'))).join(' – ')
  const sessionDays = new Map<string, Phien[]>()
  const statusLabels: Record<string, string> = { all: 'Tất cả', Planned: 'Chưa học', InProgress: 'Đang học', Completed: 'Đã hoàn thành', Missed: 'Bỏ lỡ', Cancelled: 'Đã hủy' }
  const filteredSessions = studyBatch || !statusLabels[sessionStatus] || sessionStatus === 'all' ? sessions : sessions.filter(row => row.trangThai === sessionStatus)
  function filterSessions(status: string) { const next = new URLSearchParams(params); if (status === 'all') next.delete('sessionStatus'); else next.set('sessionStatus', status); setParams(next) }
  for (const row of filteredSessions) {
    const day = ngay(row.batDauDuKien, c.zone)
    const list = sessionDays.get(day)
    if (list) list.push(row)
    else sessionDays.set(day, [row])
  }
  const dateNavigation = <div className="ht-calendar-navigation" aria-label="Điều hướng lịch" role="group">
    <div className="ht-calendar-pager">
      <button type="button" aria-label="Khoảng trước" title="Khoảng trước" onClick={() => go(-1)}><Icon name="chevron-left" size={15} /></button>
      <button type="button" onClick={() => setDate(today)}>Hôm nay</button>
      <button type="button" aria-label="Khoảng sau" title="Khoảng sau" onClick={() => go(1)}><Icon name="chevron-right" size={15} /></button>
    </div>
    <input aria-label="Ngày đang xem" type="date" value={date} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setDate(e.target.value) }} />
  </div>
  const addButton = !calendar && !studyBatch && <button type="button" disabled={baseline === null} className="ht-primary" onClick={() => {
    if (baseline === null) return
    c.modal(tab === 'sessions'
      ? <DatPhien baseline={baseline} task={c.nhiemVuXemPhien ?? undefined} />
      : <SuaLich kind={tab === 'free' ? 'free' : 'classes'} baseline={baseline} />)
  }}>{tab === 'free' ? '+ Thêm giờ rảnh' : tab === 'sessions' ? '+ Đặt phiên tự học' : '+ Thêm buổi học'}</button>
  function freeRow(row: GioRanh) { return <article className="ht-item ht-study-row" key={row.ma}>
        <div className="ht-study-row-main">
          <strong>{thu[row.thuTrongTuan - 1]} · {row.gioBatDau.slice(0, 5)}–{row.gioKetThuc.slice(0, 5)}</strong>
          <p>{ngayLich(row.ngayBatDau)} – {ngayLich(row.ngayKetThuc)}</p>
        </div>
        <span className="ht-study-badge" data-tone={row.dangSuDung ? 'done' : undefined}>{row.dangSuDung ? 'Đang dùng' : 'Đã tắt'}</span>
        <div className="ht-study-row-actions">
          <button type="button" onClick={() => c.modal(<SuaLich row={row} kind="free" baseline={baseline!} />)}>Sửa lịch lặp</button><button type="button" onClick={() => c.modal(<NgoaiLeGioRanh row={row} />)}>Điều chỉnh một ngày</button>
          <button type="button" className="ht-danger" onClick={() => void c.run(async () => {
            if (!await xacNhan({ tieuDe: 'Xóa giờ rảnh?', noiDung: `Xóa khung giờ rảnh ${thu[row.thuTrongTuan - 1]}, ${row.gioBatDau.slice(0, 5)}–${row.gioKetThuc.slice(0, 5)}?`, nguyHiem: true, nhanXacNhan: 'Xóa giờ rảnh' })) return
            const result = await thayDoi(c.token, `/availability-windows/${row.ma}`, 'DELETE', undefined, baseline!, { path: '/calendar/change-preview', body: { loai: 'GioRanh', ma: row.ma, xoa: true } })
            if (result) c.thongBaoThanhCong('Đã xóa khung giờ rảnh')
            return result
          })}>Xóa</button>
        </div>
      </article> }
  return <section className={calendar ? 'ht-calendar-view' : 'ht-study-view'}>
    {calendar && <>
      <div className="ht-calendar-toolbar">
        <h2 aria-live="polite">{calendarLabel}</h2>
        <div className="ht-calendar-actions">
          {dateNavigation}
          <select aria-label="Chế độ xem" value={mode} onChange={e => setMode(e.target.value)}>
            {Object.entries(calendarModes).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select>
          <button type="button" className="ht-primary" disabled={calendarVersion === null} onClick={() => c.modal(<ThemVaoLich baseline={calendarVersion!} />)}>+ Thêm vào lịch</button>
        </div>
      </div>
      <div className="ht-calendar-layers" aria-label="Loại lịch hiển thị" role="group">
        {Object.entries(nhanLoaiLich).map(([key, label]) => <button type="button" key={key} className={`ht-event-${key}`} aria-pressed={layers.has(key)} onClick={() => setLayers(old => {
          const next = new Set(old)
          if (next.has(key)) next.delete(key)
          else next.add(key)
          return next
        })}><span />{label}</button>)}
        {hasDeadlineStrip && <button type="button" className="ht-deadline-density" aria-expanded={!compactDeadlines}
          onClick={() => setCompactDeadlines(value => !value)}>
          <Icon name="chevron-right" size={13} />{compactDeadlines ? 'Hiện dải hạn' : 'Thu gọn hạn'}
        </button>}
      </div>
      <details className="ht-calendar-options"><summary>Tùy chọn hiển thị{!showCompleted && ' · Đang ẩn mục đã hoàn thành'}</summary><label><input type="checkbox" checked={showCompleted} onChange={event => setShowCompleted(event.target.checked)} />Hiện mục đã hoàn thành</label><small>Ghi nhớ cách xem trên trình duyệt này. Ẩn trên lịch không xóa nhiệm vụ hoặc lịch sử học.</small></details>
      {error && <div className="ht-error" role="alert">{error} <button type="button" onClick={c.reload}>Thử lại</button></div>}
      {(!snapshot && !error) && <p role="status">Đang tải lịch…</p>}
      <div className="ht-calendar-surface" aria-busy={loading}>
        <LichKhungNhin mode={mode} first={first} days={days} date={date} today={today} zone={c.zone}
          events={snapshot?.events.filter(event => layers.has(event.loai) && (showCompleted || event.trangThai !== 'Completed')) ?? []} ready={!!snapshot}
          onDay={openDay} onOpen={event => void openEvent(event)} onToggle={event => void toggleTask(event)}
          toggleDisabled={calendarVersion === null || savingTask || !!error} compactDeadlines={compactDeadlines} />
      </div>
    </>}
    {!calendar && !studyBatch && <div className="ht-study-toolbar">
      {tab === 'sessions' ? <strong>{calendarLabel}</strong>
        : <strong>{tab === 'free' ? free.length + ' khung giờ'
          : c.subjects.find(s => s.id === c.monHoc)?.name || 'Buổi học theo môn'}</strong>}
      <div className="ht-calendar-actions">
        {tab === 'sessions' && <>
      {!studyBatch && <div className="ht-session-statuses" role="group" aria-label="Trạng thái phiên tự học">{Object.entries(statusLabels).map(([key, label]) => <button key={key} type="button" data-session-status={key} aria-pressed={sessionStatus === key} onClick={() => filterSessions(key)}>{label}<small>{key === 'all' ? sessions.length : sessions.filter(row => row.trangThai === key).length}</small></button>)}</div>}
      {!!sessions.length && !filteredSessions.length && <div className="ht-study-empty"><strong>Chưa có phiên trong nhóm này</strong><button type="button" onClick={() => filterSessions('all')}>Xem tất cả phiên</button></div>}
          {dateNavigation}
          <select aria-label="Chế độ xem" value={mode} onChange={e => setMode(e.target.value)}>
            {Object.entries(sessionModes).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select>
        </>}
        {addButton}
      </div>
    </div>}
    {!calendar && error && <div className="ht-error" role="alert">{error} <button type="button" onClick={c.reload}>Thử lại</button></div>}
    {!calendar && loading && <p className="ht-study-caption" role="status">Đang tải lịch…</p>}
    {tab === 'classes' && !loading && !error && !classes.length &&
      <div className="ht-study-empty"><Icon name="book" size={22} />
        <strong>{c.monHoc ? 'Chưa có buổi học' : 'Chọn môn để xem lịch lên lớp'}</strong>
        {c.monHoc && <p>Dùng nút Thêm buổi học để lưu lịch theo thứ và giờ.</p>}
      </div>}
    {tab === 'classes' && !!classes.length && <div className="ht-study-list">{theoThu(classes).map(row =>
      <article className="ht-item ht-study-row" key={row.ma}>
        <div className="ht-study-row-main">
          <strong>{thu[row.thuTrongTuan - 1]} · {row.gioBatDau.slice(0, 5)}–{row.gioKetThuc.slice(0, 5)}</strong>
          <p>{row.phongHoc ? 'Phòng ' + row.phongHoc + ' · ' : ''}{row.ngayApDungTu && row.ngayApDungDen
            ? ngayLich(row.ngayApDungTu) + ' – ' + ngayLich(row.ngayApDungDen) : 'Suốt học kỳ'}</p>
        </div>
        <div className="ht-study-row-actions">
          <button type="button" onClick={() => c.modal(<SuaLich row={row} kind="classes" baseline={baseline!} />)}>Chỉnh sửa</button>
          <button type="button" className="ht-danger" onClick={() => void c.run(async () => {
            if (await xacNhan({ tieuDe: 'Xóa lịch học?', noiDung: <>Xóa buổi học của <strong>{row.tenMonHoc}</strong> vào {thu[row.thuTrongTuan - 1]}, {row.gioBatDau.slice(0, 5)}–{row.gioKetThuc.slice(0, 5)}?</>, luuY: 'Các buổi theo mẫu này sẽ được gỡ khỏi thời khóa biểu.', nguyHiem: true, nhanXacNhan: 'Xóa lịch học', nhanDangXuLy: 'Đang xóa…', khiXacNhan: () => goi(c.token, `/class-sessions/${row.ma}`, { method: 'DELETE', version: baseline! }) })) c.thongBaoThanhCong('Đã xóa lịch học')
          })}>Xóa</button>
        </div>
      </article>)}</div>}
    {tab === 'free' && !loading && !error && !free.length &&
      <div className="ht-study-empty"><Icon name="clock" size={22} /><strong>Chưa có giờ rảnh</strong>
        <p>Chọn những khung giờ bạn muốn dành cho việc tự học.</p>
      </div>}
    {tab === 'free' && !loading && !error && <>
      <div className="ht-study-view-switch" role="group" aria-label="Cách xem giờ rảnh"><button type="button" aria-pressed={freePresentation === 'week'} onClick={() => setFreePresentation('week')}><Icon name="calendar" size={14} /> Theo tuần</button><button type="button" aria-pressed={freePresentation === 'list'} onClick={() => setFreePresentation('list')}><Icon name="list" size={14} /> Danh sách</button></div>
      <p className="ht-study-caption">Các khung giờ lặp theo tuần, mỗi khung có thời hạn áp dụng riêng.</p>
      {freePresentation === 'list' ? <div className="ht-study-list">{theoThu(free).map(freeRow)}</div> : <div className="ht-free-week">{thu.map((name, index) => {
        const rows = theoThu(free.filter(row => row.thuTrongTuan === index + 1))
        return <details className="ht-free-day" key={name}><summary><strong>{name}</strong><span className="ht-free-summary">{rows.length ? rows.map(row => <span key={row.ma}>{row.gioBatDau.slice(0, 5)}–{row.gioKetThuc.slice(0, 5)}{!row.dangSuDung ? ' · Đã tắt' : ''}</span>) : 'Chưa thiết lập'}</span></summary>{rows.length > 0 && <div className="ht-study-list">{rows.map(freeRow)}</div>}</details>
      })}</div>}
    </>}
    {tab === 'sessions' && <>
      {studyBatch && <div className="ht-study-toolbar">
        <strong>Phiên từ gợi ý</strong>
        <div className="ht-study-row-actions">
          <button type="button" onClick={() => c.moTab('sessions')}>Về danh sách phiên</button>
          {sessions[0] && <button type="button" onClick={() => c.moTab('calendar', { date: ngay(sessions[0].batDauDuKien, c.zone) })}>Xem trên thời khóa biểu</button>}
        </div>
      </div>}
      {!studyBatch && c.nhiemVuXemPhien && <div className="ht-study-toolbar">
        <strong>{c.nhiemVuXemPhien.tieuDe}</strong>
        <button type="button" onClick={() => c.xemPhienNhiemVu(null)}>Xem tất cả phiên</button>
      </div>}
      {!sessions.length && !loading && !error && <div className="ht-study-empty"><Icon name="clock" size={22} />
        <strong>{studyBatch ? 'Lần áp dụng này không còn phiên nào' : 'Chưa có phiên tự học trong khoảng này'}</strong>
        {!studyBatch && <button type="button" onClick={() => c.moTab('planning')}>Xem gợi ý tự học</button>}
      </div>}
      {[...sessionDays.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, rows]) =>
        <section className="ht-study-day" key={day}>
          <h2>{day === today ? 'Hôm nay' : ngayLich(day, studyDayLabel)}</h2>
          <div className="ht-study-list">
            {rows.map(row => <article className="ht-item ht-study-row" data-session-id={row.ma} key={row.ma}>
              <span className="ht-session-row-icon"><Icon name={row.trangThai === 'InProgress' ? 'play' : 'book'} size={19} /></span>
              <div className="ht-study-row-main">
                <strong>{row.tieuDeNhiemVu ?? 'Nhiệm vụ #' + row.maNhiemVu}</strong>
                <p>{gioNhap(row.batDauDuKien, c.zone).slice(11)}–{ngay(row.ketThucDuKien, c.zone) === day
                  ? gioNhap(row.ketThucDuKien, c.zone).slice(11) : hienGio(row.ketThucDuKien, c.zone)} · {Math.round((Date.parse(row.ketThucDuKien) - Date.parse(row.batDauDuKien)) / 60000)} phút</p>
              </div>
              <span className="ht-study-badge" data-tone={statusTone[row.trangThai]}>{row.trangThai === 'Planned' && Date.parse(row.ketThucDuKien) <= Date.now() ? 'Cần xác nhận' : row.trangThai === 'InProgress' ? 'Đang học' : trangThai[row.trangThai]}</span>
              <div className="ht-study-row-actions">{row.trangThai === 'Planned' && Date.parse(row.ketThucDuKien) > Date.now() && <button type="button" className="ht-primary" onClick={() => void openSession(row.ma, true)}><Icon name="play" size={13} /> Bắt đầu</button>}{row.trangThai === 'InProgress' && <button type="button" className="ht-primary" onClick={() => navigate('/focus?session=' + row.ma)}>Mở đồng hồ</button>}<button type="button" onClick={() => void openSession(row.ma)}>Mở phiên</button></div>
            </article>)}
          </div>
        </section>)}
    </>}
  </section>
}

function SuaLich({ kind, row, baseline }: { kind: 'free' | 'classes'; row?: GioRanh | LopHoc; baseline: number }) {
  const c = useHocTap()
  const isFree = kind === 'free'
  const free = row as GioRanh | undefined
  const lesson = row as LopHoc | undefined
  const today = ngay(Date.now(), c.zone)
  const [toanHocKy, setToanHocKy] = useState(!lesson?.ngayApDungTu && !lesson?.ngayApDungDen)
  const [tuNgay, setTuNgay] = useState(lesson?.ngayApDungTu ?? '')
  const [denNgay, setDenNgay] = useState(lesson?.ngayApDungDen ?? '')
  const [weekdays, setWeekdays] = useState<number[]>([1])
  return <BieuMau title={isFree ? 'Giờ rảnh để tự học' : 'Buổi học theo môn'} onSubmit={async form => {
    const subject = lesson?.maMonHoc ?? Number(form.get('maMonHoc'))
    const shared = {
      thuTrongTuan: Number(form.get('thuTrongTuan')),
      gioBatDau: form.get('gioBatDau') === row?.gioBatDau.slice(0, 5) ? row.gioBatDau : String(form.get('gioBatDau')) + ':00',
      gioKetThuc: form.get('gioKetThuc') === row?.gioKetThuc.slice(0, 5) ? row.gioKetThuc : String(form.get('gioKetThuc')) + ':00',
    }
    const body = isFree ? { ...shared, ngayBatDau: String(form.get('ngayBatDau')), ngayKetThuc: String(form.get('ngayKetThuc')), dangSuDung: form.has('dangSuDung') } : { ...shared, phongHoc: String(form.get('phongHoc') ?? '') || null, ngayApDungTu: form.has('toanHocKy') ? null : String(form.get('ngayBatDau') ?? '') || null, ngayApDungDen: form.has('toanHocKy') ? null : String(form.get('ngayKetThuc') ?? '') || null }
    if (isFree && !row) {
      if (!weekdays.length) throw new Error('Chọn ít nhất một ngày trong tuần.')
      return goi(c.token, '/availability-windows/batch', { method: 'POST', version: baseline, body: { ...body, thuTrongTuan: [...weekdays].sort((a, b) => a - b) } })
    }
    const path = isFree ? '/availability-windows' + (row ? '/' + row.ma : '') : row ? '/class-sessions/' + row.ma : `/courses/${subject}/class-sessions`
    const result = await thayDoi(c.token, path, row ? 'PUT' : 'POST', body, baseline, { path: '/calendar/change-preview', body: { loai: isFree ? 'GioRanh' : 'LichHoc', ma: row?.ma ?? null, maMonHoc: isFree ? null : subject, khungGioRanh: isFree ? body : null, lichHoc: isFree ? null : body } })
    if (result && !isFree && !row) c.chonMonHoc(String(subject))
    return result
  }}>
    {!isFree && <ChonPhamVi subject={lesson?.maMonHoc?.toString() ?? c.monHoc} semester={c.hocKy} requiredSubject locked={!!row} />}
    {!isFree && !c.subjects.length && <p className="ht-note">Tạo môn học ở mục Các môn học rồi quay lại chọn tên môn.</p>}
    {isFree && !row ? <fieldset className="ht-weekday-picker"><legend>Ngày trong tuần</legend><div className="ht-weekday-shortcuts"><button type="button" onClick={() => setWeekdays([1, 2, 3, 4, 5])}>Thứ Hai–Thứ Sáu</button><button type="button" onClick={() => setWeekdays([1, 2, 3, 4, 5, 6, 7])}>Cả tuần</button><button type="button" onClick={() => setWeekdays([])}>Bỏ chọn</button></div><div className="ht-weekday-choices">{thu.map((name, index) => <label key={name}><input type="checkbox" name="thuDuocChon" value={index + 1} checked={weekdays.includes(index + 1)} onChange={event => setWeekdays(current => event.target.checked ? [...current, index + 1] : current.filter(day => day !== index + 1))} />{name}</label>)}</div><small>Nhập một lần, tự lặp mỗi tuần trong khoảng ngày bên dưới.</small></fieldset> : <label>Ngày trong tuần<select name="thuTrongTuan" defaultValue={row?.thuTrongTuan ?? 1}>{thu.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select></label>}
    <div className="ht-fields"><label>Bắt đầu<input name="gioBatDau" type="time" required defaultValue={row?.gioBatDau.slice(0, 5) ?? '19:00'} /></label><label>Kết thúc<input name="gioKetThuc" type="time" required defaultValue={row?.gioKetThuc.slice(0, 5) ?? '21:00'} /></label></div>
    {!isFree && <label className="ht-check"><input name="toanHocKy" type="checkbox" checked={toanHocKy} onChange={event => setToanHocKy(event.target.checked)} />Áp dụng suốt học kỳ</label>}
    {isFree ? <div className="ht-fields"><label>Áp dụng từ ngày<input type="date" required name="ngayBatDau" defaultValue={free?.ngayBatDau ?? today} /></label><label>Đến ngày<input type="date" required name="ngayKetThuc" defaultValue={free?.ngayKetThuc ?? congNgay(today, 90)} /></label></div> : !toanHocKy && <div className="ht-fields"><label>Áp dụng từ ngày<input type="date" required name="ngayBatDau" value={tuNgay} onChange={event => setTuNgay(event.target.value)} /></label><label>Đến ngày<input type="date" required name="ngayKetThuc" min={tuNgay || undefined} value={denNgay} onChange={event => setDenNgay(event.target.value)} /></label></div>}
    {isFree ? <label className="ht-check"><input name="dangSuDung" type="checkbox" defaultChecked={free?.dangSuDung ?? true} />Sử dụng khung giờ này</label> : <label>Phòng học<input name="phongHoc" maxLength={200} defaultValue={lesson?.phongHoc ?? ''} /></label>}
  </BieuMau>
}
function ThemVaoLich({ baseline }: { baseline: number }) {
  const c = useHocTap()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog className="ht-dialog" ref={dialog} aria-label="Thêm vào thời khóa biểu" onCancel={c.close}>
    <header><h2>Thêm vào thời khóa biểu</h2><button onClick={c.close}>Đóng</button></header>
    <div className="ht-toolbar">
      <button onClick={() => c.modal(<SuaLich kind="classes" baseline={baseline} />)}>Lịch học theo môn</button>
      <button onClick={() => c.modal(<DatPhien baseline={baseline} />)}>Phiên tự học</button>
      <button onClick={() => c.modal(<SuaNhiemVu baseline={baseline} />)}>Nhiệm vụ hoặc sự kiện</button>
      <button onClick={() => c.modal(<SuaLich kind="free" baseline={baseline} />)}>Giờ rảnh</button>
    </div>
  </dialog>
}
function DatPhien({ row, task, baseline }: { row?: Phien; task?: NhiemVu; baseline: number }) {
  const c = useHocTap()
  const studySettings = useStudySettings(c.token)
  const [choices, setChoices] = useState<NhiemVu[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      goi<{ danhSach: NhiemVu[] }>(c.token, '/tasks?' + new URLSearchParams({ chiLa: 'true', kichThuocTrang: '100', tuKhoa: search }), { signal: controller.signal }).then(r => setChoices(r.duLieu.danhSach)).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [c.token, search])
  return <BieuMau disabled={!studySettings.data || studySettings.loading} title={row ? 'Dời phiên tự học' : 'Đặt phiên tự học'} onSubmit={form => goi(c.token, '/study-sessions' + (row ? '/' + row.ma : ''), { method: row ? 'PUT' : 'POST', version: baseline, body: {
    maNhiemVu: row?.maNhiemVu ?? task?.ma ?? Number(form.get('maNhiemVu')), batDauDuKien: thoiDiemGui(String(form.get('batDau')), row?.batDauDuKien ?? null, c.zone), ketThucDuKien: thoiDiemGui(String(form.get('ketThuc')), row?.ketThucDuKien ?? null, c.zone), ghiChu: String(form.get('ghiChu') ?? '') || null,
  } })}>
    {task && <p className="ht-note">Đặt phiên cho “{task.tieuDe}”.</p>}
    {!row && !task && <><label>Tìm nhiệm vụ theo tên<input value={search} onChange={e => setSearch(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<label>Nhiệm vụ<select name="maNhiemVu" required><option value="">Chọn việc cần học</option>{choices.map(t => <option value={t.ma} key={t.ma}>{t.tieuDe}</option>)}</select></label></>}
    <label>Bắt đầu<input name="batDau" required type="datetime-local" defaultValue={gioNhap(row?.batDauDuKien ?? null, c.zone)} /></label><label>Kết thúc<input name="ketThuc" required type="datetime-local" defaultValue={gioNhap(row?.ketThucDuKien ?? null, c.zone)} /></label><label>Ghi chú<textarea name="ghiChu" maxLength={2000} defaultValue={row?.ghiChu ?? ''} /></label><p className="ht-note">{studySettings.data ? `Phiên tối đa ${studySettings.data.phienHocPhut} phút, nghỉ ${studySettings.data.nghiGiuaPhienPhut} phút và nằm trong giờ rảnh.` : "Đang tải cấu hình học…"}</p>{studySettings.error && <p className="ht-error" role="alert">{studySettings.error} <button type="button" onClick={studySettings.refresh}>Tải lại cấu hình</button></p>}
  </BieuMau>
}
function dinhDangBamGio(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const parts = [Math.floor(seconds / 60) % 60, seconds % 60]
  if (hours > 0) parts.unshift(hours)
  return parts.map(value => String(value).padStart(2, '0')).join(':')
}

function PhienChiTiet({ row: initialRow, baseline: initialVersion, selectMode = false }: { row: Phien; baseline: number; selectMode?: boolean }) {
  const c = useHocTap()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const [{ row, version }, setSession] = useState({ row: initialRow, version: initialVersion })
  const [task, setTask] = useState<NhiemVu | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const taskId = row.maNhiemVu
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    if (row.trangThai !== 'Planned' && !row.batDauBamGio) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [row.trangThai, row.batDauBamGio])
  useEffect(() => {
    const controller = new AbortController()
    goi<NhiemVu>(c.token, `/tasks/${taskId}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setTask(result.duLieu)
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [c.token, taskId])

  const [chooseMode, setChooseMode] = useState(selectMode)
  const [chosenMode, setChosenMode] = useState<FocusRecord['cheDo']>('Pomodoro')
  const focusSettings = useStudySettings(c.token)
  const before = now < Date.parse(row.batDauDuKien)
  const ended = now >= Date.parse(row.ketThucDuKien)
  const running = row.trangThai === 'InProgress'
  const completed = row.trangThai === 'Completed'
  const missed = row.trangThai === 'Missed'
  const planned = row.trangThai === 'Planned'
  const actions = running ? [] : !planned ? [] : before ? [['start', 'Bắt đầu ngay'], ['cancel', 'Hủy phiên']] : ended ? [['finish', 'Xác nhận đã học xong'], ['miss', 'Xác nhận bỏ lỡ']] : [['start', 'Bắt đầu học']]
  const lines = task?.moTa?.split(/\r?\n/) ?? []
  const isLink = (line: string) => /^https?:\/\/\S+$/i.test(line.trim()) && URL.canParse(line.trim())
  const checklistTitles = task?.checklist?.map(item => item.tieuDe) ?? []
  const links = [...new Set([...lines, ...checklistTitles].filter(isLink).map(line => line.trim()))]
  const description = lines.filter(line => !isLink(line)).join('\n').trim()
  const measured = row.soGiayDaHoc != null
  const elapsed = (row.soGiayDaHoc ?? 0) + (row.batDauBamGio ? Math.max(0, Math.floor((now - Date.parse(row.batDauBamGio)) / 1000)) : 0)
  const plannedMinutes = Math.round((Date.parse(row.ketThucDuKien) - Date.parse(row.batDauDuKien)) / 60000)
  const path = `/study-sessions/${row.ma}`
  const nextStep = running ? 'Mở đồng hồ Tập trung để xem thời gian, tạm dừng, tiếp tục hoặc kết thúc phiên. Tiến độ nhiệm vụ có thể cập nhật sau khi học.'
    : completed ? 'Phiên đã kết thúc. Bạn có thể cập nhật tiến độ theo phần thực sự làm được hoặc để sau. Kết thúc phiên không tự hoàn thành nhiệm vụ.'
    : missed ? 'Bạn có thể tạo gợi ý mới để xếp lại phần việc chưa làm.'
    : !planned ? ''
    : before ? 'Bạn có thể bắt đầu ngay khi sẵn sàng. Đồng hồ ghi giờ thực tế và giữ lịch dự kiến để đối chiếu.'
    : ended ? 'Chọn kết quả theo thực tế. Xác nhận học xong ở đây sẽ ghi nhận trạng thái phiên.'
    : 'Đã đến giờ. Bấm Bắt đầu học để chọn chế độ.'
  async function change(action?: string) {
    if (busy) return
    if (action === 'start') { setChooseMode(true); return }
    setBusy(true); setError('')
    try {
      const result = action
        ? await goi<Phien>(c.token, path + '/' + action, { method: 'POST', version })
        : await goi<Phien>(c.token, path)
      setNow(Date.now())
      setSession({ row: result.duLieu, version: result.phienBan })
      if (action) c.reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa cập nhật được phiên tự học.') }
    finally { setBusy(false) }
  }
  function startWith(mode: FocusRecord['cheDo']) {
    const query = new URLSearchParams({ session: String(row.ma), mode })
    c.close()
    navigate('/focus?' + query)
  }
  async function updateProgress() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await goi<NhiemVu>(c.token, `/tasks/${taskId}`)
      c.modal(result.duLieu.coNhiemVuCon || result.duLieu.checklist?.length || result.duLieu.tienDo === 100
        ? <ChiTietNhiemVu ma={taskId} />
        : <DoiTienDo task={result.duLieu} baseline={result.phienBan} />)
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa mở được tiến độ nhiệm vụ.') }
    finally { setBusy(false) }
  }
  return <dialog className="ht-dialog ht-study-session" ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else c.close() }} aria-label="Chi tiết phiên tự học">
    <header><h2>Phiên tự học</h2><button disabled={busy} onClick={c.close}>Đóng</button></header>
    {error && <div className="ht-error"><span role="alert">{error}</span> <button disabled={busy} onClick={() => void change()}>Tải lại phiên</button></div>}
    <h3>{task?.tieuDe ?? 'Nhiệm vụ #' + taskId}</h3>
    <p>{hienGio(row.batDauDuKien, c.zone)} → {hienGio(row.ketThucDuKien, c.zone)} · {plannedMinutes} phút dự kiến</p>
    <p>{running ? 'Đang học' : trangThai[row.trangThai]}</p>
    {completed && measured && <div className="ht-stopwatch">
      <span>Thời gian đã học</span>
      <strong role="timer" aria-label="Thời gian đã học">{dinhDangBamGio(elapsed)}</strong>
    </div>}
    {(completed || running) && !measured && <p className="ht-note">Phiên này chưa có thời lượng ghi bằng đồng hồ.</p>}
    {!chooseMode && <>{description && <p className="ht-preserve">{description}</p>}
    {row.ghiChu && <p className="ht-preserve">{row.ghiChu}</p>}
    {links.length > 0 && <ul className="ht-study-materials" aria-label="Tài liệu của nhiệm vụ">
      {links.map((link, index) => <li key={link}><a href={link} target="_blank" rel="noopener noreferrer">Mở tài liệu{links.length > 1 ? ' ' + (index + 1) : ''} · {new URL(link).hostname}</a></li>)}
    </ul>}
    {completed && task && <p>Tiến độ nhiệm vụ: {task.tienDo}%</p>}</>}
    {nextStep && !chooseMode && <p className="ht-note">{nextStep}</p>}
    {chooseMode && planned && !ended && <section aria-labelledby="ht-focus-mode-heading">
      <h4 id="ht-focus-mode-heading">Chọn chế độ học</h4>
      <p className="ht-note">Lịch dự kiến dành {plannedMinutes} phút cho phiên này. {focusSettings.data ? `Pomodoro đếm ngược ${focusSettings.data.phienHocPhut} phút mỗi lượt, nghỉ ${focusSettings.data.nghiGiuaPhienPhut} phút.` : 'Đang tải thời lượng Pomodoro…'} Đếm lên ghi thời gian thực tế đến khi bạn dừng.</p>
      {focusSettings.data && focusSettings.data.phienHocPhut > plannedMinutes && <p className="ht-note">Một lượt Pomodoro dài hơn phiên dự kiến. Bạn có thể kết thúc sớm hoặc chọn Đếm lên.</p>}
      {focusSettings.error && <p role="alert">{focusSettings.error} <button type="button" onClick={focusSettings.refresh}>Tải lại cấu hình</button></p>}
      <div className="ht-mode-cards" role="radiogroup" aria-label="Chế độ học" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const mode = event.key === 'Home' ? 'Pomodoro' : event.key === 'End' ? 'Stopwatch' : chosenMode === 'Pomodoro' ? 'Stopwatch' : 'Pomodoro'
        setChosenMode(mode)
        event.currentTarget.querySelector<HTMLButtonElement>(`[aria-label="${mode === 'Pomodoro' ? 'Pomodoro' : 'Đếm lên'}"]`)?.focus()
      }}>
        <button type="button" role="radio" aria-label="Pomodoro" tabIndex={chosenMode === 'Pomodoro' ? 0 : -1} aria-checked={chosenMode === 'Pomodoro'} className="ht-mode-card" onClick={() => setChosenMode('Pomodoro')}><Icon name="clock" size={28} /><strong>Pomodoro</strong><small>{focusSettings.data ? `${focusSettings.data.phienHocPhut} phút học, ${focusSettings.data.nghiGiuaPhienPhut} phút nghỉ` : 'Theo cấu hình học và nghỉ'}</small>{chosenMode === 'Pomodoro' && <span className="ht-mode-mark"><Icon name="check" size={15} /></span>}</button>
        <button type="button" role="radio" aria-label="Đếm lên" tabIndex={chosenMode === 'Stopwatch' ? 0 : -1} aria-checked={chosenMode === 'Stopwatch'} className="ht-mode-card" onClick={() => setChosenMode('Stopwatch')}><Icon name="play" size={28} /><strong>Đếm lên</strong><small>Ghi thời gian học thực tế đến khi bạn dừng.</small>{chosenMode === 'Stopwatch' && <span className="ht-mode-mark"><Icon name="check" size={15} /></span>}</button>
      </div>
      <button type="button" className="ht-primary ht-mode-confirm" disabled={chosenMode === 'Pomodoro' && (!focusSettings.data || focusSettings.loading)} onClick={() => startWith(chosenMode)}>Bắt đầu học</button>
      <button type="button" onClick={() => setChooseMode(false)}>Quay lại</button>
    </section>}
    <div className="ht-toolbar">
      {running && <button type="button" className="ht-primary" disabled={busy} onClick={() => { c.close(); navigate('/focus?session=' + row.ma) }}>Mở đồng hồ tập trung</button>}
      {actions.filter(([action]) => !chooseMode || action !== 'start').map(([action, label]) => <button type="button" className={action === 'start' || action === 'finish' ? 'ht-primary' : undefined} disabled={busy} key={action} onClick={() => void change(action)}>{label}</button>)}
      {completed && task?.tienDo !== 100 && <button className="ht-primary" disabled={busy} onClick={() => void updateProgress()}>Cập nhật tiến độ nhiệm vụ</button>}
      {missed && <button className="ht-primary" disabled={busy} onClick={() => { c.close(); c.moTab('planning') }}>Tạo gợi ý mới</button>}
      {planned && before && <button disabled={busy} onClick={() => c.modal(<DatPhien row={row} baseline={version} />)}>Dời phiên</button>}
      <button disabled={busy} onClick={() => c.modal(<ChiTietNhiemVu ma={taskId} />)}>Xem nhiệm vụ</button>
    </div>
  </dialog>
}
