import { useEffect, useRef, useState } from 'react'
import { xacNhan } from './xacNhan'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { goi, thayDoi } from './api'
import { BieuMau, ChonPhamVi, useHocTap } from './HocTapPage'
import { gioNhap, hienGio, loaiViec, thoiDiemGui, trangThai, uuTien } from './time'
import type { AnhHuong, LichSu, NhiemVu, Trang } from './types'

export function ThemNhanh() {
  const c = useHocTap()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="ht-quick-add" aria-label="Thêm nhanh nhiệm vụ" onSubmit={async event => {
    event.preventDefault()
    if (busy || c.version === null || !c.zoneReady) return
    const form = event.currentTarget
    const title = String(new FormData(form).get('tieuDe') ?? '').trim()
    if (!title) { setError('Hãy nhập tên việc cần làm.'); return }
    setBusy(true)
    setError('')
    try {
      const result = await thayDoi<NhiemVu>(c.token, '/tasks', 'POST', {
        tieuDe: title, maHocKy: c.hocKy ? Number(c.hocKy) : null,
        maMonHoc: c.monHoc ? Number(c.monHoc) : null,
        loai: c.monHoc ? 'Assignment' : 'Personal', mucDoUuTien: 'Medium',
      }, c.version)
      if (result) { form.reset(); c.hienNhiemVuMoi(result.duLieu); c.reload() }
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa thêm được nhiệm vụ.') }
    finally { setBusy(false) }
  }}>
    <label className="ht-quick-title"><span className="sr-only">Tên nhiệm vụ thêm nhanh</span><input name="tieuDe" placeholder="Ghi nhanh một việc cần làm…" maxLength={200} required disabled={busy || c.version === null || !c.zoneReady} /></label>
    <button disabled={busy || c.version === null || !c.zoneReady}>{busy ? 'Đang thêm…' : '+ Thêm nhanh'}</button>
    {error && <p className="ht-error" role="alert">{error}</p>}
  </form>
}

export function NhiemVuView({ board = false }: { board?: boolean }) {
  const c = useHocTap()
  const [params] = useSearchParams()
  const [children, setChildren] = useState(new Map<number, NhiemVu[]>())
  const [expanded, setExpanded] = useState(new Set<number>())
  const [loading, setLoading] = useState<number | null>(null)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const [savingProgress, setSavingProgress] = useState(false)
  async function toggleCompletion(task: NhiemVu) {
    const version = c.version
    if (saving.current || version === null) return
    saving.current = true
    setSavingProgress(true)
    try {
      await c.run(async () => {
        const action = task.tienDo === 100 ? 'reopen' : 'complete'
        const body = { tienDo: 0 }
        const result = await thayDoi(c.token, `/tasks/${task.ma}/${action}`, 'POST', body, version, {
          path: `/tasks/${task.ma}/change-preview`, body: { thaoTac: action, noiDung: body },
        })
        if (result) c.thongBaoThanhCong(action === 'complete' ? `Đã hoàn thành “${task.tieuDe}”.` : `Đã mở lại “${task.tieuDe}”.`)
        return result
      })
    } finally {
      saving.current = false
      setSavingProgress(false)
    }
  }
  async function expand(task: NhiemVu) {
    if (expanded.has(task.ma)) { setExpanded(old => { const next = new Set(old); next.delete(task.ma); return next }); return }
    setLoading(task.ma); setError('')
    try {
      const result = await goi<NhiemVu[]>(c.token, `/tasks/${task.ma}/tree`)
      setChildren(old => new Map(old).set(task.ma, result.duLieu))
      setExpanded(old => new Set(old).add(task.ma))
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa tải được các bước nhỏ.') }
    finally { setLoading(null) }
  }
  function row(task: NhiemVu, level = 0, source: NhiemVu[] = []): ReactNode {
    const list = children.get(task.ma) ?? source
    return <div key={task.ma} className="ht-task-branch">
      <div className={'ht-task-row' + (task.trangThai === 'Completed' ? ' ht-task-completed' : '') + (params.get('task') === String(task.ma) ? ' ht-task-selected' : '')} style={{ paddingInlineStart: 12 + level * 20 }}>
        {task.coNhiemVuCon ? <button disabled={loading === task.ma} aria-label={expanded.has(task.ma) ? 'Thu gọn các bước nhỏ' : 'Xem các bước nhỏ'} aria-expanded={expanded.has(task.ma)} onClick={() => void expand(task)}>{expanded.has(task.ma) ? '▾' : '▸'}</button> : <input aria-label={(task.tienDo === 100 ? 'Mở lại ' : 'Hoàn thành ') + task.tieuDe} type="checkbox" checked={task.tienDo === 100} disabled={savingProgress || c.version === null} onChange={() => void toggleCompletion(task)} />}
        <button className="ht-task-name" onClick={() => c.chonNhiemVu(task.ma)}><strong>{task.tieuDe}</strong><small>{c.subjects.find(s => Number(s.id) === task.maMonHoc)?.name ?? c.semesters.find(s => Number(s.id) === task.maHocKy)?.name ?? 'Việc cá nhân'}</small></button>
        <span className="ht-badge">{task.tienDo}%</span><span className={'ht-priority ht-priority-' + task.mucDoUuTien} title={'Ưu tiên ' + uuTien[task.mucDoUuTien]}>{uuTien[task.mucDoUuTien]}</span><span className={task.hanHieuLuc && Date.parse(task.hanHieuLuc) < Date.now() && task.tienDo < 100 ? 'ht-overdue' : ''}>{hienGio(task.hanHieuLuc, c.zone)}</span>
      </div>
      {expanded.has(task.ma) && level < 10 && list.filter(n => n.maNhiemVuCha === task.ma).map(n => row(n, level + 1, list))}
    </div>
  }
  return <>
    {error && <p className="ht-error" role="alert">{error}</p>}
    <div className="ht-list-caption"><span>{c.total} nhiệm vụ</span><span>Chọn một việc để xem chi tiết</span></div>
    {board ? <div className="ht-board">{Object.entries(trangThai).filter(([status]) => ['NotStarted', 'InProgress', 'Completed'].includes(status)).map(([status, label]) => {
      const group = c.tasks.filter(task => task.trangThai === status)
      return <section className="ht-board-column" key={status}><h2>{label} <small>({group.length} trên trang này)</small></h2>{group.map(task => row(task))}{!group.length && <p className="ht-muted">Chưa có nhiệm vụ trong nhóm này.</p>}</section>
    })}</div> : c.tasks.length ? <div className="ht-task-list">{c.tasks.map(task => row(task))}</div> : <div className="ht-empty"><h2>Chưa có nhiệm vụ phù hợp</h2><p>Thử đổi bộ lọc hoặc thêm một nhiệm vụ mới.</p></div>}
    <div className="ht-paging"><button disabled={c.page === 1} onClick={() => c.setPage(c.page - 1)}>Trang trước</button><span>Trang {c.page} · {c.total} nhiệm vụ</span><button disabled={c.page * 20 >= c.total} onClick={() => c.setPage(c.page + 1)}>Trang sau</button></div>
  </>
}

export function SuaNhiemVu({ task, parent, baseline }: { task?: NhiemVu; parent?: NhiemVu; baseline: number }) {
  const c = useHocTap()
  const scope = task ?? parent
  return <BieuMau title={task ? 'Chỉnh sửa nhiệm vụ' : parent ? 'Thêm bước nhỏ' : 'Thêm nhiệm vụ'} onSubmit={async form => {
    const body = {
      tieuDe: String(form.get('tieuDe')).trim(), moTa: String(form.get('moTa') ?? '').trim() || null,
      maHocKy: scope?.maHocKy ?? (form.get('maHocKy') ? Number(form.get('maHocKy')) : null),
      maMonHoc: scope?.maMonHoc ?? (form.get('maMonHoc') ? Number(form.get('maMonHoc')) : null),
      loai: String(form.get('loai')), mucDoUuTien: String(form.get('mucDoUuTien')),
      hanHoanThanh: thoiDiemGui(String(form.get('hanHoanThanh') ?? ''), task?.hanHoanThanh ?? null, c.zone),
      batDauSuKien: thoiDiemGui(String(form.get('batDauSuKien') ?? ''), task?.batDauSuKien ?? null, c.zone), ketThucSuKien: thoiDiemGui(String(form.get('ketThucSuKien') ?? ''), task?.ketThucSuKien ?? null, c.zone),
      thoiLuongDuKienPhut: task?.coNhiemVuCon ? null : form.get('thoiLuongDuKienPhut') ? Number(form.get('thoiLuongDuKienPhut')) : null,
      nhacTruocGio: task?.nhacTruocGio ?? null,
    }
    if (task) return thayDoi(c.token, `/tasks/${task.ma}`, 'PUT', body, baseline, { path: `/tasks/${task.ma}/change-preview`, body: { thaoTac: 'update', noiDung: body } })
    if (parent) {
      const titles = String(form.get('nhieuTieuDe') ?? '').split(/\r?\n/).map(title => title.trim()).filter(Boolean)
      const danhSach = [body, ...titles.map(tieuDe => ({ ...body, tieuDe }))]
      return thayDoi(c.token, `/tasks/${parent.ma}/children`, 'POST', { danhSach }, baseline, { path: `/tasks/${parent.ma}/change-preview`, body: { thaoTac: 'children', noiDung: { danhSach } } })
    }
    const result = await thayDoi<NhiemVu>(c.token, '/tasks', 'POST', body, baseline)
    if (result) c.hienNhiemVuMoi(result.duLieu)
    return result
  }}>
    {parent && <p className="ht-note">Bước mới thuộc “{parent.tieuDe}”. Tiến độ nhiệm vụ lớn sẽ được tính lại từ các bước nhỏ.</p>}
    <label>Tên nhiệm vụ<input name="tieuDe" defaultValue={task?.tieuDe} required maxLength={200} autoFocus /></label>
    <label>Nội dung<textarea name="moTa" rows={4} defaultValue={task?.moTa ?? ''} maxLength={20000} /></label>
    <ChonPhamVi semester={scope ? scope.maHocKy?.toString() ?? '' : c.hocKy} subject={scope ? scope.maMonHoc?.toString() ?? '' : c.monHoc} locked={!!scope} />
    <div className="ht-fields"><label>Loại công việc<select name="loai" defaultValue={task?.loai ?? ((scope ? scope.maMonHoc : c.monHoc) ? 'Assignment' : 'Personal')}>{Object.entries(loaiViec).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>Mức ưu tiên<select name="mucDoUuTien" defaultValue={task?.mucDoUuTien ?? 'Medium'}>{Object.entries(uuTien).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></div>
    <label>Hạn hoàn thành<input name="hanHoanThanh" type="datetime-local" defaultValue={gioNhap(task?.hanHoanThanh ?? null, c.zone)} /></label>
    {(parent || task?.maNhiemVuCha) && <p className="ht-note">Để trống hạn riêng để dùng hạn của nhiệm vụ lớn.</p>}
    <label>Thời gian ước lượng (phút)<input name="thoiLuongDuKienPhut" type="number" min={1} max={100000} disabled={task?.coNhiemVuCon} defaultValue={task?.coNhiemVuCon ? '' : task?.thoiLuongDuKienPhut ?? ''} /></label>
    {task?.coNhiemVuCon && <p>Thời lượng và tiến độ được tổng hợp từ các bước nhỏ.</p>}
    <details><summary>Giờ diễn ra sự kiện, ví dụ ca thi</summary><div className="ht-fields"><label>Bắt đầu<input name="batDauSuKien" type="datetime-local" defaultValue={gioNhap(task?.batDauSuKien ?? null, c.zone)} /></label><label>Kết thúc<input name="ketThucSuKien" type="datetime-local" defaultValue={gioNhap(task?.ketThucSuKien ?? null, c.zone)} /></label></div></details>
    {parent && <label>Thêm các bước khác cùng lúc<textarea name="nhieuTieuDe" rows={3} placeholder="Mỗi dòng một bước nhỏ" /><small>Các bước cùng lần lưu dùng chung hạn, ưu tiên và ước lượng đã nhập. Có thể chỉnh riêng từng bước sau khi tạo.</small></label>}
  </BieuMau>
}

export function ChiTietNhiemVu({ ma, inline = false }: { ma: number; inline?: boolean }) {
  const c = useHocTap()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (!inline) dialog.current?.showModal() }, [inline])
  const [result, setResult] = useState<{ task: NhiemVu; branch: NhiemVu[]; version: number } | null>(null)
  const [history, setHistory] = useState<LichSu[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [historyPage, setHistoryPage] = useState(0)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [shareLink, setShareLink] = useState('')
  const [notice, setNotice] = useState('')
  const closeDetail = () => { if (inline) c.chonNhiemVu(null); else c.close() }
  useEffect(() => {
    const controller = new AbortController()
    setResult(null); setHistory([]); setHistoryVisible(false); setError('')
    goi<NhiemVu[]>(c.token, `/tasks/${ma}/tree`, { signal: controller.signal }).then(read => {
      const task = read.duLieu.find(n => n.ma === ma)
      if (task) setResult({ task, branch: read.duLieu, version: read.phienBan })
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [ma, c.token])
  async function remove() {
    if (!result || busy) return
    setBusy(true); setError('')
    try {
      const preview = await goi<AnhHuong>(c.token, `/tasks/${ma}/deletion-preview`)
      if (preview.phienBan !== result.version) throw new Error('Dữ liệu đã đổi. Đóng chi tiết và mở lại trước khi xóa.')
      const count = preview.duLieu.soNhiemVu ?? 1
      const impact = preview.duLieu as AnhHuong & { soLichNhac?: number; soThongBao?: number; soTep?: number }
      const chiTiet = [
        { nhan: 'Nhiệm vụ và các bước sẽ xóa', giaTri: count },
        { nhan: 'Lịch nhắc', giaTri: impact.soLichNhac ?? 0 },
        { nhan: 'Thông báo', giaTri: impact.soThongBao ?? 0 },
        { nhan: 'Tệp đính kèm', giaTri: impact.soTep ?? 0 },
        { nhan: 'Phiên tự học liên quan', giaTri: impact.maPhienBiXoa?.length ?? 0 },
      ].filter((item, index) => index === 0 || item.giaTri > 0)
      if (!await xacNhan({
        tieuDe: 'Xóa nhiệm vụ?',
        noiDung: <>Bạn muốn xóa <strong>“{result.task.tieuDe}”</strong>{count > 1 ? ' và toàn bộ các bước nhỏ thuộc nhiệm vụ này' : ''}?</>,
        chiTiet, nguyHiem: true, nhanXacNhan: 'Xóa nhiệm vụ', nhanDangXuLy: 'Đang xóa…',
        luuY: 'Thao tác này không thể hoàn tác. Lịch sử thay đổi vẫn được giữ lại.',
        khiXacNhan: () => goi(c.token, `/tasks/${ma}?huyPhienLienQuan=true`, { method: 'DELETE', version: result.version }),
      })) return
      c.thongBaoThanhCong(`Đã xóa nhiệm vụ “${result.task.tieuDe}”${count > 1 ? ` và ${count - 1} bước nhỏ` : ''}.`)
      closeDetail(); c.reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa xóa được nhiệm vụ.') }
    finally { setBusy(false) }
  }
  async function loadHistory(page: number) {
    try {
      const read = await goi<Trang<LichSu>>(c.token, `/task-history?maNhiemVu=${ma}&trang=${page}&kichThuocTrang=50`)
      setHistory(old => page === 1 ? read.duLieu.danhSach : [...old, ...read.duLieu.danhSach])
      setHistoryPage(page)
      setHistoryTotal(read.duLieu.tongSo)
      setHistoryVisible(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa tải được lịch sử.') }
  }
  const task = result?.task
  const scopeName = task ? c.subjects.find(s => Number(s.id) === task.maMonHoc)?.name ?? c.semesters.find(s => Number(s.id) === task.maHocKy)?.name ?? 'Nhiệm vụ cá nhân' : 'Chi tiết nhiệm vụ'
  const deadline = task?.hanHieuLuc
  const inheritedDeadline = task?.maNhiemVuNguonHan != null && task.maNhiemVuNguonHan !== task.ma
  const deadlineTone = task?.trangThai === 'Completed' ? ' ht-detail-deadline-completed'
    : deadline && Date.parse(deadline) < Date.now() ? ' ht-detail-deadline-overdue' : ''
  const detail = <><header className="ht-detail-top">
      <span><Icon name="book" size={17} />{scopeName}</span>
      <button disabled={busy} onClick={closeDetail}>Đóng</button>
      {task && result && <div className={'ht-detail-deadline' + deadlineTone}>
        <Icon name="calendar" size={16} />
        {deadline ? <span>Hạn hoàn thành <time dateTime={deadline}>{hienGio(deadline, c.zone)}</time></span>
          : <button type="button" disabled={busy} onClick={() => c.modal(<SuaNhiemVu task={task} baseline={result.version} />)}>Chưa đặt hạn</button>}
        {deadline && inheritedDeadline && <small>Theo hạn nhiệm vụ lớn</small>}
      </div>}
    </header>
    <div className="ht-detail-body">
    {error && <p className="ht-error" role="alert">{error}</p>}
    {notice && <p role="status" className="ht-note">{notice}</p>}
    {task && result && <>
      <span className="ht-status-label">{trangThai[task.trangThai]}</span>
      <h2>{task.tieuDe}</h2>
      <p className="ht-preserve ht-description">{task.moTa || 'Chưa có mô tả.'}</p>
      <dl className="ht-task-facts">
        <div><dt>Tiến độ{task.coNhiemVuCon ? ' tổng hợp' : ''}</dt><dd>{task.tienDo}%</dd></div>
        <div><dt>Ưu tiên</dt><dd>{uuTien[task.mucDoUuTien]}</dd></div>
        <div><dt>Loại công việc</dt><dd>{loaiViec[task.loai]}</dd></div>
        <div><dt>Ước lượng</dt><dd>{task.coNhiemVuCon ? 'Tổng hợp từ các bước nhỏ' : task.thoiLuongDuKienPhut == null ? 'Chưa nhập' : task.thoiLuongDuKienPhut + ' phút'}</dd></div>
        <div><dt>Còn lại dự kiến</dt><dd>{task.thoiLuongConLaiPhut == null ? 'Chưa đủ dữ liệu' : task.thoiLuongConLaiPhut + ' phút'}</dd></div>
      </dl>
      {task.batDauSuKien && <p>Sự kiện {hienGio(task.batDauSuKien, c.zone)} → {hienGio(task.ketThucSuKien, c.zone)}</p>}
      <div className="ht-detail-actions">
        <button disabled={busy} onClick={() => c.modal(<SuaNhiemVu task={task} baseline={result.version} />)}>Chỉnh sửa</button>
        <button disabled={busy} onClick={() => c.modal(<SuaNhiemVu parent={task} baseline={result.version} />)}>+ Thêm bước nhỏ</button>
        {!task.coNhiemVuCon && <button onClick={() => c.modal(<DoiTienDo task={task} baseline={result.version} />)}>Cập nhật tiến độ</button>}
        <button className="ht-text-action" onClick={() => c.modal(<DoiCha task={task} branch={result.branch} baseline={result.version} />)}>Chuyển vào nhiệm vụ lớn / tách riêng</button>
        {!task.maNhiemVuCha && <button className="ht-text-action" onClick={() => c.modal(<DoiPhamVi task={task} baseline={result.version} />)}>Đổi học kỳ hoặc môn</button>}
        <button className="ht-text-action" onClick={async () => {
          const link = new URL('/tasks', window.location.origin)
          link.searchParams.set('task', String(task.ma))
          setShareLink(link.href)
          try { await navigator.clipboard.writeText(link.href); setNotice('Đã sao chép liên kết nhiệm vụ.') }
          catch { setNotice('Chọn và sao chép liên kết ở ô bên dưới.') }
        }}>Sao chép liên kết</button>
        <button className="ht-text-action" onClick={() => { c.xemPhienNhiemVu(task); if (!inline) c.close() }}>Xem phiên học của nhiệm vụ</button>
        <button className="ht-danger" disabled={busy} onClick={() => void remove()}>Xóa nhiệm vụ</button>
      </div>
      {shareLink && <input className="ht-share-link" aria-label="Liên kết nhiệm vụ" value={shareLink} readOnly onFocus={event => event.target.select()} />}
      {task.coNhiemVuCon && <section className="ht-detail-section"><h3>Các bước nhỏ</h3>{result.branch.filter(n => n.maNhiemVuCha === task.ma).map(n => <button className="ht-child-link" key={n.ma} onClick={() => { if (inline) c.chonNhiemVu(n.ma); else c.modal(<ChiTietNhiemVu key={n.ma} ma={n.ma} />) }}>{n.tieuDe} · {n.tienDo}%</button>)}</section>}
      <section className="ht-detail-section"><h3>Lịch sử thay đổi</h3>
      <button className="ht-text-action" onClick={() => void loadHistory(1)}>Xem lịch sử thay đổi</button>
      {historyVisible && <ul className="ht-history">{history.map(h => <li key={h.ma}>
        <strong>{({ Created: 'Đã tạo', Updated: 'Đã cập nhật', Completed: 'Đã hoàn thành', Reopened: 'Đã mở lại', Deleted: 'Đã xóa' } as Record<string, string>)[h.hanhDong] ?? h.hanhDong}</strong> · {hienGio(h.ngayThayDoi, c.zone)}
        <small>{h.nguonThayDoi === 'System' ? 'Tự động tính lại theo các bước nhỏ' : 'Theo thao tác của bạn'}</small>
        {h.duLieuTruoc && <details><summary>Trước thay đổi</summary><pre>{h.duLieuTruoc}</pre></details>}
        {h.duLieuSau && <details><summary>Sau thay đổi</summary><pre>{h.duLieuSau}</pre></details>}
      </li>)}</ul>}
      {historyVisible && history.length < historyTotal && <button onClick={() => void loadHistory(historyPage + 1)}>Xem thêm lịch sử</button>}
      </section>
    </>}
    </div>
  </>
  return inline ? <aside className="ht-detail-panel" aria-label="Chi tiết nhiệm vụ">{detail}</aside> : <dialog className="ht-dialog ht-detail" ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else closeDetail() }} aria-label="Chi tiết nhiệm vụ">{detail}</dialog>
}
function DoiTienDo({ task, baseline }: { task: NhiemVu; baseline: number }) {
  const c = useHocTap()
  return <BieuMau title="Cập nhật tiến độ" onSubmit={form => {
    const body = { tienDo: Number(form.get('tienDo')) }
    return thayDoi(c.token, `/tasks/${task.ma}/progress`, 'PATCH', body, baseline, { path: `/tasks/${task.ma}/change-preview`, body: { thaoTac: 'progress', noiDung: body } })
  }}><p>{task.tieuDe}</p><label>Phần trăm đã hoàn thành<input required type="number" name="tienDo" min={0} max={100} defaultValue={task.tienDo} /></label></BieuMau>
}
function DoiPhamVi({ task, baseline }: { task: NhiemVu; baseline: number }) {
  const c = useHocTap()
  return <BieuMau title="Đổi học kỳ hoặc môn học" onSubmit={async form => {
    const body = { maHocKy: form.get('maHocKy') ? Number(form.get('maHocKy')) : null, maMonHoc: form.get('maMonHoc') ? Number(form.get('maMonHoc')) : null }
    const result = await thayDoi<NhiemVu>(c.token, `/tasks/${task.ma}/scope`, 'PATCH', body, baseline, { path: `/tasks/${task.ma}/change-preview`, body: { thaoTac: 'scope', noiDung: body } })
    if (result) c.hienNhiemVuMoi(result.duLieu)
    return result
  }}><p>Lựa chọn áp dụng cho “{task.tieuDe}” và toàn bộ các bước nhỏ.</p><ChonPhamVi semester={task.maHocKy?.toString()} subject={task.maMonHoc?.toString()} /></BieuMau>
}
function DoiCha({ task, branch, baseline }: { task: NhiemVu; branch: NhiemVu[]; baseline: number }) {
  const c = useHocTap()
  const [items, setItems] = useState<NhiemVu[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [group, setGroup] = useState('')
  const [targets, setTargets] = useState<NhiemVu[]>([])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ kichThuocTrang: '100', tuKhoa: search })
      if (task.maHocKy) query.set('maHocKy', String(task.maHocKy))
      if (task.maMonHoc) query.set('maMonHoc', String(task.maMonHoc))
      Promise.all([
        goi<Trang<NhiemVu>>(c.token, '/tasks?' + query, { signal: controller.signal }),
        goi<Trang<NhiemVu>>(c.token, '/tasks?' + query + '&trangThai=Completed', { signal: controller.signal }),
      ]).then(results => {
        const unique = new Map(results.flatMap(r => r.duLieu.danhSach).map(n => [n.ma, n]))
        setItems([...unique.values()].filter(n => !branch.some(b => b.ma === n.ma) && n.maHocKy === task.maHocKy && n.maMonHoc === task.maMonHoc))
      }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, c.token, task.ma, task.maHocKy, task.maMonHoc, branch])
  useEffect(() => {
    if (!group || group === 'tach-rieng') return
    const controller = new AbortController()
    goi<NhiemVu[]>(c.token, `/tasks/${group}/tree`, { signal: controller.signal }).then(r => {
      if (!controller.signal.aborted) setTargets(r.duLieu.filter(n => !branch.some(b => b.ma === n.ma)))
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [group, c.token, branch])
  return <BieuMau title="Chuyển hoặc tách nhiệm vụ" onSubmit={form => {
    const body = { maNhiemVuCha: form.get('maNhiemVuCha') === 'tach-rieng' ? null : Number(form.get('maNhiemVuCha')) }
    return thayDoi(c.token, `/tasks/${task.ma}/parent`, 'PATCH', body, baseline, { path: `/tasks/${task.ma}/change-preview`, body: { thaoTac: 'parent', noiDung: body } })
  }}>
    <p>Chọn nhiệm vụ lớn cùng học kỳ/môn hoặc tách thành nhiệm vụ riêng.</p>
    <label>Tìm nhiệm vụ lớn theo tên<input value={search} onChange={e => setSearch(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <label>Nhóm nhiệm vụ<select name="nhomNhiemVu" required value={group} onChange={e => { setGroup(e.target.value); setTargets([]) }}>
      <option value="" disabled>Chọn nhiệm vụ lớn hoặc tách riêng</option>
      <option value="tach-rieng">Tách thành nhiệm vụ riêng</option>
      {items.map(n => <option value={n.ma} key={n.ma}>{n.tieuDe}</option>)}
    </select></label>
    {group === 'tach-rieng' ? <input type="hidden" name="maNhiemVuCha" value="tach-rieng" /> : group && <label>Gắn vào nhiệm vụ hoặc bước nhỏ<select key={group + targets.length} name="maNhiemVuCha" required defaultValue={targets.length ? group : ''}>
      <option value="" disabled>{targets.length ? 'Chọn việc sẽ chứa nhiệm vụ này' : 'Đang tải các bước nhỏ…'}</option>
      {targets.map(n => <option key={n.ma} value={n.ma}>{n.maNhiemVuCha ? '↳ ' : ''}{n.tieuDe}</option>)}
    </select></label>}
    <p className="ht-note">Nhập tên để thu hẹp danh sách. Sau khi chọn một nhiệm vụ lớn, có thể chuyển vào bất kỳ bước phù hợp trong nhóm đó.</p>
  </BieuMau>
}
