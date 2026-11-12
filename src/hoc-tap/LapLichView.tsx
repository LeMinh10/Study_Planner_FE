import { useEffect, useState } from 'react'
import { xacNhan } from './xacNhan'
import { useAuth } from '../contexts/AuthContext'
import { useHocTap } from './HocTapPage'
import { goi, LoiHocTap } from './api'
import { gioNhap, hienGio, ngay } from './time'
import type { ApDungLich, GoiY, NhiemVu, Trang } from './types'

interface YeuCauCho {
  key: string
  body: { tokenPreview: string; phien: { maNhiemVu: number; batDauDuKien: string; ketThucDuKien: string }[] }
  preview: GoiY
}
const ngayDeXuat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'numeric' })

export function LapLichView() {
  const c = useHocTap()
  const auth = useAuth()
  const storageKey = 'studyplanner:pending-planning:' + auth.user?.email
  const [preview, setPreview] = useState<GoiY | null>(null)
  const [pending, setPending] = useState<YeuCauCho | null>(null)
  const [selected, setSelected] = useState(new Set<number>())
  const [specificTasks, setSpecificTasks] = useState(false)
  const [taskSelection, setTaskSelection] = useState<{ scope: string; ids: Set<number> } | null>(null)
  const [choiceResult, setChoiceResult] = useState<{ key: string; tasks?: NhiemVu[]; error?: string } | null>(null)
  const [choiceRetry, setChoiceRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const scope = JSON.stringify([c.hocKy, c.monHoc])
  const taskIds = taskSelection?.scope === scope ? taskSelection.ids : new Set<number>()
  const choiceKey = JSON.stringify([scope, search, choiceRetry, c.revision])
  const choices = choiceResult?.key === choiceKey ? choiceResult : null
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
    if (!specificTasks || pending) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ tuKhoa: search, kichThuocTrang: '100' })
      if (c.hocKy) query.set('maHocKy', c.hocKy)
      if (c.monHoc) query.set('maMonHoc', c.monHoc)
      goi<Trang<NhiemVu>>(c.token, '/tasks?' + query, { signal: controller.signal }).then(r => {
        if (!controller.signal.aborted) setChoiceResult({ key: choiceKey, tasks: r.duLieu.danhSach })
      }).catch(e => {
        if (!controller.signal.aborted) setChoiceResult({ key: choiceKey, error: e.message })
      })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, c.token, c.hocKy, c.monHoc, choiceKey, specificTasks, pending])
  function persist(value: YeuCauCho | null) {
    setPending(value)
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey) }
    catch { setNotice('Trình duyệt chưa lưu được yêu cầu chờ. Giữ tab mở để thử lại cùng yêu cầu nếu mất kết nối.') }
  }
  async function apply(attempt: YeuCauCho) {
    if (busy) return
    setBusy(true); setError(''); persist(attempt)
    try {
      const { duLieu } = await goi<ApDungLich>(c.token, '/planning/apply', { method: 'POST', body: attempt.body, key: attempt.key })
      persist(null); setPreview(null); setSelected(new Set()); c.reload()
      c.thongBaoThanhCong(duLieu.phien.length ? `Đã lưu ${duLieu.phien.length} phiên tự học` : 'Đã xử lý yêu cầu áp dụng lịch')
      c.moTab('sessions', { batch: duLieu.maLanApDung })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa xác định được kết quả áp dụng.')
      if (e instanceof LoiHocTap && e.status >= 400 && e.status < 500 && e.status !== 401) {
        setNotice('Máy chủ đã từ chối yêu cầu này. Kiểm tra lịch đã lưu, sau đó bỏ yêu cầu chờ để tạo gợi ý mới.')
      }
    } finally { setBusy(false) }
  }
  const proposalDays = new Map<string, number[]>()
  preview?.phien.forEach((row, index) => {
    const day = ngay(row.batDauDuKien, c.zone)
    const indices = proposalDays.get(day)
    if (indices) indices.push(index)
    else proposalDays.set(day, [index])
  })
  return <section className="ht-study-view ht-study-planning">
    {notice && <p role="status" className="ht-note">{notice}</p>}{error && <p role="alert" className="ht-error">{error}</p>}
    <form onSubmit={async event => {
      event.preventDefault()
      if (pending || busy || (specificTasks && !taskIds.size)) return
      const form = new FormData(event.currentTarget)
      setBusy(true); setError(''); setNotice('')
      try {
        const result = await goi<GoiY>(c.token, '/planning/preview', { method: 'POST', body: {
          ngayBatDau: form.get('ngayBatDau'), soNgay: Number(form.get('soNgay')),
          maHocKy: c.hocKy ? Number(c.hocKy) : null, maMonHoc: c.monHoc ? Number(c.monHoc) : null,
          danhSachMaNhiemVu: specificTasks ? [...taskIds] : [],
        } })
        setPreview(result.duLieu); setSelected(new Set(result.duLieu.phien.map((_, i) => i)))
      } catch (e) { setError(e instanceof Error ? e.message : 'Chưa tạo được gợi ý.') }
      finally { setBusy(false) }
    }}>
      <fieldset disabled={busy || !!pending} className="ht-plan-form">
        <div className="ht-study-form-dates">
          <label>Ngày bắt đầu<input name="ngayBatDau" type="date" required min={ngay(Date.now(), c.zone)} defaultValue={ngay(Date.now(), c.zone)} /></label>
          <label>Số ngày<input name="soNgay" type="number" required min={1} max={31} defaultValue={14} /></label>
        </div>
        <fieldset className="ht-study-task-scope">
          <legend>Nhiệm vụ đưa vào lịch</legend>
          <div className="ht-study-choices">
            <label className="ht-study-choice"><input type="radio" name="phamVi" checked={!specificTasks} onChange={() => setSpecificTasks(false)} />Tất cả nhiệm vụ phù hợp</label>
            <label className="ht-study-choice"><input type="radio" name="phamVi" checked={specificTasks} onChange={() => setSpecificTasks(true)} />Chọn nhiệm vụ</label>
          </div>
          {specificTasks && <div className="ht-study-picker">
            <label>Tìm nhiệm vụ<input type="search" value={search} maxLength={200} onChange={e => setSearch(e.target.value)} placeholder="Nhập tên nhiệm vụ" /></label>
            <div className="ht-study-toolbar">
              <span aria-live="polite">Đã chọn {taskIds.size} nhiệm vụ</span>
              {taskIds.size > 0 && <button type="button" onClick={() => setTaskSelection(null)}>Bỏ chọn tất cả</button>}
            </div>
            {!choices && <p className="ht-study-caption" role="status">Đang tìm nhiệm vụ…</p>}
            {choices?.error && <div className="ht-error" role="alert">{choices.error} <button type="button" onClick={() => setChoiceRetry(value => value + 1)}>Thử lại</button></div>}
            {choices?.tasks?.length === 0 && <p className="ht-study-caption">Không tìm thấy nhiệm vụ</p>}
            {!!choices?.tasks?.length && <div className="ht-study-task-options">
              {choices.tasks.map(task => <label className="ht-study-choice" key={task.ma}>
                <input type="checkbox" checked={taskIds.has(task.ma)} onChange={e => {
                  const next = new Set(taskIds)
                  if (e.target.checked) next.add(task.ma)
                  else next.delete(task.ma)
                  setTaskSelection({ scope, ids: next })
                }} />
                <span>{task.tieuDe}</span>
              </label>)}
            </div>}
          </div>}
        </fieldset>
        <div className="ht-study-form-actions">
          <button type="submit" className="ht-primary" disabled={specificTasks && !taskIds.size}>{busy ? 'Đang xử lý…' : 'Tạo gợi ý lịch học'}</button>
        </div>
      </fieldset>
    </form>
    {pending && <div className="ht-toolbar"><button disabled={busy} className="ht-primary" onClick={() => void apply(pending)}>Thử lại cùng yêu cầu áp dụng</button><button disabled={busy} onClick={async () => {
      if (await xacNhan({ tieuDe: 'Bỏ yêu cầu đang chờ?', noiDung: 'Bạn đã kiểm tra các phiên trong lịch để biết yêu cầu trước có được lưu chưa?', luuY: 'Bỏ yêu cầu chờ sẽ kết thúc khả năng thử lại yêu cầu này từ màn hình hiện tại.', nhanXacNhan: 'Đã kiểm tra, bỏ yêu cầu' })) { persist(null); setPreview(null); setNotice('Có thể tạo lại gợi ý từ dữ liệu mới nhất.') }
    }}>Đã kiểm tra lịch, bỏ yêu cầu chờ</button></div>}
    {preview && <section className="ht-study-results">
      <header className="ht-study-toolbar"><h2>Lịch đề xuất</h2><p>Dùng trước {hienGio(preview.hetHanLuc, c.zone)}</p></header>
      <div className="ht-metrics">{[['Cần xếp', preview.tongPhutCanXep], ['Đã đặt', preview.tongPhutDaDat], ['Đề xuất', preview.tongPhutDeXuat], ['Chưa xếp', preview.tongPhutChuaXep]].map(([name, minutes]) => <div key={name}><strong>{minutes} phút</strong><span>{name}</span></div>)}</div>
      {!pending && preview.phien.length > 0 && <div className="ht-study-toolbar"><div className="ht-study-row-actions">
        <button type="button" disabled={busy} onClick={() => setSelected(new Set(preview.phien.map((_, i) => i)))}>Chọn tất cả</button>
        <button type="button" disabled={busy} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
      </div><button type="button" className="ht-primary" disabled={busy || selected.size === 0} onClick={async () => {
        if (!await xacNhan({ tieuDe: 'Áp dụng lịch tự học?', noiDung: `Lưu ${selected.size} phiên đã chọn vào thời khóa biểu?`, nhanXacNhan: 'Áp dụng lịch' })) return
        const phien = preview.phien.filter((_, i) => selected.has(i)).map(p => ({ maNhiemVu: p.maNhiemVu, batDauDuKien: p.batDauDuKien, ketThucDuKien: p.ketThucDuKien }))
        void apply({ key: crypto.randomUUID(), body: { tokenPreview: preview.tokenPreview, phien }, preview })
      }}>Áp dụng {selected.size} phiên đã chọn</button></div>}
      {!preview.phien.length && <div className="ht-study-empty"><strong>Chưa tìm được phiên phù hợp</strong>
        <p>Thử đổi khoảng ngày hoặc chọn nhiệm vụ khác.</p>
      </div>}
      {[...proposalDays].map(([day, indices]) => <section className="ht-study-day" key={day}>
        <h3>{ngayDeXuat.format(new Date(day + 'T12:00Z'))}</h3>
        <div className="ht-study-list">
          {indices.map(index => {
            const row = preview.phien[index]
            return <label className="ht-study-choice ht-proposal" key={index}>
              <input type="checkbox" disabled={busy || !!pending} checked={selected.has(index)} onChange={e => setSelected(old => {
                const next = new Set(old)
                if (e.target.checked) next.add(index)
                else next.delete(index)
                return next
              })} />
              <strong>{row.tieuDe}</strong>
              <small>{gioNhap(row.batDauDuKien, c.zone).slice(11)}–{gioNhap(row.ketThucDuKien, c.zone).slice(11)}</small>
            </label>
          })}
        </div>
      </section>)}
      {preview.phien.some(row => Date.parse(row.ketThucDuKien) - Date.parse(row.batDauDuKien) < 25 * 60000) &&
        <p className="ht-study-caption">Phiên dưới 25 phút có thể cần chọn cùng các phiên trước của nhiệm vụ.</p>}
      {!!preview.canhBao.length && <section className="ht-study-warnings"><h3>Việc chưa xếp được</h3>
        <ul>{preview.canhBao.map((item, index) => <li key={index}>
          <strong>{item.tieuDe}</strong><p>{item.thongBao}{item.soPhutChuaXep > 0 ? ` Còn thiếu ${item.soPhutChuaXep} phút.` : ''}</p>
        </li>)}</ul>
      </section>}
    </section>}
  </section>
}
