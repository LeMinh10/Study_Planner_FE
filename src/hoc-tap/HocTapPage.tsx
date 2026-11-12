import { createContext, Fragment, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePlanner } from '../contexts/PlannerContext'
import { useMockApi } from '../api/config'
import { apiRequest } from '../api/client'
import type { Semester, Subject } from '../types/planner'
import { goi, LoiHocTap } from './api'
import { loaiViec, trangThai, uuTien } from './time'
import { cheDoNhiemVu, khoangDaHoanThanh, layCheDo, layPhamVi, taoTruyVanNhiemVu } from './boLoc'
import type { NhiemVu, Trang } from './types'
import { ChiTietNhiemVu, NhiemVuView, SuaNhiemVu, ThemNhanh } from './NhiemVuView'
import type { InlineChildDraft } from './NhiemVuView'
import { LichView } from './LichView'
import { ThungRacView } from './ThungRacView'
import { LapLichView } from './LapLichView'
import { KhungChiaChiTiet } from './KhungChiaChiTiet'
import './hoc-tap.css'
import './study-planning.css'

type TienDoXemTruoc = { ma: number; tienDo: number } | null
type SuccessToast = { message: string; undo?: () => Promise<unknown> }
type DiemMoLich = { batch?: number; date?: string }
interface HocTapState {
  token: string
  version: number | null
  zone: string
  zoneReady: boolean
  revision: number
  tienDoXemTruoc: TienDoXemTruoc
  setTienDoXemTruoc: (value: TienDoXemTruoc) => void
  semesters: Semester[]
  subjects: Subject[]
  hocKy: string
  monHoc: string
  tasks: NhiemVu[]
  page: number
  total: number
  pageCount: number
  nhiemVuXemPhien: NhiemVu | null
  setPage: (page: number) => void
  chonMonHoc: (id: string) => void
  chonNhiemVu: (id: number | null) => void
  hienNhiemVuMoi: (task: NhiemVu, giuDanhSach?: boolean) => void
  xemPhienNhiemVu: (task: NhiemVu | null) => void
  moTab: (key: string, diemMo?: DiemMoLich) => void
  reload: () => void
  modal: (content: ReactNode) => void
  close: () => void
  run: (operation: () => Promise<unknown>) => Promise<void>
  thongBaoThanhCong: (message: string, undo?: SuccessToast['undo']) => void
}
const Context = createContext<HocTapState | null>(null)
const shortcutIcons: Record<string, IconName> = { all: 'layers', today: 'sun', upcoming: 'calendar', inbox: 'book', overdue: 'clock', undated: 'list', completed: 'check-square' }
const navigationIcons: Record<string, IconName> = { tasks: 'list', board: 'overview', calendar: 'calendar', classes: 'book', free: 'clock', planning: 'leaf', sessions: 'play' }
export function useHocTap() {
  const value = useContext(Context)
  if (!value) throw new Error('HocTapContext is required')
  return value
}
export function BieuMau({ title, children, onSubmit, submitLabel = 'Lưu thay đổi', disabled = false }: {
  title: string
  children: ReactNode
  onSubmit: (data: FormData) => Promise<unknown>
  submitLabel?: string
  disabled?: boolean
}) {
  const { close, reload, zoneReady } = useHocTap()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog className="ht-dialog" ref={dialog} aria-label={title} onCancel={event => {
    if (busy) event.preventDefault()
    else close()
  }}>
    <form onSubmit={async event => {
      event.preventDefault()
      if (busy || disabled || !zoneReady) return
      const data = new FormData(event.currentTarget)
      setBusy(true)
      setError('')
      try {
        const result = await onSubmit(data)
        if (result !== null) { close(); reload() }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Chưa lưu được thay đổi.')
      } finally { setBusy(false) }
    }}>
      <header><h2>{title}</h2><button type="button" disabled={busy} onClick={close} aria-label="Đóng biểu mẫu">×</button></header>
      {error && <p role="alert" className="ht-error">{error}</p>}
      <fieldset disabled={busy || disabled || !zoneReady}>{children}</fieldset>
      <footer>
        <button type="button" disabled={busy} onClick={close}>Đóng</button>
        <button className="ht-primary" disabled={busy || disabled || !zoneReady}>{busy ? 'Đang lưu…' : submitLabel}</button>
      </footer>
    </form>
  </dialog>
}
export function ChonPhamVi({ semester, subject, requiredSubject = false, locked = false }: {
  semester?: string; subject?: string; requiredSubject?: boolean; locked?: boolean
}) {
  const { semesters, subjects } = useHocTap()
  const initial = subject ? subjects.find(x => x.id === subject)?.semesterId : semester
  const [selected, setSelected] = useState(initial ?? '')
  return <div className="ht-fields">
    <label>Học kỳ
      <select name="maHocKy" value={selected} disabled={locked} required={requiredSubject} onChange={event => setSelected(event.target.value)}>
        <option value="">{requiredSubject ? 'Chọn học kỳ' : 'Việc cá nhân'}</option>
        {semesters.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
      </select>
    </label>
    <label>Môn học
      <select name="maMonHoc" key={selected} defaultValue={subjects.find(s => s.id === subject && s.semesterId === selected)?.id ?? ''} disabled={locked || !selected} required={requiredSubject}>
        <option value="">{requiredSubject ? 'Chọn môn học' : selected ? 'Việc chung của học kỳ' : 'Việc cá nhân'}</option>
        {subjects.filter(s => s.semesterId === selected).map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
      </select>
    </label>
  </div>
}

export function HocTapPage({ mode }: { mode: 'tasks' | 'calendar' | 'schedule' }) {
  const auth = useAuth()
  const location = useLocation()
  const { data, academicLoading } = usePlanner()
  const [params, setParams] = useSearchParams()
  const layout = params.get('layout') ?? 'list'
  const taskTab = layout === 'calendar' ? 'calendar' : layout === 'board' ? 'board' : 'tasks'
  const requestedTab = params.get('tab') ?? ''
  const initialTab = ['tasks', 'board', 'calendar', 'classes', 'free', 'planning', 'sessions', 'trash'].includes(requestedTab) ? requestedTab : mode === 'tasks' ? taskTab : 'calendar'
  const { hocKy, monHoc } = layPhamVi(params, data.subjects)
  const [zone, setZone] = useState('Asia/Ho_Chi_Minh')
  const [zoneReady, setZoneReady] = useState(false)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [revision, setRevision] = useState(0)
  const [tienDoXemTruoc, setTienDoXemTruoc] = useState<TienDoXemTruoc>(null)
  const [yeuCauThemBuoc, setYeuCauThemBuoc] = useState<number[] | null>(null)
  const [moBuocMoi, setMoBuocMoi] = useState<{ revision: number; path: number[]; inlineDraft?: InlineChildDraft } | null>(null)
  const [error, setError] = useState('')
  const [versionConflict, setVersionConflict] = useState(false)
  const [taskSnapshot, setTaskSnapshot] = useState<{ token: string; query: string; revision: number; tasks: NhiemVu[]; total: number; pageCount: number; version: number } | null>(null)
  const [taskFailure, setTaskFailure] = useState<{ token: string; query: string; revision: number; message: string } | null>(null)
  const [profileError, setProfileError] = useState('')
  const [profileRevision, setProfileRevision] = useState(0)
  const [content, setContent] = useState<ReactNode>(null)
  const [success, setSuccess] = useState<SuccessToast | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [calendarNavOpen, setCalendarNavOpen] = useState(false)
  const learningNavId = useId()
  const filterPanelId = useId()
  const [createRequested, setCreateRequested] = useState(false)
  const [tab, setTab] = useState(initialTab)
  const taskView = tab === 'tasks' || tab === 'board'
  const trash = tab === 'trash'
  const batchId = Number(params.get('studyBatch'))
  const studyBatch = tab === 'sessions' && Number.isSafeInteger(batchId) && batchId > 0 ? batchId : undefined
  const requestedDate = params.get('scheduleDate') ?? ''
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && Number.isFinite(Date.parse(requestedDate))
    && new Date(requestedDate).toISOString().slice(0, 10) === requestedDate
  const scheduleDate = tab === 'calendar' && validDate ? requestedDate : undefined
  const [nhiemVuXemPhien, setNhiemVuXemPhien] = useState<NhiemVu | null>(null)
  const ready = auth.status === 'authenticated' && !auth.isDemo && !useMockApi
  const token = ready ? auth.getAccessToken() : ''
  const invalidSubject = params.has('subject') && !academicLoading && !data.subjects.some(s => s.id === params.get('subject'))
  const view = layCheDo(params)
  const completed = taskView && view === 'completed'
  const showCreate = taskView && !completed
  const donePeriod = params.get('donePeriod') ?? ''
  const doneDay = params.get('doneDay') ?? ''
  const sort = params.get('sort') ?? (params.get('view') === 'priority' ? 'priority' : 'due')
  const taskId = Number(params.get('task'))
  const selectedTask = Number.isSafeInteger(taskId) && taskId > 0 ? taskId : null
  const draftPath = yeuCauThemBuoc?.at(-1) === selectedTask ? yeuCauThemBuoc : null
  const reload = () => {
    setError('')
    setVersionConflict(false)
    setRevision(value => value + 1)
  }
  useEffect(() => {
    if (!ready || invalidSubject) return
    const sync = () => { reload(); setProfileRevision(value => value + 1) }
    window.addEventListener('studyplanner:refresh', sync)
    return () => window.removeEventListener('studyplanner:refresh', sync)
  }, [ready, invalidSubject])
  const modal = (value: ReactNode) => setContent(value)
  const close = () => setContent(null)
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 7000)
    return () => clearTimeout(timer)
  }, [success])

  function capNhatLoc(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'semester') next.delete('subject')
    setParams(next)
    setPage(1)
  }
  function chonMonHoc(id: string) {
    const next = new URLSearchParams(params)
    next.delete('subject')
    if (id) {
      next.set('subject', id)
      next.set('semester', data.subjects.find(s => s.id === id)?.semesterId ?? '')
    }
    setParams(next)
    setPage(1)
  }
  function chonNhiemVu(id: number | null) {
    setYeuCauThemBuoc(null)
    const next = new URLSearchParams(params)
    if (id) next.set('task', String(id))
    else next.delete('task')
    setParams(next)
  }
  function hienNhiemVuMoi(task: NhiemVu, giuDanhSach = false) {
    if (giuDanhSach && taskView) { chonNhiemVu(task.ma); return }
    const next = new URLSearchParams({ view: 'all', sort: 'created', task: String(task.ma) })
    if (task.maHocKy) next.set('semester', String(task.maHocKy))
    if (task.maMonHoc) next.set('subject', String(task.maMonHoc))
    setParams(next)
    setQuery('')
    setSearch('')
    setPage(1)
    setTab('tasks')
  }
  function moTab(key: string, diemMo?: DiemMoLich) {
    const next = new URLSearchParams(params)
    next.set('tab', key)
    next.delete('studyBatch')
    next.delete('scheduleDate')
    if (diemMo?.batch) next.set('studyBatch', String(diemMo.batch))
    if (diemMo?.date) next.set('scheduleDate', diemMo.date)
    if (mode === 'tasks' && ['tasks', 'board', 'calendar'].includes(key)) {
      next.set('layout', key === 'tasks' ? 'list' : key)
    }
    if (key === 'sessions') setNhiemVuXemPhien(null)
    setTab(key)
    setParams(next)
  }
  function moDanhSachNhiemVu(shortcut: string) {
    const next = new URLSearchParams(params)
    next.set('tab', 'tasks')
    next.set('layout', 'list')
    next.set('view', shortcut)
    next.delete('task')
    next.delete('status')
    setParams(next)
    setPage(1)
    setTab('tasks')
  }
  function xemPhienNhiemVu(task: NhiemVu | null) {
    moTab('sessions')
    setNhiemVuXemPhien(task)
  }
  function xoaBoLoc() {
    const next = new URLSearchParams()
    if (completed) next.set('view', 'completed')
    for (const key of ['tab', 'layout']) if (params.has(key)) next.set(key, params.get(key)!)
    setParams(next)
    setQuery('')
    setSearch('')
    setPage(1)
  }
  useEffect(() => { setTab(initialTab) }, [initialTab])
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [query])
  const queryString = taoTruyVanNhiemVu(params, page, search, { hocKy, monHoc })
  const snapshot = taskSnapshot?.token === token && taskSnapshot.query === queryString ? taskSnapshot : null
  const taskError = taskFailure?.token === token && taskFailure.query === queryString && taskFailure.revision === revision ? taskFailure.message : ''
  const version = snapshot?.revision === revision && !taskError ? snapshot.version : null
  const tasks = snapshot?.tasks ?? []
  const total = snapshot?.total ?? 0
  const pageCount = snapshot?.pageCount ?? 1
  useEffect(() => {
    if (!token || invalidSubject) return
    const controller = new AbortController()
    goi<Trang<NhiemVu>>(token, '/tasks?' + queryString, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      const { danhSach, tongSo, kichThuocTrang } = result.duLieu
      const lastPage = Math.max(1, Math.ceil(tongSo / kichThuocTrang))
      setTaskFailure(null)
      if (page > lastPage) { setPage(lastPage); return }
      setTaskSnapshot({ token, query: queryString, revision, tasks: danhSach, total: tongSo, pageCount: lastPage, version: result.phienBan })
    }).catch(e => {
      if (controller.signal.aborted) return
      setTaskFailure({ token, query: queryString, revision, message: e.message })
    })
    return () => controller.abort()
  }, [token, queryString, revision, invalidSubject, page])
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setProfileError('')
    apiRequest('/users/me', { token, signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return
      const name = (value as { muiGio?: unknown })?.muiGio
      if (typeof name !== 'string') throw new Error('Chưa đọc được múi giờ tài khoản. Hãy tải lại trước khi đặt lịch.')
      new Intl.DateTimeFormat('vi', { timeZone: name })
      setZone(name)
      setZoneReady(true)
    }).catch(e => { if (!controller.signal.aborted) setProfileError(e instanceof Error ? e.message : 'Chưa tải được múi giờ tài khoản.') })
    return () => controller.abort()
  }, [token, profileRevision])
  useEffect(() => {
    const create = () => { if (showCreate) setCreateRequested(true) }
    window.addEventListener('studyplanner:create-task', create)
    return () => window.removeEventListener('studyplanner:create-task', create)
  }, [showCreate])
  useEffect(() => {
    if (showCreate && createRequested && version !== null && ready && zoneReady && !invalidSubject) {
      modal(<SuaNhiemVu baseline={version} />)
      setCreateRequested(false)
    }
  }, [showCreate, createRequested, version, ready, zoneReady, invalidSubject])
  useEffect(() => {
    const path = location.pathname
    window.dispatchEvent(new CustomEvent('studyplanner:core-ready', { detail: { path, showCreate, ready: ready && zoneReady && version !== null && !invalidSubject } }))
    return () => { window.dispatchEvent(new CustomEvent('studyplanner:core-ready', { detail: { path, ready: false, showCreate: false } })) }
  }, [location.pathname, ready, zoneReady, version, invalidSubject, showCreate])
  async function run(operation: () => Promise<unknown>) {
    setError('')
    setVersionConflict(false)
    try { if (await operation() !== null) reload() }
    catch (e) {
      setVersionConflict(e instanceof LoiHocTap && e.code === 'DATA_VERSION_CONFLICT')
      setError(e instanceof Error ? e.message : 'Chưa hoàn tất thao tác.')
    }
  }
  const value: HocTapState = {
    token, version, zone, zoneReady, revision, tienDoXemTruoc, setTienDoXemTruoc, semesters: data.semesters, subjects: data.subjects,
    hocKy, monHoc, tasks, page, total, pageCount, nhiemVuXemPhien, setPage, chonMonHoc, chonNhiemVu,
    hienNhiemVuMoi, xemPhienNhiemVu, moTab, reload, modal, close, run, thongBaoThanhCong: (message, undo) => setSuccess({ message, undo }),
  }
  if (invalidSubject) return <section className="ht-workspace">
    <h1>Không tìm thấy môn học</h1>
    <p>Môn học này chưa có trong danh sách của bạn. Chọn tên môn từ thanh bên hoặc quay lại danh sách nhiệm vụ.</p>
    <button onClick={xoaBoLoc}>Xem tất cả nhiệm vụ</button>
  </section>
  const filterSummary: string[] = []
  if (!taskView || view !== 'inbox') {
    if (hocKy) filterSummary.push('Học kỳ: ' + (data.semesters.find(s => s.id === hocKy)?.name ?? 'Đang chọn'))
    if (monHoc) filterSummary.push('Môn: ' + (data.subjects.find(s => s.id === monHoc)?.name ?? 'Đang chọn'))
  }
  if (taskView) {
    if (view !== 'all') filterSummary.push('Hiển thị: ' + cheDoNhiemVu[view])
    const priority = params.get('priority')
    const type = params.get('type')
    const status = params.get('status')
    if (priority) filterSummary.push('Ưu tiên: ' + (uuTien[priority] ?? 'Đang chọn'))
    if (type) filterSummary.push('Loại: ' + (loaiViec[type] ?? 'Đang chọn'))
    if (status && view !== 'completed') filterSummary.push('Trạng thái: ' + (trangThai[status] ?? 'Đang chọn'))
    if (!completed && sort !== 'due') filterSummary.push('Sắp xếp: ' + (({ priority: 'Ưu tiên cao trước', progress: 'Tiến độ cao trước', created: 'Mới tạo trước' } as Record<string, string>)[sort] ?? 'Đang chọn'))
  }
  if (taskView && query.trim()) filterSummary.push('Tìm: ' + query.trim())
  const calendar = tab === 'calendar'
  const study = ['classes', 'free', 'planning', 'sessions'].includes(tab)
  const classScope = tab === 'classes'
  const showScope = !trash && !studyBatch && tab !== 'free'
  const showClearFilters = filterSummary.length > 0 || (taskView && filtersOpen)
  const filterActions = <div className="ht-filter-actions">
    {!classScope && <button type="button" className="ht-filter-toggle" aria-expanded={filtersOpen} aria-controls={filterPanelId}
      onClick={() => setFiltersOpen(open => !open)}><Icon name="layers" size={16} />{calendar || study ? 'Bộ lọc' : filtersOpen ? 'Thu gọn bộ lọc' : 'Mở bộ lọc'}</button>}
    {!!filterSummary.length && <span className="ht-filter-count">{filterSummary.length} tùy chọn</span>}
    {showClearFilters && <button type="button" onClick={xoaBoLoc}>Xóa bộ lọc</button>}
  </div>
  const showLearningNav = ready && (!calendar || calendarNavOpen)
  return <Context.Provider value={value}><section className={'ht-workspace' + (taskView ? ' ht-task-workspace' : calendar ? ' ht-calendar-workspace' : study ? ' ht-study-workspace' : '')}>
    <div className={'ht-learning-layout' + (!showLearningNav ? ' ht-navigation-unavailable' : '')}>
    {showLearningNav && <nav id={learningNavId} className="ht-tabs" aria-label="Công cụ học tập">
        {Object.entries({ tasks: 'Nhiệm vụ', board: 'Bảng trạng thái', calendar: 'Thời khóa biểu', classes: 'Lịch học theo môn', free: 'Giờ rảnh của tôi', planning: 'Gợi ý lịch học', sessions: 'Phiên tự học' }).map(([key, label]) => <Fragment key={key}>
          {key === 'calendar' && <span className="ht-nav-caption">Lập kế hoạch</span>}
          <button aria-pressed={tab === key} onClick={() => moTab(key)}><Icon name={navigationIcons[key]} size={16} /><span>{label}</span></button>
          {key === 'tasks' && <div className="ht-task-shortcuts" aria-label="Danh sách nhiệm vụ">
            {Object.entries({ all: 'Tất cả nhiệm vụ', today: 'Hôm nay', upcoming: '7 ngày tới', inbox: 'Chưa phân loại', overdue: 'Quá hạn', undated: 'Không có hạn', completed: 'Đã hoàn thành' }).map(([shortcut, name]) => <button key={shortcut} aria-current={taskView && tab !== 'board' && view === shortcut ? 'page' : undefined} onClick={() => moDanhSachNhiemVu(shortcut)}><Icon name={shortcutIcons[shortcut]} size={15} /><span>{name}</span></button>)}
            <button aria-current={trash ? 'page' : undefined} onClick={() => {
              setParams(new URLSearchParams({ tab: 'trash' }))
              setTab('trash')
            }}><Icon name="trash" size={16} /><span>Thùng rác</span></button>
          </div>}
        </Fragment>)}
      </nav>}
    <KhungChiaChiTiet detail={ready && taskView && selectedTask ? <ChiTietNhiemVu key={selectedTask} ma={selectedTask} inline
      draftRequest={draftPath}
      onChildrenSaved={() => setMoBuocMoi({
        revision: revision + 1,
        path: draftPath ?? [selectedTask],
      })} /> : null}><div className="ht-page-main">
    <header className="ht-heading">
      <div>
        <h1>{tab === 'board' ? 'Bảng trạng thái' : taskView ? cheDoNhiemVu[view] : ({ calendar: 'Thời khóa biểu', classes: 'Lịch học theo môn', free: 'Giờ rảnh của tôi', planning: 'Gợi ý lịch tự học', sessions: 'Phiên tự học', trash: 'Thùng rác' } as Record<string, string>)[tab]}</h1>
      </div>
    {taskView && ready && filterActions}
    {calendar && ready && <div className="ht-calendar-header-actions">
      <button type="button" className="ht-filter-toggle" aria-controls={learningNavId} aria-expanded={calendarNavOpen}
        onClick={() => setCalendarNavOpen(open => !open)}><Icon name="panel-left" size={16} />Công cụ học tập</button>
      {filterActions}
    </div>}
    {study && ready && showScope && (!classScope || showClearFilters) && filterActions}
    </header>
    {!ready ? <p role="alert" className="ht-error">Hãy đăng nhập bằng tài khoản kết nối BE để quản lý nhiệm vụ và lịch học.</p> : <>
      {showScope && <>
      {completed && <div className="ht-completed-filters">
        <label>Ngày hoàn thành<select value={donePeriod} onChange={event => capNhatLoc('donePeriod', event.target.value)}>
          <option value="">Tất cả các ngày</option>
          {Object.entries(khoangDaHoanThanh).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          <option value="day">Ngày cụ thể</option>
        </select></label>
        {donePeriod === 'day' && <label>Chọn ngày<input type="date" value={doneDay} onChange={event => capNhatLoc('doneDay', event.target.value)} /></label>}
      </div>}
      {!classScope && !filtersOpen && !!filterSummary.length && <ul className="ht-filter-summary" aria-label="Bộ lọc đang áp dụng">{filterSummary.map(label => <li key={label} title={label}>{label}</li>)}</ul>}
      <div id={filterPanelId} className={classScope ? 'ht-study-scope' : 'ht-filter-panel'} hidden={!classScope && !filtersOpen}>
      {taskView && <label className="ht-task-search">Tìm nhiệm vụ<input type="search" value={query} maxLength={200} placeholder="Nhập tên hoặc nội dung nhiệm vụ" onChange={e => setQuery(e.target.value)} /></label>}
      <div className="ht-toolbar ht-scope-filter">
        <label>Học kỳ
          <select aria-label="Lọc theo học kỳ" value={hocKy} onChange={e => capNhatLoc('semester', e.target.value)} disabled={taskView && view === 'inbox'}>
            <option value="">{classScope ? 'Tất cả học kỳ' : 'Tất cả học kỳ và việc cá nhân'}</option>
            {data.semesters.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Môn học
          <select aria-label="Lọc theo môn học" value={monHoc} onChange={e => chonMonHoc(e.target.value)} disabled={taskView && view === 'inbox'}>
            <option value="">{classScope ? 'Chọn môn học' : 'Tất cả môn học'}</option>
            {data.subjects.filter(s => !hocKy || s.semesterId === hocKy).map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      {taskView && <div className="ht-toolbar ht-task-filters">
        <label>Hiển thị<select value={view} onChange={e => capNhatLoc('view', e.target.value)}>
          {Object.entries(cheDoNhiemVu).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Ưu tiên<select aria-label="Lọc mức ưu tiên" value={params.get('priority') ?? ''} onChange={e => capNhatLoc('priority', e.target.value)}>
          <option value="">Mọi mức ưu tiên</option>{Object.entries(uuTien).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Loại công việc<select aria-label="Lọc loại công việc" value={params.get('type') ?? ''} onChange={e => capNhatLoc('type', e.target.value)}>
          <option value="">Mọi loại công việc</option>{Object.entries(loaiViec).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Trạng thái<select aria-label="Lọc trạng thái nhiệm vụ" value={params.get('status') ?? ''} onChange={e => capNhatLoc('status', e.target.value)} disabled={view === 'completed'}>
          <option value="">Mặc định danh sách</option>{['NotStarted', 'InProgress', 'Completed'].map(key => <option key={key} value={key}>{trangThai[key]}</option>)}
        </select></label>
        {!completed && <label>Sắp xếp<select value={sort} onChange={e => capNhatLoc('sort', e.target.value)}>
          {Object.entries({ due: 'Hạn gần nhất', priority: 'Ưu tiên cao trước', progress: 'Tiến độ cao trước', created: 'Mới tạo trước' }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>}
      </div>}
      </div>
      </>}
      {academicLoading && <p role="status">Đang tải tên học kỳ và môn học…</p>}

      {error && <div className="ht-error"><span role="alert">{error}</span>{versionConflict && <button type="button" onClick={reload}>Tải dữ liệu mới</button>}</div>}
      {(calendar || study) && !zoneReady && !profileError && <p role="status">Đang tải múi giờ tài khoản…</p>}
      {profileError && <p role="alert" className="ht-error">{profileError} <button type="button" onClick={() => setProfileRevision(value => value + 1)}>Thử lại</button></p>}
      {taskView && <div className="ht-task-body">
        <div className="ht-task-main">
          {!completed && <ThemNhanh />}
          {!snapshot && !taskError && <p role="status">Đang tải nhiệm vụ…</p>}
          {taskError && <p role="alert" className="ht-error">{taskError} <button onClick={reload}>Thử tải lại</button></p>}
          {snapshot && <NhiemVuView key={queryString} board={tab === 'board' && !completed} completed={completed}
            openPath={moBuocMoi?.revision === revision ? moBuocMoi.path : undefined}
            inlineDraft={moBuocMoi?.revision === revision ? moBuocMoi.inlineDraft : undefined}
            onShowCompleted={() => moDanhSachNhiemVu('completed')}
            onInlineSaved={(path, inlineDraft) => setMoBuocMoi({ revision: revision + 1, path, inlineDraft })}
            onAddChildInDetail={path => {
              chonNhiemVu(path[path.length - 1])
              setYeuCauThemBuoc(path)
            }} />}
        </div>
      </div>}
      {trash && <ThungRacView />}
      {zoneReady && ['calendar', 'free', 'classes', 'sessions'].includes(tab) && <LichView key={`${tab}:${calendar ? '' : revision}:${studyBatch ?? ''}:${scheduleDate ?? ''}:${classScope ? monHoc : ''}`} tab={tab} studyBatch={studyBatch} scheduleDate={scheduleDate} />}
      {zoneReady && tab === 'planning' && <LapLichView />}
    </>}
    </div>
    </KhungChiaChiTiet>
    </div>
    {content}
    {success && <div className="ht-success-toast">
      <p role="status" title={success.message}>{success.message}</p>
      {success.undo ? <button type="button" className="ht-toast-undo" aria-label="Hoàn tác hoàn thành" title="Hoàn tác hoàn thành"
        onClick={() => { if (success.undo) { setSuccess(null); void run(success.undo) } }}><Icon name="undo" size={18} /></button>
        : <button type="button" aria-label="Đóng thông báo" onClick={() => setSuccess(null)}><Icon name="close" size={16} /></button>}
    </div>}
  </section></Context.Provider>
}
