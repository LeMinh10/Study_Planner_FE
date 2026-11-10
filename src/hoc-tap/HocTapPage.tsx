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
import { cheDoNhiemVu, layCheDo, layPhamVi, taoTruyVanNhiemVu } from './boLoc'
import type { NhiemVu, Trang } from './types'
import { ChiTietNhiemVu, NhiemVuView, SuaNhiemVu, ThemNhanh } from './NhiemVuView'
import { LichView } from './LichView'
import { LapLichView } from './LapLichView'
import { KhungChiaChiTiet } from './KhungChiaChiTiet'
import './hoc-tap.css'

interface HocTapState {
  token: string
  version: number | null
  zone: string
  zoneReady: boolean
  revision: number
  semesters: Semester[]
  subjects: Subject[]
  hocKy: string
  monHoc: string
  tasks: NhiemVu[]
  page: number
  total: number
  nhiemVuXemPhien: NhiemVu | null
  setPage: (page: number) => void
  chonMonHoc: (id: string) => void
  chonNhiemVu: (id: number | null) => void
  hienNhiemVuMoi: (task: NhiemVu) => void
  xemPhienNhiemVu: (task: NhiemVu | null) => void
  reload: () => void
  modal: (content: ReactNode) => void
  close: () => void
  run: (operation: () => Promise<unknown>) => Promise<void>
  thongBaoThanhCong: (message: string) => void
}
const Context = createContext<HocTapState | null>(null)
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
  const initialTab = ['tasks', 'board', 'calendar', 'classes', 'free', 'planning', 'sessions'].includes(requestedTab) ? requestedTab : mode === 'tasks' ? taskTab : 'calendar'
  const { hocKy, monHoc } = layPhamVi(params, data.subjects)
  const [zone, setZone] = useState('Asia/Ho_Chi_Minh')
  const [zoneReady, setZoneReady] = useState(false)
  const [tasks, setTasks] = useState<NhiemVu[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [version, setVersion] = useState<number | null>(null)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [versionConflict, setVersionConflict] = useState(false)
  const [taskError, setTaskError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [content, setContent] = useState<ReactNode>(null)
  const [success, setSuccess] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterPanelId = useId()
  const [createRequested, setCreateRequested] = useState(false)
  const [tab, setTab] = useState(initialTab)
  const [nhiemVuXemPhien, setNhiemVuXemPhien] = useState<NhiemVu | null>(null)
  const ready = auth.status === 'authenticated' && !auth.isDemo && !useMockApi
  const token = ready ? auth.getAccessToken() : ''
  const invalidSubject = params.has('subject') && !academicLoading && !data.subjects.some(s => s.id === params.get('subject'))
  const view = layCheDo(params)
  const sort = params.get('sort') ?? (params.get('view') === 'priority' ? 'priority' : 'due')
  const taskId = Number(params.get('task'))
  const selectedTask = Number.isSafeInteger(taskId) && taskId > 0 ? taskId : null
  const reload = () => {
    setError('')
    setVersionConflict(false)
    setRevision(value => value + 1)
  }
  useEffect(() => {
    if (!ready || invalidSubject) return
    window.addEventListener('studyplanner:refresh', reload)
    return () => window.removeEventListener('studyplanner:refresh', reload)
  }, [ready, invalidSubject])
  const modal = (value: ReactNode) => setContent(value)
  const close = () => setContent(null)
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(''), 7000)
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
    const next = new URLSearchParams(params)
    if (id) next.set('task', String(id))
    else next.delete('task')
    setParams(next)
  }
  function hienNhiemVuMoi(task: NhiemVu) {
    const next = new URLSearchParams({ view: 'all', sort: 'created', task: String(task.ma) })
    if (task.maHocKy) next.set('semester', String(task.maHocKy))
    if (task.maMonHoc) next.set('subject', String(task.maMonHoc))
    setParams(next)
    setQuery('')
    setSearch('')
    setPage(1)
    setTab('tasks')
  }
  function xemPhienNhiemVu(task: NhiemVu | null) {
    setNhiemVuXemPhien(task)
    setTab('sessions')
    const next = new URLSearchParams(params)
    next.set('tab', 'sessions')
    setParams(next)
  }
  function xoaBoLoc() {
    const next = new URLSearchParams()
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
  useEffect(() => {
    if (!token || invalidSubject) return
    const controller = new AbortController()
    setLoading(true)
    setTaskError('')
    goi<Trang<NhiemVu>>(token, '/tasks?' + queryString, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      setTasks(result.duLieu.danhSach)
      setTotal(result.duLieu.tongSo)
      setVersion(result.phienBan)
      setLoaded(true)
    }).catch(e => {
      if (controller.signal.aborted) return
      setTaskError(e.message)
      setVersion(null)
      setLoaded(false)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token, queryString, revision, invalidSubject])
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
  }, [token, revision])
  useEffect(() => {
    const create = () => setCreateRequested(true)
    window.addEventListener('studyplanner:create-task', create)
    return () => window.removeEventListener('studyplanner:create-task', create)
  }, [])
  useEffect(() => {
    if (createRequested && version !== null && ready && zoneReady && !invalidSubject) {
      modal(<SuaNhiemVu baseline={version} />)
      setCreateRequested(false)
    }
  }, [createRequested, version, ready, zoneReady, invalidSubject])
  useEffect(() => {
    const path = location.pathname
    window.dispatchEvent(new CustomEvent('studyplanner:core-ready', { detail: { path, ready: ready && zoneReady && version !== null && !loading && !invalidSubject } }))
    return () => { window.dispatchEvent(new CustomEvent('studyplanner:core-ready', { detail: { path, ready: false } })) }
  }, [location.pathname, ready, zoneReady, version, loading, invalidSubject])
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
    token, version, zone, zoneReady, revision, semesters: data.semesters, subjects: data.subjects,
    hocKy, monHoc, tasks, page, total, nhiemVuXemPhien, setPage, chonMonHoc, chonNhiemVu,
    hienNhiemVuMoi, xemPhienNhiemVu, reload, modal, close, run, thongBaoThanhCong: setSuccess,
  }
  if (invalidSubject) return <section className="ht-workspace">
    <h1>Không tìm thấy môn học</h1>
    <p>Môn học này chưa có trong danh sách của bạn. Chọn tên môn từ thanh bên hoặc quay lại danh sách nhiệm vụ.</p>
    <button onClick={xoaBoLoc}>Xem tất cả nhiệm vụ</button>
  </section>
  const taskView = tab === 'tasks' || tab === 'board'
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
    if (sort !== 'due') filterSummary.push('Sắp xếp: ' + (({ priority: 'Ưu tiên cao trước', progress: 'Tiến độ cao trước', created: 'Mới tạo trước' } as Record<string, string>)[sort] ?? 'Đang chọn'))
  }
  return <Context.Provider value={value}><section className="ht-workspace">
    <div className={'ht-learning-layout' + (!ready ? ' ht-navigation-unavailable' : '')}>
    {ready && <nav className="ht-tabs" aria-label="Công cụ học tập">
        {Object.entries({ tasks: 'Nhiệm vụ', board: 'Bảng trạng thái', calendar: 'Thời khóa biểu', classes: 'Lịch học theo môn', free: 'Giờ rảnh của tôi', planning: 'Gợi ý lịch học', sessions: 'Phiên tự học' }).map(([key, label]) => <Fragment key={key}>
          {key === 'calendar' && <span className="ht-nav-caption">Lập kế hoạch</span>}
          <button aria-pressed={tab === key} onClick={() => {
          setTab(key)
          if (key === 'sessions') setNhiemVuXemPhien(null)
          const next = new URLSearchParams(params)
          next.set('tab', key)
          if (mode === 'tasks' && ['tasks', 'board', 'calendar'].includes(key)) {
            next.set('layout', key === 'tasks' ? 'list' : key)
          }
          setParams(next)
        }}><Icon name={navigationIcons[key]} size={16} /><span>{label}</span></button>
          {key === 'tasks' && <div className="ht-task-shortcuts" aria-label="Danh sách nhiệm vụ">
            {Object.entries({ today: 'Hôm nay', upcoming: '7 ngày tới', all: 'Tất cả nhiệm vụ', inbox: 'Chưa phân loại', overdue: 'Quá hạn', undated: 'Không có hạn', completed: 'Đã hoàn thành' }).map(([shortcut, name]) => <button key={shortcut} aria-current={taskView && tab !== 'board' && view === shortcut ? 'page' : undefined} onClick={() => {
              const next = new URLSearchParams(params)
              next.set('tab', 'tasks')
              next.set('layout', 'list')
              next.set('view', shortcut)
              next.delete('task')
              next.delete('status')
              setParams(next)
              setPage(1)
              setTab('tasks')
            }}>{name}</button>)}
          </div>}
        </Fragment>)}
      </nav>}
    <KhungChiaChiTiet detail={ready && taskView && selectedTask ? <ChiTietNhiemVu key={selectedTask + '-' + revision} ma={selectedTask} inline /> : null}><div className="ht-page-main">
    <header className="ht-heading">
      <div>
        <span className="ht-eyebrow">KHÔNG GIAN HỌC TẬP</span>
        <h1>{taskView ? cheDoNhiemVu[view] : ({ calendar: 'Thời khóa biểu', classes: 'Lịch học theo môn', free: 'Giờ rảnh của tôi', planning: 'Gợi ý lịch tự học', sessions: 'Phiên tự học' } as Record<string, string>)[tab]}</h1>
        <p>{zoneReady ? new Intl.DateTimeFormat('vi-VN', { timeZone: zone, dateStyle: 'long' }).format(new Date()) : 'Đang tải múi giờ tài khoản…'}</p>
      </div>
      <button disabled={!ready || !zoneReady || version === null} className="ht-primary" onClick={() => modal(<SuaNhiemVu baseline={version!} />)}>+ Thêm nhiệm vụ</button>
    </header>
    {!ready ? <p role="alert" className="ht-error">Hãy đăng nhập bằng tài khoản kết nối BE để quản lý nhiệm vụ và lịch học.</p> : <>
      <div className="ht-filter-bar">
        {taskView && <label className="ht-task-search">Tìm nhiệm vụ<input type="search" value={query} maxLength={200} placeholder="Nhập tên hoặc nội dung nhiệm vụ" onChange={e => setQuery(e.target.value)} /></label>}
        <div className="ht-filter-actions">
          <button className="ht-filter-toggle" aria-expanded={filtersOpen} aria-controls={filterPanelId} onClick={() => setFiltersOpen(open => !open)}><Icon name="layers" size={16} />{filtersOpen ? 'Thu gọn bộ lọc' : 'Mở bộ lọc'}<Icon name="chevron-right" size={14} className={filtersOpen ? 'ht-filter-chevron ht-filter-chevron-open' : 'ht-filter-chevron'} /></button>
          {!!filterSummary.length && <span className="ht-filter-count">{filterSummary.length} tùy chọn</span>}
          <button onClick={xoaBoLoc}>Xóa bộ lọc</button>
        </div>
      </div>
      {!filtersOpen && !!filterSummary.length && <ul className="ht-filter-summary" aria-label="Bộ lọc đang áp dụng">{filterSummary.map(label => <li key={label} title={label}>{label}</li>)}</ul>}
      <div id={filterPanelId} className="ht-filter-panel" hidden={!filtersOpen}>
      <div className="ht-toolbar ht-scope-filter">
        <label>Học kỳ
          <select aria-label="Lọc theo học kỳ" value={hocKy} onChange={e => capNhatLoc('semester', e.target.value)} disabled={taskView && view === 'inbox'}>
            <option value="">Tất cả học kỳ và việc cá nhân</option>
            {data.semesters.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Môn học
          <select aria-label="Lọc theo môn học" value={monHoc} onChange={e => chonMonHoc(e.target.value)} disabled={taskView && view === 'inbox'}>
            <option value="">Tất cả môn học</option>
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
        <label>Sắp xếp<select value={sort} onChange={e => capNhatLoc('sort', e.target.value)}>
          {Object.entries({ due: 'Hạn gần nhất', priority: 'Ưu tiên cao trước', progress: 'Tiến độ cao trước', created: 'Mới tạo trước' }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>}
      </div>
      {academicLoading && <p role="status">Đang tải tên học kỳ và môn học…</p>}

      {error && <div className="ht-error"><span role="alert">{error}</span>{versionConflict && <button type="button" onClick={reload}>Tải dữ liệu mới</button>}</div>}
      {profileError && <p role="alert" className="ht-error">{profileError}</p>}
      {taskView && <div className="ht-task-body">
        <div className="ht-task-main">
          {view === 'inbox' && <p className="ht-note">Danh sách này gồm việc cá nhân của bạn, được xem chung qua các học kỳ.</p>}
          <ThemNhanh />
          {loading && <p role="status">Đang tải nhiệm vụ…</p>}
          {taskError && <p role="alert" className="ht-error">{taskError} <button onClick={reload}>Thử tải lại</button></p>}
          {!loading && loaded && !taskError && <NhiemVuView key={revision + queryString} board={tab === 'board'} />}
        </div>
      </div>}
      {zoneReady && ['calendar', 'free', 'classes', 'sessions'].includes(tab) && <LichView key={tab + revision} tab={tab} />}
      {zoneReady && tab === 'planning' && <LapLichView />}
    </>}
    </div>
    </KhungChiaChiTiet>
    </div>
    {content}
    {success && <div className="ht-success-toast" role="status"><span aria-hidden="true">✓</span><p>{success}</p><button type="button" aria-label="Đóng thông báo" onClick={() => setSuccess('')}>×</button></div>}
  </section></Context.Provider>
}
