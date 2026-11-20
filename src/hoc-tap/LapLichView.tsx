import { useEffect, useRef, useState, useMemo } from 'react'
import { xacNhan } from './xacNhan'
import { useAuth } from '../contexts/AuthContext'
import { useHocTap } from './HocTapPage'
import { goi, LoiHocTap } from './api'
import { gioNhap, hienGio, ngay } from './time'
import type { ApDungLich, GoiY, NhiemVu, Trang } from './types'
import { StudySettingsForm, useStudySettings } from './StudySettings'
import { PlanningSteps } from './PlanningOverview'
import { Icon } from '../components/Icon'
import './planning-design.css'
import './planning-upgrade.css'

interface YeuCauGoiY {
  ngayBatDau: string
  soNgay: number
  maHocKy: number | null
  maMonHoc: number | null
  danhSachMaNhiemVu: number[]
  capNhatKeHoach: boolean
}
interface YeuCauCho {
  key: string
  body: { tokenPreview: string; phien: { maNhiemVu: number; batDauDuKien: string; ketThucDuKien: string }[] }
  preview: GoiY
  filters?: YeuCauGoiY
}
const ngayDeXuat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'numeric' })
const loiCanTaoLai = new Set([
  'DATA_VERSION_CONFLICT', 'PRIORITY_RULE_CHANGED', 'RULE_VERSION_CONFLICT', 'PREVIEW_EXPIRED', 'PREVIEW_SESSION_STARTED',
  'REPLANNING_CONFLICT', 'INVALID_PREVIEW_TOKEN', 'INVALID_PREVIEW_SELECTION', 'SCHEDULE_CONFLICT',
  'OUTSIDE_AVAILABILITY', 'DAILY_STUDY_LIMIT', 'TASK_DEADLINE_CONFLICT', 'TASK_MINUTES_EXCEEDED',
  'TASK_NOT_SCHEDULABLE', 'TASK_NOT_LEAF', 'SEMESTER_ARCHIVED', 'RESOURCE_NOT_FOUND',
  'SHORT_SESSION_REQUIRES_REMAINDER',
])
const phutTrongPhien = (row: { batDauDuKien: string; ketThucDuKien: string }) => (Date.parse(row.ketThucDuKien) - Date.parse(row.batDauDuKien)) / 60000

export function LapLichView() {
  const c = useHocTap()
  const auth = useAuth()
  const storageKey = 'studyplanner:pending-planning:' + auth.user?.email
  const draftKey = 'studyplanner:planning-draft:' + auth.user?.email + ':' + c.hocKy + ':' + c.monHoc
  const [draft] = useState(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')
      return value && typeof value.date === 'string' && typeof value.days === 'string' && Array.isArray(value.ids) && value.ids.length <= 1000 && value.ids.every((id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0) && typeof value.specific === 'boolean' && typeof value.replace === 'boolean' && typeof value.search === 'string'
        ? value as { date: string; days: string; ids: number[]; specific: boolean; replace: boolean; search: string } : null
    } catch { return null }
  })
  const [startDate, setStartDate] = useState(() => draft?.date ?? ngay(Date.now(), c.zone))
  const [days, setDays] = useState(draft?.days ?? '14')
  const [showResults, setShowResults] = useState(false)
  const [applied, setApplied] = useState<ApDungLich | null>(null)
  const settings = useStudySettings(c.token)
  const [preview, setPreview] = useState<GoiY | null>(null)
  const [previewFilters, setPreviewFilters] = useState<YeuCauGoiY | undefined>()
  const [pending, setPending] = useState<YeuCauCho | null>(null)
  const [selected, setSelected] = useState(new Set<number>())
  const [specificTasks, setSpecificTasks] = useState(draft?.specific ?? false)
  const [replaceFuture, setReplaceFuture] = useState(draft?.replace ?? false)
  const [taskSelection, setTaskSelection] = useState<{ scope: string; ids: Set<number> } | null>(draft ? { scope: JSON.stringify([c.hocKy, c.monHoc]), ids: new Set(draft.ids) } : null)
  const [choiceResult, setChoiceResult] = useState<{ key: string; tasks?: NhiemVu[]; error?: string } | null>(null)
  const [choiceRetry, setChoiceRetry] = useState(0)
  const [search, setSearch] = useState(draft?.search ?? '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [needsRefresh, setNeedsRefresh] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now)
  const formRef = useRef<HTMLFormElement>(null)
  const scope = JSON.stringify([c.hocKy, c.monHoc])
  const taskIds = useMemo(() => taskSelection?.scope === scope ? taskSelection.ids : new Set<number>(), [taskSelection, scope])
  const choiceKey = JSON.stringify([scope, search, choiceRetry, c.revision])
  const choices = choiceResult?.key === choiceKey ? choiceResult : null
  useEffect(() => {
    try { sessionStorage.setItem(draftKey, JSON.stringify({ date: startDate, days, ids: [...taskIds], specific: specificTasks, replace: replaceFuture, search })) }
    catch { setNotice('Trình duyệt chưa giữ được bản nhập. Giữ trang này mở để tiếp tục lựa chọn.') }
  }, [draftKey, startDate, days, taskIds, specificTasks, replaceFuture, search])
  useEffect(() => {
    if (!preview || pending) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [preview, pending])
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as YeuCauCho | null
      if (saved?.key && saved.body?.tokenPreview && Array.isArray(saved.body.phien) && Array.isArray(saved.preview?.phien)) {
        setPending(saved); setPreview(saved.preview); setShowResults(true)
        const filters = saved.filters
        if (filters) {
          setPreviewFilters(filters)
          setReplaceFuture(filters.capNhatKeHoach)
          setSpecificTasks(filters.danhSachMaNhiemVu.length > 0)
          setTaskSelection({ scope: JSON.stringify([String(filters.maHocKy ?? ''), String(filters.maMonHoc ?? '')]), ids: new Set(filters.danhSachMaNhiemVu) })
          setStartDate(filters.ngayBatDau); setDays(String(filters.soNgay))
        }
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
  // Giữ nguyên khóa và nội dung khi thử lại: mất phản hồi không có nghĩa là máy chủ chưa lưu lịch.
  async function apply(attempt: YeuCauCho) {
    if (busy) return
    setBusy(true); setError(''); setNotice(''); persist(attempt)
    try {
      const { duLieu } = await goi<ApDungLich>(c.token, '/planning/apply', { method: 'POST', body: attempt.body, key: attempt.key })
      persist(null); setPreview(null); setSelected(new Set()); c.reload()
      c.thongBaoThanhCong(duLieu.phien.length ? `Đã lưu ${duLieu.phien.length} phiên tự học` : 'Đã xử lý yêu cầu áp dụng lịch')
      setApplied(duLieu)
    } catch (e) {
      if (e instanceof LoiHocTap && loiCanTaoLai.has(e.code)) {
        persist(null)
        const started = e.details.batDauDuKien
        setNeedsRefresh(e.code === 'PREVIEW_SESSION_STARTED' && typeof started === 'string'
          ? `Phiên lúc ${hienGio(started, c.zone)} đã qua giờ bắt đầu.` : e.message)
      } else if (e instanceof LoiHocTap && ['SESSION_NEEDS_REVIEW', 'VALIDATION_ERROR'].includes(e.code)) {
        persist(null); setError(e.message)
      } else {
        setNotice('Chưa rõ lịch đã được lưu chưa. Thử lại cùng yêu cầu để kiểm tra.')
      }
    } finally { setBusy(false) }
  }
  const selectedMinutes = preview?.phien.reduce((sum, row, index) => sum + (selected.has(index) ? phutTrongPhien(row) : 0), 0) ?? 0
  const remainingMinutes = Math.max(0, (preview?.tongPhutCanXep ?? 0) - selectedMinutes)
  const replacementIds = preview?.maPhienThayThe ?? []
  const replacements = preview?.phienThayThe ?? []
  const replacementDetailsMissing = replacementIds.length !== replacements.length || new Set(replacements.map(row => row.ma)).size !== replacementIds.length || replacements.some(row => !replacementIds.includes(row.ma))
  const unselectedMinutes = Math.max(0, (preview?.tongPhutDeXuat ?? 0) - selectedMinutes)
  const shortDependencies = new Map<number, number[]>()
  const precedingByTask = new Map<number, number[]>()
  const proposalDays = new Map<string, number[]>()
  preview?.phien.forEach((row, index) => {
    const preceding = precedingByTask.get(row.maNhiemVu) ?? []
    if (phutTrongPhien(row) < 15) shortDependencies.set(index, [...preceding])
    preceding.push(index)
    precedingByTask.set(row.maNhiemVu, preceding)
    const day = ngay(row.batDauDuKien, c.zone)
    const indices = proposalDays.get(day)
    if (indices) indices.push(index)
    else proposalDays.set(day, [index])
  })
  function timeProblem(at: number): string {
    if (!preview) return ''
    if (Date.parse(preview.hetHanLuc) < at) return 'Gợi ý đã hết hạn.'
    const passed = preview.phien.find((row, index) => selected.has(index) && Date.parse(row.batDauDuKien) < at)
    return passed ? `Phiên lúc ${hienGio(passed.batDauDuKien, c.zone)} đã qua giờ bắt đầu.` : ''
  }
  const scopeChanged = previewFilters &&
    (String(previewFilters.maHocKy ?? '') !== c.hocKy || String(previewFilters.maMonHoc ?? '') !== c.monHoc)
  const staleMessage = preview && !pending
    ? needsRefresh || (scopeChanged ? 'Phạm vi nhiệm vụ đã thay đổi.' : timeProblem(now)) : ''
  const missing = new Set<number>()
  for (const [index, required] of shortDependencies) {
    if (selected.has(index)) for (const previous of required) if (!selected.has(previous)) missing.add(previous)
  }
  function taoLaiGoiY() {
    const form = formRef.current
    const dateInput = form?.elements.namedItem('ngayBatDau')
    const today = ngay(Date.now(), c.zone)
    if (dateInput instanceof HTMLInputElement && dateInput.value < today) { dateInput.value = today; setStartDate(today) }
    form?.requestSubmit()
  }
  function openSettings() {
    c.modal(<PlanningSettings onSaved={() => { setPreview(null); setShowResults(false); setSelected(new Set()); c.reload() }} />)
  }
  if (applied) return <section className="ht-study-view ht-study-planning"><PlanningSteps step={3} /><section className="ht-plan-success" aria-labelledby="planning-complete-title"><span><Icon name="check" size={30} /></span><h2 id="planning-complete-title">{applied.daApDungTruoc ? 'Lịch đã được lưu trước đó' : 'Đã lưu lịch tự học'}</h2><p>{applied.phien.length} phiên · {applied.phien.reduce((sum, row) => sum + phutTrongPhien(row), 0)} phút trong lần áp dụng này.<br />{applied.daApDungTruoc ? 'Thử lại không tạo thêm phiên. Mở danh sách để xem trạng thái hiện tại.' : 'Mở phiên khi bạn sẵn sàng bắt đầu học.'}</p><div className="ht-study-row-actions"><button type="button" className="ht-primary" onClick={() => c.moTab('sessions', { batch: applied.maLanApDung })}>Xem phiên tự học</button>{applied.phien[0] && <button type="button" onClick={() => c.moTab('calendar', { date: ngay(applied.phien[0].batDauDuKien, c.zone) })}>Xem trên thời khóa biểu</button>}<button type="button" onClick={() => { setApplied(null); setShowResults(false) }}>Lập lịch khác</button></div></section></section>
  return <section className="ht-study-view ht-study-planning">
    {notice && <p role="status" className="ht-note">{notice}</p>}{error && <p role="alert" className="ht-error">{error}</p>}
    <PlanningSteps step={showResults || pending ? 2 : 1} />
    <header className="ht-planning-heading"><div><h2>{showResults ? 'Chọn lịch muốn lưu' : 'Thiết lập lịch gợi ý'}</h2></div>
    </header>
    {!showResults && !pending && <p className="ht-study-caption">Chọn khoảng ngày và nhiệm vụ. Bước tiếp theo sẽ cho bạn xem lịch trước khi lưu.</p>}
    {!showResults && preview && <button type="button" onClick={() => setShowResults(true)}>Xem lại lịch đề xuất</button>}
    <form hidden={showResults || !!pending} ref={formRef} onChange={() => { if (!pending) setPreview(null) }} onSubmit={async event => {
      event.preventDefault()
      if (pending || busy || (specificTasks && !taskIds.size)) return
      const form = new FormData(event.currentTarget)
      setBusy(true); setError(''); setNotice('')
      try {
        const filters: YeuCauGoiY = {
          ngayBatDau: String(form.get('ngayBatDau')), soNgay: Number(form.get('soNgay')),
          maHocKy: c.hocKy ? Number(c.hocKy) : null, maMonHoc: c.monHoc ? Number(c.monHoc) : null,
          danhSachMaNhiemVu: specificTasks ? [...taskIds] : [], capNhatKeHoach: replaceFuture,
        }
        const result = await goi<GoiY>(c.token, '/planning/preview', { method: 'POST', body: filters })
        setNeedsRefresh(''); setNow(Date.now())
        setPreviewFilters(filters)
        setPreview(result.duLieu); setShowResults(true); setSelected(new Set(result.duLieu.phien.map((_, i) => i)))
      } catch (e) { setError(e instanceof Error ? e.message : 'Chưa tạo được gợi ý.') }
      finally { setBusy(false) }
    }}>
      <fieldset disabled={busy || !!pending} className="ht-plan-form">
        <fieldset className="ht-study-task-scope ht-plan-block">
          <legend>Nhiệm vụ đưa vào lịch</legend>
          <p className="ht-study-caption">Nhập thời lượng dự kiến cho nhiệm vụ cần học. <button type="button" onClick={() => c.moTab('tasks', { returnToPlanning: true })}>Tạo hoặc sửa nhiệm vụ</button></p>
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
        <fieldset className="ht-plan-block"><legend>Khoảng thời gian lập lịch</legend><div className="ht-study-form-dates">
          <label>Ngày bắt đầu<input name="ngayBatDau" type="date" required min={ngay(Date.now(), c.zone)} value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label>Số ngày<input name="soNgay" type="number" required min={1} max={31} value={days} onChange={e => setDays(e.target.value)} /></label>
        </div></fieldset>
        <fieldset className="ht-study-task-scope ht-plan-block"><legend>Cách lập kế hoạch</legend><div className="ht-study-choices"><label className="ht-study-choice"><input type="radio" name="cachLapKeHoach" checked={!replaceFuture} onChange={() => { setReplaceFuture(false); setPreview(null) }} />Tạo thêm lịch</label><label className="ht-study-choice"><input type="radio" name="cachLapKeHoach" checked={replaceFuture} onChange={() => { setReplaceFuture(true); setPreview(null) }} />Cập nhật phần chưa học</label></div><p className="ht-study-caption">{replaceFuture ? 'Thay các phiên chưa bắt đầu trong khoảng đã chọn. Giữ phiên đang học và lịch sử đã học.' : 'Giữ lịch đã đặt, chỉ xếp thêm thời lượng còn thiếu.'}</p></fieldset>
        <div className="ht-plan-links">
          <button type="button" onClick={() => c.moTab('free', { returnToPlanning: true })}><Icon name="clock" size={22} /><span><strong>Giờ rảnh của tôi</strong><small>Chọn khoảng thời gian bạn có thể học; có thể điều chỉnh riêng một ngày.</small></span><Icon name="chevron-right" size={17} /></button>
          <button type="button" onClick={() => c.moTab('classes', { returnToPlanning: true })}><Icon name="book" size={22} /><span><strong>Lịch học trên lớp · Tùy chọn</strong><small>Thêm buổi học để tránh xếp trùng giờ lên lớp.</small></span><Icon name="chevron-right" size={17} /></button>
          <button type="button" data-planning-settings onClick={openSettings}><Icon name="layers" size={22} /><span><strong>Cấu hình học và nghỉ</strong><small>{settings.data ? `${settings.data.phienHocPhut} phút học · ${settings.data.nghiGiuaPhienPhut} phút nghỉ · Tối đa ${settings.data.gioiHanHocMoiNgayPhut} phút/ngày` : 'Xem và điều chỉnh thời lượng học, nghỉ và giới hạn mỗi ngày.'}</small></span><Icon name="chevron-right" size={17} /></button>
        </div>
        <div className="ht-study-form-actions">
          <button type="submit" className="ht-primary" disabled={specificTasks && !taskIds.size}>{busy ? 'Đang xử lý…' : 'Tạo gợi ý lịch học'}</button>
        </div>
      </fieldset>
    </form>
    {pending && <div className="ht-toolbar"><button disabled={busy} className="ht-primary" onClick={() => void apply(pending)}>Thử lại cùng yêu cầu áp dụng</button><button type="button" disabled={busy} onClick={() => c.moTab('sessions', { returnToPlanning: true })}>Xem phiên tự học</button><button disabled={busy} onClick={async () => {
      if (await xacNhan({ tieuDe: 'Bỏ yêu cầu đang chờ?', noiDung: 'Bạn đã kiểm tra các phiên trong lịch để biết yêu cầu trước có được lưu chưa?', luuY: 'Bỏ yêu cầu chờ sẽ kết thúc khả năng thử lại yêu cầu này từ màn hình hiện tại.', nhanXacNhan: 'Đã kiểm tra, bỏ yêu cầu' })) { persist(null); setPreview(null); setShowResults(false); setNotice('Có thể tạo lại gợi ý từ dữ liệu mới nhất.') }
    }}>Đã kiểm tra lịch, bỏ yêu cầu chờ</button></div>}
    {preview && (showResults || pending) && <section className="ht-study-results">
      {!pending && <button type="button" disabled={busy} onClick={() => setShowResults(false)}>← Chỉnh thông tin lập lịch</button>}
      {!!preview.maPhienThayThe?.length && <p className="ht-replan-summary">Khi lưu, {preview.maPhienThayThe.length} phiên chưa bắt đầu sẽ được thay bằng các phiên bạn chọn.</p>}
      <header className="ht-study-toolbar"><h2>Lịch đề xuất <small>({preview.phien.length} phiên · {preview.tongPhutDeXuat} phút)</small></h2><p>Dùng trước {hienGio(preview.hetHanLuc, c.zone)}</p></header>
      <div className="ht-metrics ht-planning-metrics">{[['Cần xếp thêm', preview.tongPhutCanXep], ['Đã có lịch · Giữ lại', preview.tongPhutDaDat], ['Được đề xuất', preview.tongPhutDeXuat], ['Đang chọn để lưu', selectedMinutes], ['Còn chưa xếp sau khi lưu', remainingMinutes]].map(([name, minutes]) => <div key={name}><strong>{minutes} phút</strong><span>{name}</span></div>)}</div>
      {!!replacementIds.length && <SessionReviewList title="Các phiên cũ sẽ được thay thế" rows={replacements} zone={c.zone} />}
      {replacementDetailsMissing && <p className="ht-error" role="alert">Chưa tải đủ thông tin các phiên sẽ thay. Hãy tạo lại gợi ý trước khi áp dụng. <button type="button" onClick={taoLaiGoiY}>Tạo lại gợi ý</button></p>}
      <p className="ht-study-caption" aria-live="polite">Chỉ các phiên được chọn mới được lưu.{preview.canhBao.length > 0 && ' Xem các việc cần kiểm tra ở bên dưới.'}</p>
      <details className="ht-planning-calculation"><summary>Thông tin tính lịch</summary><p>Các nhiệm vụ đủ điều kiện còn {preview.tongPhutCanXep} phút cần xếp. Đã có {preview.tongPhutDaDat} phút trong lịch được giữ lại, có thể gồm cả phiên ngoài khoảng ngày đang chọn. Các phiên sẽ thay thế không tính vào số phút giữ lại. Phần chưa xếp bằng phút cần xếp thêm trừ phút đang chọn. Nhiệm vụ thiếu ước lượng hoặc không đủ điều kiện được báo riêng bên dưới.</p>
        {preview.cauHinhHoc && <p className="ht-study-caption">Mỗi phiên tối đa {preview.cauHinhHoc.phienHocPhut} phút · nghỉ {preview.cauHinhHoc.nghiGiuaPhienPhut} phút · tối đa {preview.cauHinhHoc.gioiHanHocMoiNgayPhut} phút/ngày.</p>}
        {!pending && <button type="button" disabled={busy} onClick={openSettings}>Cài đặt học và nghỉ</button>}
      </details>
      {staleMessage && <div className="ht-planning-action"><p role="status">{staleMessage}</p><button type="button" disabled={busy} onClick={taoLaiGoiY}>Tạo lại gợi ý</button></div>}
      {!pending && !staleMessage && missing.size > 0 && <div className="ht-planning-action">
        <p role="status">Để lưu phiên dưới 15 phút, hãy chọn thêm các phiên trước của cùng nhiệm vụ.</p>
        <button type="button" disabled={busy} onClick={() => setSelected(new Set([...selected, ...missing]))}>Chọn cùng</button>
      </div>}
      {!pending && preview.phien.length > 0 && <div className="ht-study-toolbar"><div className="ht-study-row-actions">
        <button type="button" disabled={busy} onClick={() => setSelected(new Set(preview.phien.map((_, i) => i)))}>Chọn tất cả</button>
        <button type="button" disabled={busy} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
      </div><button type="button" className="ht-primary" disabled={busy || selected.size === 0 || !!staleMessage || missing.size > 0 || replacementDetailsMissing} onClick={async () => {
        const beforeConfirm = Date.now()
        if (timeProblem(beforeConfirm)) { setNow(beforeConfirm); return }
        // Phải báo đủ số phiên cũ bị thay thế, kể cả khi người dùng chỉ chọn một phần phiên mới.
        // Máy chủ kiểm tra token rồi hủy cũ/thêm mới trong cùng giao dịch sau bước xác nhận này.
        if (replacementDetailsMissing) return
        const chosen = preview.phien.filter((_, index) => selected.has(index))
        if (!await xacNhan({ tieuDe: 'Áp dụng lịch tự học?', noiDung: <>
          <p>{replacementIds.length ? `Thay thế ${replacementIds.length} phiên chưa bắt đầu bằng ${selected.size} phiên (${selectedMinutes} phút) đã chọn?` : `Lưu ${selected.size} phiên (${selectedMinutes} phút) đã chọn vào thời khóa biểu?`} Còn {remainingMinutes} phút chưa xếp.</p>
          {!!replacementIds.length && <><p>Các phiên đang học và lịch sử đã học được giữ nguyên. Tất cả phiên cũ dưới đây sẽ được thay, kể cả khi bạn chỉ chọn một phần gợi ý.</p><SessionReviewList title="Phiên cũ sẽ thay thế" rows={replacements} zone={c.zone} /></>}
          <SessionReviewList title="Phiên đã chọn để lưu" rows={chosen} zone={c.zone} />
        </>, nhanXacNhan: 'Áp dụng lịch' })) return
        const afterConfirm = Date.now()
        if (timeProblem(afterConfirm)) { setNow(afterConfirm); return }
        const phien = preview.phien.filter((_, i) => selected.has(i)).map(p => ({ maNhiemVu: p.maNhiemVu, batDauDuKien: p.batDauDuKien, ketThucDuKien: p.ketThucDuKien }))
        void apply({ key: crypto.randomUUID(), body: { tokenPreview: preview.tokenPreview, phien }, preview, filters: previewFilters })
      }}>Áp dụng {selected.size} phiên đã chọn</button></div>}
      {remainingMinutes > 0 && preview.phien.length > 0 && <div className="ht-plan-shortage" role="status"><Icon name="clock" size={20} /><span><strong>Còn {remainingMinutes} phút chưa xếp</strong><small>{unselectedMinutes > 0 ? `Bạn đang bỏ chọn ${unselectedMinutes} phút trong lịch đề xuất. Chọn thêm phiên nếu phù hợp.` : 'Bạn có thể xem nguyên nhân hoặc quay lại điều chỉnh khoảng ngày và giờ rảnh.'}</small></span><button type="button" onClick={() => { const details = document.querySelector<HTMLDetailsElement>('.ht-study-warnings'); if (details) { details.open = true; details.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } else setShowResults(false) }}>{preview.canhBao.length ? 'Xem chi tiết' : 'Điều chỉnh'}</button></div>}
      {!preview.phien.length && <div className="ht-study-empty"><strong>Chưa tìm được phiên phù hợp</strong>
        {!preview.canhBao.length && <p>Thử đổi khoảng ngày hoặc chọn nhiệm vụ khác.</p>}
      </div>}
      {[...proposalDays].map(([day, indices]) => <section className="ht-study-day" key={day}>
        <h3>{ngayDeXuat.format(new Date(day + 'T12:00Z'))}</h3>
        <div className="ht-study-list">
          {indices.map(index => {
            const row = preview.phien[index]
            return <article className="ht-proposal ht-proposal-detail-row" key={index}>
              <input type="checkbox" aria-label={`Chọn ${row.tieuDe}, ${gioNhap(row.batDauDuKien, c.zone).slice(11)}`} disabled={busy || !!pending} checked={selected.has(index)} onChange={e => {
                const checked = e.target.checked
                setError('')
                setSelected(old => { const next = new Set(old); if (checked) next.add(index); else next.delete(index); return next })
              }} />
              <time dateTime={row.batDauDuKien}>{gioNhap(row.batDauDuKien, c.zone).slice(11)}–{gioNhap(row.ketThucDuKien, c.zone).slice(11)}</time>
              <div className="ht-proposal-text"><strong>{row.tieuDe}</strong><small>{phutTrongPhien(row)} phút{phutTrongPhien(row) < 15 ? ' · Phần cuối nhiệm vụ' : ''}{!pending && Date.parse(row.batDauDuKien) < now ? ' · Đã qua giờ' : ''}</small></div>
              <button type="button" className="ht-proposal-info" aria-label={`Vì sao xếp phiên ${index + 1}?`} onClick={() => c.modal(<ProposalDetails row={row} />)}><Icon name="eye" size={16} /></button>
            </article>
          })}
        </div>
      </section>)}
      {!!preview.canhBao.length && <details className="ht-study-warnings" open={!preview.phien.length}><summary>{preview.canhBao.length} việc cần kiểm tra</summary>
        <ul>{preview.canhBao.map((item, index) => <li key={index}>
          <strong>{item.tieuDe}</strong><p>{item.thongBao}{item.soPhutChuaXep > 0 ? ` Còn thiếu ${item.soPhutChuaXep} phút.` : ''}</p>
          {!pending && ['NO_AVAILABILITY', 'NO_TIME_BEFORE_DEADLINE', 'FRAGMENTED_AVAILABILITY', 'INSUFFICIENT_TIME', 'DAILY_LIMIT'].includes(item.maLyDo) && <button type="button" onClick={() => c.moTab('free', { returnToPlanning: true })}>Thêm giờ rảnh</button>}
          {!pending && ['DAILY_LIMIT', 'INSUFFICIENT_TIME'].includes(item.maLyDo) && <button type="button" onClick={openSettings}>Kiểm tra cài đặt học</button>}
          {!pending && ['MISSING_ESTIMATE', 'TASK_OVERDUE'].includes(item.maLyDo) && item.maNhiemVu > 0 && <button type="button" onClick={() => c.moTab('tasks', { task: item.maNhiemVu, returnToPlanning: true })}>Mở nhiệm vụ</button>}
          {!pending && ['SESSION_NEEDS_REVIEW', 'PAST_SESSION_NEEDS_REVIEW', 'NO_AVAILABILITY', 'INSUFFICIENT_TIME'].includes(item.maLyDo) && <button type="button" onClick={() => c.moTab('sessions', { returnToPlanning: true })}>Xem phiên tự học</button>}
        </li>)}</ul>
      </details>}
    </section>}
  </section>
}

function PlanningSettings({ onSaved }: { onSaved: () => void }) {
  const c = useHocTap()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="ht-dialog ht-planning-settings" aria-label="Cài đặt học và nghỉ" onCancel={c.close}>
    <header><h2>Cài đặt học và nghỉ</h2><button type="button" onClick={c.close}>Quay lại lập lịch</button></header>
    <StudySettingsForm token={c.token} onSaved={onSaved} />
  </dialog>
}

function ProposalDetails({ row }: { row: GoiY['phien'][number] }) {
  const c = useHocTap()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="ht-dialog ht-proposal-dialog" aria-label="Chi tiết phiên đề xuất" onCancel={c.close}><header><h2>Chi tiết phiên đề xuất</h2><button type="button" onClick={c.close}>Quay lại lịch đề xuất</button></header><h3>{row.tieuDe}</h3><p>{hienGio(row.batDauDuKien, c.zone)} – {hienGio(row.ketThucDuKien, c.zone)} · {phutTrongPhien(row)} phút</p><h4>Vì sao xếp phiên này?</h4><p className="ht-proposal-reason">{row.lyDo || 'Phiên nằm trong giờ rảnh khả dụng của bạn.'}</p><p className="ht-study-caption">Đây là lịch dự kiến. Chưa có thay đổi nào cho đến khi bạn áp dụng.</p></dialog>
}

function SessionReviewList({ title, rows, zone }: { title: string; rows: { tieuDe: string; batDauDuKien: string; ketThucDuKien: string }[]; zone: string }) {
  return <details className="ht-plan-review"><summary>{title} ({rows.length})</summary><ul>{rows.map((row, index) => <li key={index}><strong>{row.tieuDe}</strong><span>{hienGio(row.batDauDuKien, zone)} – {hienGio(row.ketThucDuKien, zone)} · {phutTrongPhien(row)} phút</span></li>)}</ul></details>
}
