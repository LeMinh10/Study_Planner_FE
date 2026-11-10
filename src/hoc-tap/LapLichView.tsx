import { useEffect, useState } from 'react'
import { xacNhan } from './xacNhan'
import { useAuth } from '../contexts/AuthContext'
import { useHocTap } from './HocTapPage'
import { goi, LoiHocTap } from './api'
import { hienGio, ngay } from './time'
import type { GoiY, NhiemVu, Trang } from './types'

interface YeuCauCho {
  key: string
  body: { tokenPreview: string; phien: { maNhiemVu: number; batDauDuKien: string; ketThucDuKien: string }[] }
  preview: GoiY
}
export function LapLichView() {
  const c = useHocTap()
  const auth = useAuth()
  const storageKey = 'studyplanner:pending-planning:' + auth.user?.email
  const [preview, setPreview] = useState<GoiY | null>(null)
  const [pending, setPending] = useState<YeuCauCho | null>(null)
  const [selected, setSelected] = useState(new Set<number>())
  const [choices, setChoices] = useState<NhiemVu[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as YeuCauCho | null
      if (saved?.key && saved.body?.tokenPreview && Array.isArray(saved.body.phien) && Array.isArray(saved.preview?.phien)) {
        setPending(saved); setPreview(saved.preview)
        setSelected(new Set(saved.preview.phien.flatMap((p, index) => saved.body.phien.some(chosen => chosen.maNhiemVu === p.maNhiemVu && chosen.batDauDuKien === p.batDauDuKien && chosen.ketThucDuKien === p.ketThucDuKien) ? [index] : [])))
        setNotice('Có yêu cầu áp dụng chưa xác định kết quả. Thử lại yêu cầu này để kiểm tra các phiên đã lưu.')
      }
    } catch { setNotice('Trình duyệt chưa khôi phục được yêu cầu trước. Kiểm tra lịch đã lưu trước khi áp dụng lịch khác.') }
  }, [storageKey])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ tuKhoa: search, kichThuocTrang: '100' })
      if (c.hocKy) query.set('maHocKy', c.hocKy)
      if (c.monHoc) query.set('maMonHoc', c.monHoc)
      goi<Trang<NhiemVu>>(c.token, '/tasks?' + query, { signal: controller.signal }).then(r => setChoices(r.duLieu.danhSach)).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, c.token, c.hocKy, c.monHoc])
  function persist(value: YeuCauCho | null) {
    setPending(value)
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey) }
    catch { setNotice('Trình duyệt chưa lưu được yêu cầu chờ. Giữ tab mở để thử lại cùng yêu cầu nếu mất kết nối.') }
  }
  async function apply(attempt: YeuCauCho) {
    if (busy) return
    setBusy(true); setError(''); persist(attempt)
    try {
      await goi(c.token, '/planning/apply', { method: 'POST', body: attempt.body, key: attempt.key })
      persist(null); setPreview(null); setSelected(new Set()); c.reload()
      setNotice('Đã lưu các phiên tự học. Mở Lịch ngày / tuần hoặc Các phiên tự học để xem và điều chỉnh.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa xác định được kết quả áp dụng.')
      if (e instanceof LoiHocTap && e.status >= 400 && e.status < 500 && e.status !== 401) {
        setNotice('Máy chủ đã từ chối yêu cầu này. Kiểm tra lịch đã lưu, sau đó bỏ yêu cầu chờ để tạo gợi ý mới.')
      }
    } finally { setBusy(false) }
  }
  return <section>
    <p className="ht-note">Nhập ước lượng cho từng việc chưa chia nhỏ và khai báo giờ rảnh. Hệ thống phân bổ thời gian theo hạn, ưu tiên và lượng công việc còn lại.</p>
    {notice && <p role="status" className="ht-note">{notice}</p>}{error && <p role="alert" className="ht-error">{error}</p>}
    <form onSubmit={async event => {
      event.preventDefault()
      if (pending || busy) return
      const form = new FormData(event.currentTarget)
      setBusy(true); setError(''); setNotice('')
      try {
        const result = await goi<GoiY>(c.token, '/planning/preview', { method: 'POST', body: {
          ngayBatDau: form.get('ngayBatDau'), soNgay: Number(form.get('soNgay')),
          maHocKy: c.hocKy ? Number(c.hocKy) : null, maMonHoc: c.monHoc ? Number(c.monHoc) : null,
          danhSachMaNhiemVu: form.getAll('nhiemVu').map(Number),
        } })
        setPreview(result.duLieu); setSelected(new Set(result.duLieu.phien.map((_, i) => i)))
      } catch (e) { setError(e instanceof Error ? e.message : 'Chưa tạo được gợi ý.') }
      finally { setBusy(false) }
    }}>
      <fieldset disabled={busy || !!pending} className="ht-plan-form">
        <div className="ht-fields"><label>Ngày bắt đầu<input name="ngayBatDau" type="date" required min={ngay(Date.now(), c.zone)} defaultValue={ngay(Date.now(), c.zone)} /></label><label>Số ngày muốn lập lịch<input name="soNgay" type="number" required min={1} max={31} defaultValue={14} /></label></div>
        <label>Tìm nhiệm vụ muốn đưa vào lịch<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Gõ tên nhiệm vụ" /></label>
        <label>Chọn nhiệm vụ (có thể chọn nhiều)<select name="nhiemVu" multiple size={5} aria-describedby="ht-planning-scope">{choices.map(task => <option key={task.ma} value={task.ma}>{task.tieuDe}</option>)}</select></label>
        <p id="ht-planning-scope" className="ht-note">Để trống lựa chọn để xét tất cả nhiệm vụ theo bộ lọc học kỳ/môn phía trên. Chọn nhiệm vụ lớn sẽ bao gồm các bước nhỏ.</p>
        <button className="ht-primary">{busy ? 'Đang tính…' : 'Tạo gợi ý lịch học'}</button>
      </fieldset>
    </form>
    {pending && <div className="ht-toolbar"><button disabled={busy} className="ht-primary" onClick={() => void apply(pending)}>Thử lại cùng yêu cầu áp dụng</button><button disabled={busy} onClick={async () => {
      if (await xacNhan({ tieuDe: 'Bỏ yêu cầu đang chờ?', noiDung: 'Bạn đã kiểm tra các phiên trong lịch để biết yêu cầu trước có được lưu chưa?', luuY: 'Bỏ yêu cầu chờ sẽ kết thúc khả năng thử lại yêu cầu này từ màn hình hiện tại.', nhanXacNhan: 'Đã kiểm tra, bỏ yêu cầu' })) { persist(null); setPreview(null); setNotice('Có thể tạo lại gợi ý từ dữ liệu mới nhất.') }
    }}>Đã kiểm tra lịch, bỏ yêu cầu chờ</button></div>}
    {preview && <>
      <h2>Lịch được đề xuất</h2><p>Có thể áp dụng trước {hienGio(preview.hetHanLuc, c.zone)}.</p>
      <div className="ht-metrics">{[['Cần xếp thêm', preview.tongPhutCanXep], ['Đã dành chỗ', preview.tongPhutDaDat], ['Mới đề xuất', preview.tongPhutDeXuat], ['Còn thiếu', preview.tongPhutChuaXep]].map(([name, minutes]) => <div key={name}><strong>{minutes} phút</strong><span>{name}</span></div>)}</div>
      {!pending && <div className="ht-toolbar"><button disabled={busy} onClick={() => setSelected(new Set(preview.phien.map((_, i) => i)))}>Chọn tất cả</button><button disabled={busy} onClick={() => setSelected(new Set())}>Bỏ chọn</button><button className="ht-primary" disabled={busy || selected.size === 0} onClick={async () => {
        if (!await xacNhan({ tieuDe: 'Áp dụng lịch tự học?', noiDung: `Lưu ${selected.size} phiên đã chọn vào thời khóa biểu?`, luuY: 'Hệ thống sẽ kiểm tra lại hạn, giờ rảnh và lịch bận trước khi lưu.', nhanXacNhan: 'Áp dụng lịch' })) return
        const phien = preview.phien.filter((_, i) => selected.has(i)).map(p => ({ maNhiemVu: p.maNhiemVu, batDauDuKien: p.batDauDuKien, ketThucDuKien: p.ketThucDuKien }))
        void apply({ key: crypto.randomUUID(), body: { tokenPreview: preview.tokenPreview, phien }, preview })
      }}>Áp dụng {selected.size} phiên đã chọn</button></div>}
      {preview.phien.map((p, index) => <label className="ht-proposal" key={index}><input type="checkbox" disabled={busy || !!pending} checked={selected.has(index)} onChange={e => setSelected(old => { const next = new Set(old); if (e.target.checked) next.add(index); else next.delete(index); return next })} /><span><strong>{p.tieuDe}</strong><span>{hienGio(p.batDauDuKien, c.zone)} → {hienGio(p.ketThucDuKien, c.zone)}</span><small>{p.lyDo}</small></span></label>)}
      <p className="ht-note">Một phiên cuối dưới 25 phút có thể cần được chọn cùng các phiên trước của nhiệm vụ đó để xếp hết phần còn lại.</p>
      {preview.canhBao.map((item, i) => <p className="ht-note" key={i}><strong>{item.tieuDe}</strong> · {item.thongBao}{item.soPhutChuaXep > 0 ? ` Còn thiếu ${item.soPhutChuaXep} phút.` : ''}</p>)}
    </>}
  </section>
}
