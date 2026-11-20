import { useEffect, useId, useRef, useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { goi } from './api'
import { congNgay, gioNhap, hienGio, ngay } from './time'
import type { LichSu, Trang } from './types'

const nhanHanhDong: Record<string, string> = {
  Created: 'Đã tạo nhiệm vụ',
  Updated: 'Đã chỉnh sửa',
  Completed: 'Đã hoàn thành',
  Reopened: 'Đã mở lại',
  Deleted: 'Đã xóa vĩnh viễn',
  Trashed: 'Đã chuyển vào thùng rác',
  Restored: 'Đã khôi phục',
}
const nhanThayDoi: Record<string, string> = {
  tieuDe: 'Đã đổi tên',
  moTa: 'Đã sửa mô tả',
  checklist: 'Đã cập nhật checklist',
  hanHoanThanh: 'Đã đổi hạn',
  batDauSuKien: 'Đã đổi giờ sự kiện',
  ketThucSuKien: 'Đã đổi giờ sự kiện',
  tienDo: 'Đã cập nhật tiến độ',
  mucDoUuTien: 'Đã đổi ưu tiên',
  maNhiemVuCha: 'Đã đổi nhiệm vụ lớn',
  maHocKy: 'Đã đổi học kỳ',
  maMonHoc: 'Đã đổi môn học',
  loai: 'Đã đổi loại công việc',
  thoiLuongDuKienPhut: 'Đã đổi thời gian ước lượng',
  nhacTruocGio: 'Đã đổi nhắc hạn',
}
const kichThuocTrang = 15
const dinhDangNgay = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', dateStyle: 'full' })

type TomTat = { label: string; detail?: string; icon: IconName; kind?: string }

const bieuTuongHanhDong: Partial<Record<string, IconName>> = {
  Created: 'plus', Completed: 'check', Reopened: 'undo', Trashed: 'trash', Deleted: 'trash', Restored: 'undo',
}

function tomTatHoatDong(row: LichSu, zone: string): TomTat {
  const label = nhanHanhDong[row.hanhDong] ?? 'Đã cập nhật nhiệm vụ'
  const fallback: TomTat = { label, icon: bieuTuongHanhDong[row.hanhDong] ?? 'edit' }
  try {
    const before: Record<string, unknown> | null = row.duLieuTruoc ? JSON.parse(row.duLieuTruoc) : null
    const after: Record<string, unknown> | null = row.duLieuSau ? JSON.parse(row.duLieuSau) : null
    if (!after) return fallback
    const kind = after.loaiHoatDong
    if ((kind === 'AttachmentAdded' || kind === 'AttachmentRemoved') && typeof after.tenTep === 'string') {
      return { label: kind === 'AttachmentAdded' ? 'Đã đính kèm tệp' : 'Đã xóa tệp đính kèm',
        detail: after.tenTep, icon: 'paperclip', kind }
    }
    if (kind === 'StepsAdded' && Array.isArray(after.cacBuocDaThem)) {
      const names = after.cacBuocDaThem.filter((name): name is string => typeof name === 'string' && name.length > 0)
      if (names.length > 0) {
        const progress = typeof before?.tienDo === 'number' && typeof after.tienDo === 'number' && before.tienDo !== after.tienDo
          ? 'Tiến độ ' + before.tienDo + '% → ' + after.tienDo + '%' : ''
        const details = [names.length > 1 ? names.join(' · ') : '', progress].filter(Boolean)
        if (row.hanhDong === 'Reopened') details.push('Đã mở lại nhiệm vụ')
        if (row.hanhDong === 'Completed') details.push('Đã hoàn thành nhiệm vụ')
        return { label: names.length === 1 ? 'Đã thêm bước “' + names[0] + '”' : 'Đã thêm ' + names.length + ' bước',
          detail: details.join(' · '), icon: 'plus', kind }
      }
    }
    if (row.hanhDong !== 'Updated' || !before) return fallback
    const changed = Object.keys(nhanThayDoi).filter(key =>
      Object.hasOwn(before, key) && Object.hasOwn(after, key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    const labels = [...new Set(changed.map(key => nhanThayDoi[key]))]
    if (changed.length === 1) {
      const key = changed[0]
      const value = after[key]
      if (key === 'hanHoanThanh' && (value === null || typeof value === 'string' && Number.isFinite(Date.parse(value)))) {
        return { label: labels[0], detail: hienGio(value, zone), icon: 'calendar', kind: 'Deadline' }
      }
      if (key === 'tienDo' && typeof value === 'number' && typeof before.tienDo === 'number') {
        return { label: labels[0], detail: before.tienDo + '% → ' + value + '%', icon: 'chart', kind: 'Progress' }
      }
      return { ...fallback, label: labels[0] }
    }
    return labels.length > 1 ? { ...fallback, detail: labels.join(' · ') } : { ...fallback, label: labels[0] ?? label }
  } catch {
    return fallback
  }
}

export function HoatDongNhiemVu({ ma, title, token, zone, onClose }: {
  ma: number
  title: string
  token: string
  zone: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const [request, setRequest] = useState({ page: 1 })
  const [history, setHistory] = useState<Trang<LichSu> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal() }, [])
  useEffect(() => {
    const controller = new AbortController()
    const page = request.page
    const query = new URLSearchParams({ maNhiemVu: String(ma), trang: String(page), kichThuocTrang: String(kichThuocTrang) })
    goi<Trang<LichSu>>(token, '/task-history?' + query, { signal: controller.signal }).then(({ duLieu }) => {
      if (controller.signal.aborted) return
      setHistory(previous => {
        if (page === 1 || !previous) return duLieu
        const combined = new Map(previous.danhSach.map(row => [row.ma, row]))
        for (const row of duLieu.danhSach) combined.set(row.ma, row)
        return { ...duLieu, danhSach: [...combined.values()] }
      })
    }).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa tải được hoạt động')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [ma, token, request])

  function load(page: number) {
    setLoading(true)
    setError('')
    setRequest({ page })
  }
  const groups = new Map<string, LichSu[]>()
  for (const row of history?.danhSach ?? []) {
    const date = ngay(row.ngayThayDoi, zone)
    const group = groups.get(date)
    if (group) group.push(row)
    else groups.set(date, [row])
  }
  const today = ngay(Date.now(), zone)
  const yesterday = congNgay(today, -1)
  return <dialog ref={dialog} className="ht-dialog ht-task-history" aria-labelledby={headingId}
    onClose={onClose} onCancel={event => event.stopPropagation()}>
    <header>
      <div><h2 id={headingId}>Hoạt động nhiệm vụ</h2><p>{title}</p></div>
      <button type="button" autoFocus onClick={() => dialog.current?.close()}>Đóng</button>
    </header>
    <div className="ht-history-body">
      {[...groups].map(([date, rows]) => <section className="ht-history-day" key={date}>
        <h3>{date === today ? 'Hôm nay' : date === yesterday ? 'Hôm qua' : dinhDangNgay.format(new Date(date + 'T12:00Z'))}</h3>
        <ol className="ht-history">
          {rows.map(row => {
            const { label, detail, icon, kind } = tomTatHoatDong(row, zone)
            return <li key={row.ma} data-action={row.hanhDong} data-kind={kind}>
              <span className="ht-history-icon" aria-hidden="true"><Icon name={icon} size={14} /></span>
              <div><strong>{label}</strong>{row.nguonThayDoi === 'System' && <span className="ht-history-source">Tự động</span>}
                {detail && <small>{detail}</small>}
              </div>
              <time dateTime={row.ngayThayDoi} title={hienGio(row.ngayThayDoi, zone)}>{gioNhap(row.ngayThayDoi, zone).slice(11)}</time>
            </li>
          })}
        </ol>
      </section>)}
      {!loading && !error && !groups.size && <p className="ht-empty">Chưa có hoạt động nào được ghi lại</p>}
      {loading && <p className="ht-history-status" role="status">Đang tải hoạt động…</p>}
      {error && <div className="ht-error"><span role="alert">{error}</span> <button type="button" onClick={() => load(request.page)}>Thử lại</button></div>}
      {history && !loading && !error && history.trang * history.kichThuocTrang < history.tongSo &&
        <button className="ht-history-more" type="button" onClick={() => load(history.trang + 1)}>Xem hoạt động cũ hơn</button>}
    </div>
  </dialog>
}
