import { useEffect, useRef, useState } from 'react'
import { xacNhan } from './xacNhan'
import type { CSSProperties } from 'react'
import { BieuMau, ChonPhamVi, useHocTap } from './HocTapPage'
import { ChiTietNhiemVu, SuaNhiemVu } from './NhiemVuView'
import { goi, thayDoi } from './api'
import { congNgay, dauTuan, doiKhoang, gioNhap, hienGio, ngay, thu, thoiDiemGui, trangThai, trongKhoang, utc } from './time'
import type { GioRanh, Lich, LopHoc, NhiemVu, Phien, SuKien } from './types'
import { xepKhoiLich } from './lich'

const nhanLoai: Record<string, string> = { LichHoc: 'Học trên lớp', SuKien: 'Sự kiện', HanNhiemVu: 'Hạn hoàn thành', PhienTuHoc: 'Tự học', GioRanh: 'Giờ rảnh' }
export function LichView({ tab }: { tab: string }) {
  const c = useHocTap()
  const [date, setDate] = useState(ngay(Date.now(), c.zone))
  const [mode, setMode] = useState(tab === 'sessions' ? 'period' : 'week')
  const [events, setEvents] = useState<SuKien[]>([])
  const [free, setFree] = useState<GioRanh[]>([])
  const [classes, setClasses] = useState<LopHoc[]>([])
  const [sessions, setSessions] = useState<(Phien & { tieuDe: string })[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [baseline, setBaseline] = useState<number | null>(null)
  const [layers, setLayers] = useState(new Set(Object.keys(nhanLoai)))
  const first = mode === 'period' ? congNgay(date, -7) : mode === 'month' ? dauTuan(date.slice(0, 8) + '01') : mode === 'week' ? dauTuan(date) : date
  const days = mode === 'period' ? 38 : mode === 'month' ? 42 : mode === 'week' || mode === 'agenda' ? 7 : 1
  const start = utc(first + 'T00:00', c.zone)!
  const end = utc(congNgay(first, days) + 'T00:00', c.zone)!
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
        if (!c.monHoc) { setClasses([]); setBaseline(c.version); return }
        const r = await goi<LopHoc[]>(c.token, `/courses/${c.monHoc}/class-sessions`, { signal: controller.signal })
        if (!controller.signal.aborted) { setClasses(r.duLieu); setBaseline(r.phienBan) }
      } else if (tab === 'sessions') {
        const sessionQuery = new URLSearchParams({ tu: start, den: end })
        if (c.nhiemVuXemPhien) sessionQuery.set('maNhiemVu', String(c.nhiemVuXemPhien.ma))
        const r = await goi<Phien[]>(c.token, '/study-sessions?' + sessionQuery, { signal: controller.signal })
        const ids = [...new Set(r.duLieu.map(p => p.maNhiemVu))]
        const taskDetails = new Map<number, NhiemVu>()
        for (const id of ids) {
          const task = await goi<NhiemVu>(c.token, `/tasks/${id}`, { signal: controller.signal })
          taskDetails.set(id, task.duLieu)
        }
        if (!controller.signal.aborted) {
          const scoped = r.duLieu.filter(p => {
            const task = taskDetails.get(p.maNhiemVu)!
            return !!c.nhiemVuXemPhien || ((!c.hocKy || String(task.maHocKy) === c.hocKy) && (!c.monHoc || String(task.maMonHoc) === c.monHoc))
          })
          setSessions(scoped.map(p => ({ ...p, tieuDe: taskDetails.get(p.maNhiemVu)!.tieuDe })))
          setBaseline(r.phienBan)
        }
      } else {
        const r = await goi<Lich>(c.token, '/calendar?' + query, { signal: controller.signal })
        if (!controller.signal.aborted) { setEvents(r.duLieu.suKien); setBaseline(r.phienBan) }
      }
    }
    load().catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [tab, c.token, c.hocKy, c.monHoc, c.zone, c.version, c.nhiemVuXemPhien, start, end])
  async function openEvent(event: SuKien) {
    try {
      if (event.loai === 'HanNhiemVu' || event.loai === 'SuKien') { c.modal(<ChiTietNhiemVu ma={event.maNguon} />); return }
      if (event.loai === 'GioRanh') {
        const r = await goi<GioRanh>(c.token, `/availability-windows/${event.maNguon}`)
        c.modal(<SuaLich row={r.duLieu} kind="free" baseline={r.phienBan} />)
      } else if (event.loai === 'LichHoc') {
        const r = await goi<LopHoc>(c.token, `/class-sessions/${event.maNguon}`)
        c.modal(<SuaLich row={r.duLieu} kind="classes" baseline={r.phienBan} />)
      } else {
        const r = await goi<Phien>(c.token, `/study-sessions/${event.maNguon}`)
        c.modal(<PhienChiTiet row={r.duLieu} baseline={r.phienBan} />)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa mở được chi tiết lịch.') }
  }
  function card(event: SuKien, style?: CSSProperties) {
    return <button key={event.ma} className={'ht-event ht-event-' + event.loai} onClick={() => void openEvent(event)} style={{ borderLeftColor: event.mauSac ?? undefined, ...style }}>
      <small>{nhanLoai[event.loai]} · {gioNhap(event.batDau, c.zone).slice(11)}{event.ketThuc ? '–' + gioNhap(event.ketThuc, c.zone).slice(11) : ''}</small><strong>{event.tieuDe}</strong>
      {event.trangThai && <small>{trangThai[event.trangThai]}</small>}
    </button>
  }
  const today = ngay(Date.now(), c.zone)
  return <section>
    <div className="ht-toolbar">
      <button disabled={baseline === null} className="ht-primary" onClick={() => c.modal(tab === 'calendar' ? <ThemVaoLich baseline={baseline!} /> : tab === 'sessions' ? <DatPhien baseline={baseline!} task={c.nhiemVuXemPhien ?? undefined} /> : <SuaLich kind={tab === 'free' ? 'free' : 'classes'} baseline={baseline!} />)}>{tab === 'calendar' ? '+ Thêm vào lịch' : tab === 'free' ? '+ Thêm giờ rảnh' : tab === 'sessions' ? '+ Đặt phiên tự học' : '+ Thêm buổi học'}</button>
      {(tab === 'calendar' || tab === 'sessions') && <>
        <button aria-label="Khoảng trước" onClick={() => setDate(doiKhoang(date, -1, mode, days))}>←</button><input aria-label="Ngày đang xem" type="date" value={date} onChange={e => { if (e.target.value) setDate(e.target.value) }} /><button aria-label="Khoảng sau" onClick={() => setDate(doiKhoang(date, 1, mode, days))}>→</button><button onClick={() => setDate(today)}>Hôm nay</button>
        <label>Chế độ xem<select value={mode} onChange={e => setMode(e.target.value)}>{tab === 'sessions' && <option value="period">7 ngày trước đến 31 ngày tới</option>}{Object.entries({ day: 'Ngày', week: 'Tuần', month: 'Tháng', agenda: 'Danh sách 7 ngày' }).map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select></label>
      </>}
    </div>
    {error && <p role="alert" className="ht-error">{error}</p>}{loading && <p role="status">Đang tải lịch…</p>}
    {tab === 'calendar' && <>
      <div className="ht-toolbar">{Object.entries(nhanLoai).map(([key, label]) => <label key={key} className="ht-check"><input type="checkbox" checked={layers.has(key)} onChange={e => setLayers(old => { const next = new Set(old); if (e.target.checked) next.add(key); else next.delete(key); return next })} />{label}</label>)}</div>
      {(mode === 'day' || mode === 'week') ? <div className="ht-time-grid-wrap"><div className="ht-time-grid" style={{ gridTemplateColumns: `55px repeat(${days}, minmax(140px, 1fr))` }}>
        <div className="ht-time-heading" />
        {Array.from({ length: days }, (_, i) => {
          const day = congNgay(first, i)
          return <header className="ht-time-heading" key={day}><strong>{day}</strong>{events.filter(e => layers.has(e.loai) && e.loai === 'HanNhiemVu' && ngay(e.batDau, c.zone) === day).map(e => card(e))}</header>
        })}
        <div className="ht-hour-column">{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: hour * 60 }}>{String(hour).padStart(2, '0')}:00</span>)}</div>
        {Array.from({ length: days }, (_, i) => {
          const day = congNgay(first, i)
          return <div className="ht-time-column" key={day}>{xepKhoiLich(day, events.filter(e => layers.has(e.loai)), c.zone).map(block => card(block.suKien, {
            position: 'absolute', top: block.top, height: block.height, margin: 0,
            left: `calc(${block.cot / block.soCot * 100}% + 2px)`, width: `calc(${100 / block.soCot}% - 4px)`,
            zIndex: block.suKien.loai === 'GioRanh' ? 0 : 1, overflow: 'hidden',
          }))}</div>
        })}
      </div></div> : <div className={'ht-calendar ht-calendar-' + mode}>{Array.from({ length: days }, (_, i) => {
        const day = congNgay(first, i)
        const dayStart = Date.parse(utc(day + 'T00:00', c.zone)!)
        const dayEnd = Date.parse(utc(congNgay(day, 1) + 'T00:00', c.zone)!)
        const matches = events.filter(e => layers.has(e.loai) && trongKhoang(e.batDau, e.ketThuc, dayStart, dayEnd))
        return <section key={day} className={'ht-day' + (day === today ? ' ht-today' : '')}><button className="ht-day-name" onClick={() => { setDate(day); setMode('day') }}>{new Date(day + 'T12:00:00Z').toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' })}</button>
          {matches.slice(0, mode === 'month' ? 4 : matches.length).map(event => card(event))}{mode === 'month' && matches.length > 4 && <button onClick={() => { setDate(day); setMode('day') }}>Xem thêm {matches.length - 4} mục</button>}{!matches.length && <small className="ht-muted">Chưa có lịch</small>}
        </section>
      })}</div>}
    </>}
    {tab === 'classes' && <>{!c.monHoc && <p className="ht-note">Chọn tên môn học ở bộ lọc phía trên để quản lý các buổi học của môn.</p>}{classes.map(row => <article className="ht-item" key={row.ma}><div><strong>{c.subjects.find(s => Number(s.id) === row.maMonHoc)?.name ?? row.tenMonHoc}</strong><p>{thu[row.thuTrongTuan - 1]} · {row.gioBatDau.slice(0, 5)}–{row.gioKetThuc.slice(0, 5)} · {row.phongHoc || 'Chưa có phòng'}</p></div><button onClick={() => c.modal(<SuaLich row={row} kind="classes" baseline={baseline!} />)}>Chỉnh sửa</button><button className="ht-danger" onClick={() => void c.run(async () => {
      if (await xacNhan({ tieuDe: 'Xóa lịch học?', noiDung: <>Xóa buổi học của <strong>{row.tenMonHoc}</strong> vào {thu[row.thuTrongTuan - 1]}, {row.gioBatDau.slice(0, 5)}–{row.gioKetThuc.slice(0, 5)}?</>, luuY: 'Các lần xuất hiện theo mẫu buổi học này sẽ được gỡ khỏi lịch.', nguyHiem: true, nhanXacNhan: 'Xóa lịch học', nhanDangXuLy: 'Đang xóa…', khiXacNhan: () => goi(c.token, `/class-sessions/${row.ma}`, { method: 'DELETE', version: baseline! }) })) c.thongBaoThanhCong('Đã xóa lịch học.')
    })}>Xóa</button></article>)}</>}
    {tab === 'free' && <>{!free.length && !loading && <p className="ht-empty">Thêm những khoảng bạn sẵn sàng tự học để hệ thống gợi ý lịch.</p>}{free.map(row => <article className="ht-item" key={row.ma}><div><strong>{thu[row.thuTrongTuan - 1]} · {row.gioBatDau.slice(0, 5)}–{row.gioKetThuc.slice(0, 5)}</strong><p>{row.ngayBatDau} → {row.ngayKetThuc} · {row.dangSuDung ? 'Đang sử dụng' : 'Đã tắt'}</p></div><button onClick={() => c.modal(<SuaLich row={row} kind="free" baseline={baseline!} />)}>Chỉnh sửa</button><button className="ht-danger" onClick={() => void c.run(async () => {
        if (!await xacNhan({ tieuDe: 'Xóa giờ rảnh?', noiDung: `Xóa khung giờ rảnh ${thu[row.thuTrongTuan - 1]}, ${row.gioBatDau.slice(0, 5)}–${row.gioKetThuc.slice(0, 5)}?`, luuY: 'Hệ thống sẽ kiểm tra các phiên tự học bị ảnh hưởng trước khi xóa.', nguyHiem: true, nhanXacNhan: 'Xóa giờ rảnh' })) return
        const result = await thayDoi(c.token, `/availability-windows/${row.ma}`, 'DELETE', undefined, baseline!, { path: '/calendar/change-preview', body: { loai: 'GioRanh', ma: row.ma, xoa: true } })
        if (result) c.thongBaoThanhCong('Đã xóa khung giờ rảnh.')
        return result
      })}>Xóa</button></article>)}</>}
    {tab === 'sessions' && <>{c.nhiemVuXemPhien && <p className="ht-note">Các phiên của “{c.nhiemVuXemPhien.tieuDe}” <button onClick={() => c.xemPhienNhiemVu(null)}>Xem tất cả phiên</button></p>}{!sessions.length && !loading && <p className="ht-empty">Chưa có phiên tự học trong khoảng đang xem.</p>}{sessions.map(row => <article className="ht-item" data-session-id={row.ma} key={row.ma}><div><strong>{row.tieuDe}</strong><p>{hienGio(row.batDauDuKien, c.zone)} → {hienGio(row.ketThucDuKien, c.zone)}</p><small>{trangThai[row.trangThai]}</small></div><button onClick={() => c.modal(<PhienChiTiet row={row} baseline={baseline!} />)}>Xem và cập nhật</button></article>)}</>}
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
  return <BieuMau title={isFree ? 'Giờ rảnh để tự học' : 'Buổi học theo môn'} onSubmit={async form => {
    const subject = lesson?.maMonHoc ?? Number(form.get('maMonHoc'))
    const shared = {
      thuTrongTuan: Number(form.get('thuTrongTuan')),
      gioBatDau: form.get('gioBatDau') === row?.gioBatDau.slice(0, 5) ? row.gioBatDau : String(form.get('gioBatDau')) + ':00',
      gioKetThuc: form.get('gioKetThuc') === row?.gioKetThuc.slice(0, 5) ? row.gioKetThuc : String(form.get('gioKetThuc')) + ':00',
    }
    const body = isFree ? { ...shared, ngayBatDau: String(form.get('ngayBatDau')), ngayKetThuc: String(form.get('ngayKetThuc')), dangSuDung: form.has('dangSuDung') } : { ...shared, phongHoc: String(form.get('phongHoc') ?? '') || null, ngayApDungTu: form.has('toanHocKy') ? null : String(form.get('ngayBatDau') ?? '') || null, ngayApDungDen: form.has('toanHocKy') ? null : String(form.get('ngayKetThuc') ?? '') || null }
    const path = isFree ? '/availability-windows' + (row ? '/' + row.ma : '') : row ? '/class-sessions/' + row.ma : `/courses/${subject}/class-sessions`
    const result = await thayDoi(c.token, path, row ? 'PUT' : 'POST', body, baseline, { path: '/calendar/change-preview', body: { loai: isFree ? 'GioRanh' : 'LichHoc', ma: row?.ma ?? null, maMonHoc: isFree ? null : subject, khungGioRanh: isFree ? body : null, lichHoc: isFree ? null : body } })
    if (result && !isFree && !row) c.chonMonHoc(String(subject))
    return result
  }}>
    {!isFree && <ChonPhamVi subject={lesson?.maMonHoc?.toString() ?? c.monHoc} semester={c.hocKy} requiredSubject locked={!!row} />}
    {!isFree && !c.subjects.length && <p className="ht-note">Tạo môn học ở mục Các môn học rồi quay lại chọn tên môn.</p>}
    <label>Ngày trong tuần<select name="thuTrongTuan" defaultValue={row?.thuTrongTuan ?? 1}>{thu.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select></label>
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
  return <BieuMau title={row ? 'Dời phiên tự học' : 'Đặt phiên tự học'} onSubmit={form => goi(c.token, '/study-sessions' + (row ? '/' + row.ma : ''), { method: row ? 'PUT' : 'POST', version: baseline, body: {
    maNhiemVu: row?.maNhiemVu ?? task?.ma ?? Number(form.get('maNhiemVu')), batDauDuKien: thoiDiemGui(String(form.get('batDau')), row?.batDauDuKien ?? null, c.zone), ketThucDuKien: thoiDiemGui(String(form.get('ketThuc')), row?.ketThucDuKien ?? null, c.zone), ghiChu: String(form.get('ghiChu') ?? '') || null,
  } })}>
    {task && <p className="ht-note">Đặt phiên cho “{task.tieuDe}”.</p>}
    {!row && !task && <><label>Tìm nhiệm vụ theo tên<input value={search} onChange={e => setSearch(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<label>Nhiệm vụ<select name="maNhiemVu" required><option value="">Chọn việc cần học</option>{choices.map(t => <option value={t.ma} key={t.ma}>{t.tieuDe}</option>)}</select></label></>}
    <label>Bắt đầu<input name="batDau" required type="datetime-local" defaultValue={gioNhap(row?.batDauDuKien ?? null, c.zone)} /></label><label>Kết thúc<input name="ketThuc" required type="datetime-local" defaultValue={gioNhap(row?.ketThucDuKien ?? null, c.zone)} /></label><label>Ghi chú<textarea name="ghiChu" maxLength={2000} defaultValue={row?.ghiChu ?? ''} /></label><p className="ht-note">Phiên thường dài 25–50 phút, cách phiên khác tối thiểu 10 phút và nằm trong giờ rảnh.</p>
  </BieuMau>
}
function PhienChiTiet({ row, baseline }: { row: Phien; baseline: number }) {
  const c = useHocTap()
  const dialog = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    dialog.current?.showModal()
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const before = now < Date.parse(row.batDauDuKien)
  const ended = now >= Date.parse(row.ketThucDuKien)
  const actions = row.trangThai === 'InProgress' ? [['finish', 'Kết thúc phiên']] : row.trangThai !== 'Planned' ? [] : before ? [['cancel', 'Hủy phiên']] : ended ? [['finish', 'Xác nhận đã học xong'], ['miss', 'Xác nhận bỏ lỡ']] : [['start', 'Bắt đầu học']]
  async function change(action: string) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await goi(c.token, `/study-sessions/${row.ma}/${action}`, { method: 'POST', version: baseline })
      c.close(); c.reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa cập nhật được phiên tự học.') }
    finally { setBusy(false) }
  }
  return <dialog className="ht-dialog" ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else c.close() }} aria-label="Chi tiết phiên tự học">
    <header><h2>Phiên tự học</h2><button disabled={busy} onClick={c.close}>Đóng</button></header>
    {error && <p role="alert" className="ht-error">{error}</p>}
    <p>{hienGio(row.batDauDuKien, c.zone)} → {hienGio(row.ketThucDuKien, c.zone)}</p><p>{trangThai[row.trangThai]}</p>
    <div className="ht-toolbar"><button disabled={busy} onClick={() => c.modal(<ChiTietNhiemVu ma={row.maNhiemVu} />)}>Xem nhiệm vụ</button>
      {row.trangThai === 'Planned' && before && <button disabled={busy} onClick={() => c.modal(<DatPhien row={row} baseline={baseline} />)}>Dời phiên</button>}
      {actions.map(([action, label]) => <button disabled={busy} key={action} onClick={() => void change(action)}>{label}</button>)}
    </div><p className="ht-note">Các thao tác được mở theo thời gian diễn ra phiên. Sau khi học, cập nhật riêng phần trăm nhiệm vụ theo kết quả thực tế.</p>
  </dialog>
}
