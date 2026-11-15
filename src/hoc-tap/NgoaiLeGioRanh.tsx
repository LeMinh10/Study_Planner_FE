import { useEffect, useRef, useState } from 'react'
import { useHocTap } from './HocTapPage'
import { goi, thayDoi } from './api'
import { congNgay, ngay, thu } from './time'
import type { GioRanh, NgoaiLeGioRanh as NgoaiLe } from './types'
import './planning-upgrade.css'

function firstDay(row: GioRanh, today: string) {
  const start = today > row.ngayBatDau && today <= row.ngayKetThuc ? today : row.ngayBatDau
  const weekday = (new Date(start + 'T12:00Z').getUTCDay() + 6) % 7 + 1
  const candidate = congNgay(start, (row.thuTrongTuan - weekday + 7) % 7)
  return candidate <= row.ngayKetThuc ? candidate : row.ngayBatDau
}

export function NgoaiLeGioRanh({ row, initialDay }: { row: GioRanh; initialDay?: string }) {
  const c = useHocTap()
  const dialog = useRef<HTMLDialogElement>(null)
  const [snapshot, setSnapshot] = useState<{ items: NgoaiLe[]; version: number } | null>(null)
  const [date, setDate] = useState(initialDay ?? firstDay(row, ngay(Date.now(), c.zone)))
  const [skip, setSkip] = useState(true)
  const [start, setStart] = useState(row.gioBatDau.slice(0, 5))
  const [end, setEnd] = useState(row.gioKetThuc.slice(0, 5))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    const controller = new AbortController(); setError('')
    goi<NgoaiLe[]>(c.token, `/availability-windows/${row.ma}/exceptions`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setSnapshot({ items: result.duLieu, version: result.phienBan })
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [c.token, row.ma, retry, c.revision])
  useEffect(() => {
    const existing = snapshot?.items.find(item => item.ngay === date)
    setSkip(existing?.boQua ?? true)
    setStart((existing?.gioBatDau ?? row.gioBatDau).slice(0, 5))
    setEnd((existing?.gioKetThuc ?? row.gioKetThuc).slice(0, 5))
  }, [date, snapshot, row.gioBatDau, row.gioKetThuc])
  async function save(remove = false, selectedDay = date) {
    if (!snapshot || busy) return
    setBusy(true); setError(''); setMessage('')
    const path = `/availability-windows/${row.ma}/exceptions`
    const body = { ngay: selectedDay, boQua: skip, gioBatDau: skip ? null : start + ':00', gioKetThuc: skip ? null : end + ':00' }
    try {
      // Xem ảnh hưởng trước, xác nhận rồi mới lưu; ngoại lệ chỉ đổi ngày này, giữ mẫu lặp cho các tuần khác.
      const result = await thayDoi(c.token, path + '/' + selectedDay, remove ? 'DELETE' : 'PUT', remove ? undefined : body, snapshot.version,
        { path: path + '/change-preview', body: { ...body, xoa: remove } })
      if (result) { setMessage(remove ? 'Đã trở lại giờ rảnh theo lịch lặp.' : 'Đã lưu điều chỉnh riêng ngày ' + selectedDay + '.'); setRetry(value => value + 1); c.reload() }
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa lưu được điều chỉnh.') }
    finally { setBusy(false) }
  }
  return <dialog className="ht-dialog ht-availability-exception" ref={dialog} aria-label="Điều chỉnh giờ rảnh một ngày" onCancel={event => { if (busy) event.preventDefault(); else c.close() }}>
    <header><h2>Điều chỉnh một ngày</h2><button type="button" disabled={busy} aria-label="Đóng điều chỉnh" onClick={c.close}>×</button></header>
    <p className="ht-study-caption">{thu[row.thuTrongTuan - 1]} hằng tuần · {row.gioBatDau.slice(0, 5)}–{row.gioKetThuc.slice(0, 5)}. Các tuần khác vẫn giữ nguyên.</p>
    {error && <p className="ht-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>Tải dữ liệu mới</button></p>}
    {message && <p className="ht-settings-saved" role="status">{message}</p>}
    {!snapshot && !error && <p role="status">Đang tải các điều chỉnh…</p>}
    <form onSubmit={event => { event.preventDefault(); void save() }}><fieldset disabled={!snapshot || busy}>
      <label>Ngày cần điều chỉnh<input name="ngayNgoaiLe" type="date" required min={row.ngayBatDau} max={row.ngayKetThuc} value={date} onChange={event => setDate(event.target.value)} /></label>
      <label className="ht-check"><input name="boQua" type="checkbox" checked={skip} onChange={event => setSkip(event.target.checked)} />Không rảnh trong ngày này</label>
      {!skip && <div className="ht-fields"><label>Bắt đầu riêng ngày này<input type="time" required value={start} onChange={event => setStart(event.target.value)} /></label><label>Kết thúc riêng ngày này<input type="time" required value={end} onChange={event => setEnd(event.target.value)} /></label></div>}
    </fieldset><footer><button type="button" disabled={busy} onClick={c.close}>Đóng</button><button className="ht-primary" disabled={!snapshot || busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu ngày này'}</button></footer></form>
    {!!snapshot?.items.length && <section className="ht-exception-list"><h3>Ngày đã điều chỉnh</h3>{snapshot.items.map(item => <div key={item.ngay}><button type="button" disabled={busy} onClick={() => setDate(item.ngay)}>{item.ngay} · {item.boQua ? 'Không rảnh' : item.gioBatDau?.slice(0, 5) + '–' + item.gioKetThuc?.slice(0, 5)}</button><button type="button" disabled={busy} onClick={() => void save(true, item.ngay)}>Dùng lại lịch lặp</button></div>)}</section>}
  </dialog>
}
