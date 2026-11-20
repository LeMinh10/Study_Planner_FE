import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../contexts/AuthContext'
import { usePlanner } from '../contexts/PlannerContext'
import { useMockApi } from '../api/config'
import { goi } from '../hoc-tap/api'
import { congNgay, gioNhap, hienGio, ngay, thoiDiemGui } from '../hoc-tap/time'
import { mocDauNgay } from '../hoc-tap/lich'
import type { NhiemVu, NhiemVuChaTomTat, Trang } from '../hoc-tap/types'
import type { IconName } from '../components/Icon'
import type { ReactNode, RefObject } from 'react'
import { clockText, durationText, focusElapsed, focusTimeline, isPersonal } from './focus'
import type { FocusRecord, FocusState } from './focus'
import { FocusDialog as Dialog } from './FocusDialog'
import { FocusTaskPreview } from './FocusTaskPreview'
import { FocusRecordTime } from './FocusRecordTime'
import { FocusStatistics } from './FocusStatistics'
import './focus.css'
import './focus-details.css'
import { StudySettingsForm, useStudySettings } from '../hoc-tap/StudySettings'

type Preferences = { minutes: number; rest: number; sound: boolean }
function readPreferences(key: string): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    return { minutes: Number.isInteger(value?.minutes) && value.minutes >= 1 && value.minutes <= 180 ? value.minutes : 25,
      rest: Number.isInteger(value?.rest) && value.rest >= 1 && value.rest <= 60 ? value.rest : 5, sound: value?.sound !== false }
  } catch { return { minutes: 25, rest: 5, sound: true } }
}
type TaskBranch = { id: number; title: string; tasks: NhiemVu[] }
type PickerNode = { info: NhiemVuChaTomTat; task?: NhiemVu; children: Map<number, PickerNode> }
type PickerFilter = { value: string; label: string; icon: IconName; hint?: string }

const dateFilters: PickerFilter[] = [
  { value: 'all', label: 'Tất cả nhiệm vụ', icon: 'layers' },
  { value: 'today', label: 'Hôm nay', icon: 'calendar' },
  { value: 'tomorrow', label: 'Ngày mai', icon: 'sun' },
  { value: 'upcoming', label: '7 ngày tới', icon: 'calendar' },
  { value: 'overdue', label: 'Quá hạn', icon: 'clock' },
]
const scopeFilters: PickerFilter[] = [
  { value: 'academic', label: 'Học tập', icon: 'book' },
  { value: 'personal', label: 'Việc cá nhân', icon: 'user' },
]

function pickerTree(tasks: NhiemVu[], branchId?: number) {
  const roots = new Map<number, PickerNode>()
  for (const task of tasks) {
    const path = task.duongDanNhiemVuCha ?? (task.maNhiemVuCha && task.tieuDeNhiemVuCha
      ? [{ ma: task.maNhiemVuCha, tieuDe: task.tieuDeNhiemVuCha, hanHoanThanh: null }]
      : [])
    const ancestors = branchId === undefined ? path : path.slice(path.findIndex(parent => parent.ma === branchId) + 1)
    let level = roots
    for (const info of ancestors) {
      let node = level.get(info.ma)
      if (!node) {
        node = { info, children: new Map() }
        level.set(info.ma, node)
      }
      level = node.children
    }
    level.set(task.ma, { info: { ma: task.ma, tieuDe: task.tieuDe, hanHoanThanh: task.hanHoanThanh }, task, children: new Map() })
  }
  return roots
}

function TaskPicker({ token, recent, zone, branch, anchor, pick, close }: {
  token: string; recent: FocusRecord[]; zone: string; branch?: TaskBranch | null
  anchor?: RefObject<HTMLButtonElement | null>
  pick: (task: NhiemVu | null) => void; close: () => void
}) {
  const { data: planner } = usePlanner()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [filter, setFilter] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const filterButton = useRef<HTMLButtonElement>(null)
  const activeFilterOption = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => { if (filterOpen) activeFilterOption.current?.focus() }, [filterOpen])
  const [paging, setPaging] = useState({ date: '', page: 1 })
  const [rows, setRows] = useState<NhiemVu[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const now = Date.now()
  const today = ngay(now, zone)
  const tomorrow = congNgay(today, 1)
  const nextWeek = congNgay(today, 7)
  const page = paging.date === today ? paging.page : 1
  const subjectId = filter.startsWith('subject:') ? filter.slice('subject:'.length) : ''
  function resetList() {
    if (list.current) list.current.scrollTop = 0
    setPaging({ date: today, page: 1 })
    setRows([])
    setMore(false)
    if (!branch) setLoading(true)
  }
  useEffect(() => {
    if (branch) return
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(() => {
      if (tab === 'recent') {
        const ids = [...new Set(recent.flatMap(row => row.maNhiemVu ? [row.maNhiemVu] : []))]
        void Promise.allSettled(ids.map(id => goi<NhiemVu>(token, '/tasks/' + id, { signal: controller.signal }))).then(results => {
          if (controller.signal.aborted) return
          setRows(results.flatMap(result => result.status === 'fulfilled' ? [result.value.duLieu] : [])); setMore(false); setLoading(false)
          if (results.some(result => result.status === 'rejected' && result.reason?.status !== 404))
            setError('Chưa tải đủ nhiệm vụ gần đây. Hãy thử lại.')
        })
        return
      }
      const pageSize = 50
      const view = ['today', 'upcoming', 'overdue'].includes(filter) ? filter : 'all'
      const params = new URLSearchParams({ cheDo: view, chiLa: 'true', trang: String(page), kichThuocTrang: String(pageSize), tuKhoa: query.trim() })
      if (filter === 'academic' || filter === 'personal') params.set('phamVi', filter)
      if (subjectId) params.set('maMonHoc', subjectId)
      if (filter === 'tomorrow') {
        params.set('tuHan', new Date(mocDauNgay(tomorrow, zone)).toISOString())
        params.set('denHan', new Date(mocDauNgay(congNgay(tomorrow, 1), zone)).toISOString())
      }
      const filters = [params]
      if (filter === 'today') {
        const earlier = new URLSearchParams(params)
        earlier.set('cheDo', 'overdue')
        earlier.set('denHan', new Date(mocDauNgay(today, zone)).toISOString())
        filters.push(earlier)
      }
      Promise.all(filters.map(item => goi<Trang<NhiemVu>>(token, '/tasks?' + item, { signal: controller.signal }))).then(results => {
        if (controller.signal.aborted) return
        const items = results.flatMap(result => result.duLieu.danhSach)
        setRows(previous => page === 1 ? items : [...previous, ...items])
        setMore(results.some(result => page * pageSize < result.duLieu.tongSo))
      }).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [branch, filter, page, query, recent, retry, subjectId, tab, today, token, tomorrow, zone])
  const keyword = query.trim().toLocaleLowerCase('vi')
  const pending = !branch && loading
  const choices = [...new Map((branch?.tasks ?? rows).map(task => [task.ma, task])).values()].filter(task => {
    if (task.coNhiemVuCon || task.tienDo >= 100) return false
    if (!task.tieuDe.toLocaleLowerCase('vi').includes(keyword)) return false
    if (subjectId) return String(task.maMonHoc) === subjectId
    if (filter === 'academic' || filter === 'personal') return (filter === 'personal') === isPersonal(task)
    if ((!branch && tab === 'all') || filter === 'all') return true
    if (!task.hanHieuLuc) return false
    if (filter === 'overdue') return Date.parse(task.hanHieuLuc) < now
    const day = gioNhap(task.hanHieuLuc, zone).slice(0, 10)
    if (filter === 'today') return day <= today
    if (filter === 'tomorrow') return day === tomorrow
    return day >= today && day < nextWeek
  })
  const groups = filter === 'today' ? [
    { label: 'Hôm nay', tasks: choices.filter(task => task.hanHieuLuc && gioNhap(task.hanHieuLuc, zone).slice(0, 10) === today) },
    { label: 'Quá hạn', tasks: choices.filter(task => task.hanHieuLuc && gioNhap(task.hanHieuLuc, zone).slice(0, 10) < today) },
  ] : [{ label: '', tasks: choices }]
  const subjects: PickerFilter[] = planner.subjects.map(subject => ({
    value: 'subject:' + subject.id, label: subject.name, icon: 'book',
    hint: planner.semesters.find(semester => semester.id === subject.semesterId)?.name,
  }))
  const activeFilter = [...dateFilters, ...scopeFilters, ...subjects].find(item => item.value === filter) ?? dateFilters[0]
  function switchTab(next: string) {
    if (tab === next) return
    resetList()
    setTab(next)
    setFilterOpen(false)
  }
  function dismissFilters() {
    setFilterOpen(false)
    filterButton.current?.focus()
  }
  function filterOption(option: PickerFilter) {
    const selected = option.value === filter
    return <button key={option.value} ref={selected ? activeFilterOption : undefined} type="button" aria-pressed={selected}
      onClick={() => {
        if (!selected) { resetList(); setFilter(option.value) }
        dismissFilters()
      }}>
      <Icon name={option.icon} size={15} />
      <span>{option.value === 'all' && branch ? 'Tất cả các bước' : option.label}{option.hint && <small>{option.hint}</small>}</span>
      {selected && <Icon name="check" size={14} />}
    </button>
  }
  function renderNodes(nodes: Map<number, PickerNode>, group: string, depth = 0): ReactNode {
    return [...nodes.values()].map(({ info, task, children }) => {
      const key = group + ':' + info.ma
      const open = !collapsed.has(key)
      const deadline = info.hanHoanThanh ?? (task && !task.duongDanNhiemVuCha?.length ? task.hanHieuLuc : null)
      const due = deadline ? gioNhap(deadline, zone) : ''
      const course = task && planner.subjects.find(item => item.id === String(task.maMonHoc))
      return <div key={info.ma}>
        <button className="focus-picker-row" type="button" style={{ paddingInlineStart: 4 + Math.min(depth, 8) * 12 }}
          title={course ? info.tieuDe + ' · ' + course.name : info.tieuDe}
          aria-expanded={task ? undefined : open}
          onClick={() => {
            if (task) { pick(task); return }
            setCollapsed(previous => {
              const next = new Set(previous)
              if (next.has(key)) next.delete(key)
              else next.add(key)
              return next
            })
          }}>
          <span className="focus-picker-tree-arrow">{!task && <Icon name="chevron-right" size={11} />}</span>
          <span className="focus-task-dot" aria-hidden="true" />
          <span className="focus-picker-task-name">{info.tieuDe}</span>
          {deadline && <time dateTime={deadline} title={hienGio(deadline, zone)} data-overdue={Date.parse(deadline) < now}>
            {due.slice(8, 10)}/{due.slice(5, 7)}
          </time>}
        </button>
        {!task && open && renderNodes(children, group, depth + 1)}
      </div>
    })
  }
  return <Dialog title={branch ? 'Chọn bước để tập trung' : 'Chọn nhiệm vụ tập trung'} close={close} anchor={anchor} className="focus-task-picker">
    {branch ? <p className="focus-picker-parent">{branch.title}</p> : <div className="focus-picker-tabs">
      <button type="button" aria-pressed={tab === 'recent'} onClick={() => switchTab('recent')}>Gần đây</button>
      <button type="button" aria-pressed={tab === 'all'} onClick={() => switchTab('all')}>Nhiệm vụ</button>
    </div>}
    <label className="focus-search"><Icon name="search" size={16} /><input autoFocus type="search" placeholder="Tìm nhiệm vụ…" aria-label="Tìm nhiệm vụ tập trung" value={query} onFocus={() => setFilterOpen(false)} onChange={e => { resetList(); setQuery(e.target.value) }} /></label>
    <button className="focus-picker-filter" type="button" ref={filterButton} aria-expanded={filterOpen}
      onClick={() => setFilterOpen(value => !value)}>
      <Icon name={activeFilter.icon} size={16} />
      <span>{branch && filter === 'all' ? 'Tất cả các bước' : activeFilter.label}</span>
      <Icon name="chevron-right" size={13} />
    </button>
    <div className="focus-picker-results">
      <div className="focus-task-options" ref={list} inert={filterOpen} data-filter-open={filterOpen}>
        {!branch && <button type="button" className="focus-picker-row focus-picker-free" onClick={() => pick(null)}>
          <span className="focus-picker-tree-arrow" /><span className="focus-task-dot" aria-hidden="true" />
          <span className="focus-picker-task-name">Tập trung tự do</span>
        </button>}
        {groups.filter(group => group.tasks.length).map(group => <div key={group.label}>
          {group.label && <h3 className="focus-picker-heading">{group.label}</h3>}
          {renderNodes(pickerTree(group.tasks, branch?.id), group.label)}
        </div>)}
        {!pending && !error && !choices.length && <p className="focus-empty">{more ? 'Chưa thấy nhiệm vụ phù hợp. Có thể tải thêm.' : 'Không có nhiệm vụ phù hợp.'}</p>}
        {pending && <p role="status" className="focus-empty">Đang tải nhiệm vụ…</p>}
        {error && <p role="alert" className="focus-error">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></p>}
        {more && <button type="button" className="focus-picker-more" disabled={pending} onClick={() => setPaging({ date: today, page: page + 1 })}>Tải thêm</button>}
      </div>
      {filterOpen && <>
        <button className="focus-picker-filter-dismiss" type="button" aria-label="Đóng bộ lọc" tabIndex={-1} onClick={dismissFilters} />
        <div className="focus-picker-filter-list" role="group" aria-label="Lọc nhiệm vụ tập trung" onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissFilters() }
        }}>
          {dateFilters.map(filterOption)}
          {!branch && scopeFilters.map(filterOption)}
          {!branch && !!subjects.length && <><h3>Môn học</h3>{subjects.map(filterOption)}</>}
        </div>
      </>}
    </div>
  </Dialog>
}

export function FocusPage() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const token = auth.status === 'authenticated' && !auth.isDemo && !useMockApi ? auth.getAccessToken() : ''
  const preferenceKey = 'studyplanner:focus-preferences:' + auth.user?.email
  const [localPreferences, setLocalPreferences] = useState(() => readPreferences(preferenceKey))
  const studySettings = useStudySettings(token)
  const preferences = { minutes: studySettings.data?.phienHocPhut ?? 25, rest: studySettings.data?.nghiGiuaPhienPhut ?? 5, sound: localPreferences.sound }
  const [mode, setMode] = useState<'Pomodoro' | 'Stopwatch'>('Pomodoro')
  const [selectedTask, setSelectedTask] = useState<Pick<NhiemVu, 'ma' | 'tieuDe'> | null>(null)
  const [taskBranch, setTaskBranch] = useState<TaskBranch | null>(null)
  const shortcutTaskId = Number(params.get('task'))
  const shortcutMode = params.get('mode') === 'Stopwatch' ? 'Stopwatch' : 'Pomodoro'
  const sessionMode = params.get('mode') === 'Pomodoro' ? 'Pomodoro' : 'Stopwatch'
  const openingTask = !params.has('session') && Number.isSafeInteger(shortcutTaskId) && shortcutTaskId > 0
  const [snapshot, setSnapshot] = useState<{ token: string; version: number; data: FocusState } | null>(null)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<'task' | 'settings' | 'statistics' | 'finish' | 'manual' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [taskPreview, setTaskPreview] = useState<number | null>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!moreRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])
  const [recordDetail, setRecordDetail] = useState<FocusRecord | null>(null)
  const [editingTime, setEditingTime] = useState<FocusRecord | null>(null)
  const [note, setNote] = useState('')
  const [finished, setFinished] = useState<FocusRecord | null>(null)
  const [now, setNow] = useState(Date.now)
  const [restEnd, setRestEnd] = useState<number | null>(() => {
    try { const value = Number(localStorage.getItem(preferenceKey + ':rest')); return value > Date.now() ? value : null } catch { return null }
  })
  const requestNumber = useRef(0)
  const autoStart = useRef<number | null>(null)
  const autoFinish = useRef<number | null>(null)
  const currentRef = useRef<FocusRecord | null>(null)
  const recentRecords = useRef<FocusRecord[]>([])
  const sound = useRef<AudioContext | null>(null)
  const soundEnabled = useRef(preferences.sound)
  const pageRef = useRef<HTMLElement>(null)
  const taskSelect = useRef<HTMLButtonElement>(null)
  soundEnabled.current = preferences.sound
  const data = snapshot?.token === token ? snapshot.data : null
  const current = data?.hienTai ?? null
  const zone = data?.muiGio ?? 'Asia/Ho_Chi_Minh'
  // Giữ riêng thời điểm nhận dữ liệu để việc vẽ lại giao diện không làm lệch mốc đồng hồ máy chủ.
  const receivedAt = useRef(Date.now())
  const serverNow = now + (data ? Date.parse(data.thoiDiemMayChu) - receivedAt.current : 0)
  const elapsed = current ? focusElapsed(current, serverNow) : 0
  const activeMode = current?.cheDo ?? mode
  const restSeconds = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0
  const clockSeconds = restEnd ? restSeconds : current ? activeMode === 'Pomodoro' ? Math.max(0, Math.ceil(current.mucTieuGiay - elapsed / 1000)) : elapsed / 1000 : activeMode === 'Pomodoro' ? preferences.minutes * 60 : 0
  const progress = restEnd ? 1 - restSeconds / (preferences.rest * 60) : current ? activeMode === 'Pomodoro' ? elapsed / (current.mucTieuGiay * 1000) : (elapsed / 1000 % 60) / 60 : 0
  function beep() {
    if (!soundEnabled.current || !sound.current) return
    try {
      const oscillator = sound.current.createOscillator(), gain = sound.current.createGain()
      oscillator.connect(gain); gain.connect(sound.current.destination); oscillator.frequency.value = 660
      gain.gain.setValueAtTime(0.12, sound.current.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, sound.current.currentTime + 0.7)
      oscillator.start(); oscillator.stop(sound.current.currentTime + 0.7)
    } catch { /* Âm báo là tùy chọn; giao diện vẫn hiển thị khi phiên hoàn tất. */ }
  }
  function enableSound() {
    try { sound.current ??= new AudioContext(); void sound.current.resume().catch(() => {}) } catch { /* Trình duyệt có thể không hỗ trợ âm thanh. */ }
  }
  useEffect(() => () => { void sound.current?.close().catch(() => {}) }, [])
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token) return
    const sequence = ++requestNumber.current
    const result = await goi<FocusState>(token, '/focus/state?trang=' + page, { signal })
    if (signal?.aborted || sequence !== requestNumber.current) return
    const previous = currentRef.current
    if (page === 1) recentRecords.current = result.duLieu.lichSu
    if (previous && !result.duLieu.hienTai) {
      const saved = result.duLieu.lichSu.find(row => row.ma === previous.ma)
      if (saved) { setFinished(saved); window.dispatchEvent(new Event('studyplanner:focus-changed')) }
    }
    receivedAt.current = Date.now(); currentRef.current = result.duLieu.hienTai
    if (result.duLieu.hienTai) {
      setMode(result.duLieu.hienTai.cheDo)
      setSelectedTask(result.duLieu.hienTai.maNhiemVu ? { ma: result.duLieu.hienTai.maNhiemVu, tieuDe: result.duLieu.hienTai.tieuDe } : null)
    }
    setSnapshot({ token, version: result.phienBan, data: result.duLieu }); setNow(Date.now())
    return result
  }, [token, page])
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    const refresh = () => { void load().catch(e => setError(e.message)) }
    const timer = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh); window.addEventListener('studyplanner:refresh', refresh); window.addEventListener('studyplanner:saved', refresh)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('studyplanner:refresh', refresh); window.removeEventListener('studyplanner:saved', refresh) }
  }, [load])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer) }, [])
  useEffect(() => { setNote(current?.ghiChu ?? '') }, [current?.ma])
  useEffect(() => {
    if (busy || current?.cheDo !== 'Pomodoro' || current.trangThai !== 'Running' || elapsed < current.mucTieuGiay * 1000 || autoFinish.current === current.ma) return
    autoFinish.current = current.ma
    beep()
    void action('finish')
  }, [current, elapsed, busy])
  useEffect(() => {
    if (!restEnd || restSeconds > 0) return
    setRestEnd(null); try { localStorage.removeItem(preferenceKey + ':rest') } catch { /* Không chặn thao tác nếu trình duyệt không lưu được giờ nghỉ. */ }
    setNotice('Hết giờ nghỉ.'); beep()
  }, [restEnd, restSeconds, preferenceKey])
  const begin = useCallback(async (sessionId?: number, linkedMode: FocusRecord['cheDo'] = 'Stopwatch') => {
    if (!snapshot || !studySettings.data || studySettings.loading || studySettings.error || busy) return
    setBusy(true); setError(''); setNotice(''); setFinished(null); setPage(1)
    try {
      const r = await goi<FocusRecord>(token, '/focus/start', { method: 'POST', version: snapshot.version, body: {
        maNhiemVu: sessionId ? null : selectedTask?.ma ?? null, maPhienTuHoc: sessionId ?? null,
        cheDo: sessionId ? linkedMode : mode, mucTieuGiay: preferences.minutes * 60,
      } })
      currentRef.current = r.duLieu; setNote(r.duLieu.ghiChu ?? '')
      await load(); window.dispatchEvent(new Event('studyplanner:focus-changed'))
      if (sessionId) setParams({}, { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa bắt đầu được phiên.'); await load().catch(() => {}) }
    finally { setBusy(false) }
  }, [snapshot, busy, token, selectedTask, mode, preferences.minutes, studySettings.data, studySettings.loading, studySettings.error, load, setParams])
  useEffect(() => {
    const sessionId = Number(params.get('session'))
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) { autoStart.current = null; return }
    if (!data || !studySettings.data || studySettings.loading || studySettings.error || autoStart.current === sessionId) return
    autoStart.current = sessionId
    if (current) {
      if (current.maPhienTuHoc !== sessionId) setNotice('Bạn đang có phiên tập trung khác. Kết thúc phiên hiện tại trước khi chuyển nhiệm vụ.')
      setParams({}, { replace: true })
      return
    }
    void begin(sessionId, sessionMode)
  }, [data, current, params, begin, sessionMode, setParams])
  const ready = !!data
  const activeId = current?.ma ?? data?.maPhienDangHocCu
  useEffect(() => {
    if (!openingTask || !ready) return
    setTaskPreview(null)
    setRecordDetail(null)
    setTaskBranch(null)
    if (activeId) {
      setNotice('Bạn đang có một phiên tập trung.')
      setParams({}, { replace: true })
      return
    }
    const controller = new AbortController()
    goi<NhiemVu[]>(token, '/tasks/' + shortcutTaskId + '/tree', { signal: controller.signal })
      .then(({ duLieu: tasks }) => {
        if (controller.signal.aborted) return
        const target = tasks.find(task => task.ma === shortcutTaskId)
        setMode(shortcutMode)
        setSelectedTask(null)
        setFinished(null)
        setNotice('')
        if (!target || target.tienDo >= 100) {
          setNotice('Hãy chọn một nhiệm vụ khác để tập trung.')
        } else if (target.coNhiemVuCon) {
          setTaskBranch({ id: target.ma, title: target.tieuDe, tasks })
          setModal('task')
        } else {
          setSelectedTask(target)
        }
        setParams({}, { replace: true })
      }).catch(e => {
        if (controller.signal.aborted) return
        setSelectedTask(null)
        setError(e instanceof Error ? e.message : 'Chưa mở được nhiệm vụ tập trung.')
        setParams({}, { replace: true })
      })
    return () => controller.abort()
  }, [activeId, openingTask, ready, setParams, shortcutMode, shortcutTaskId, token])
  function closeTaskPicker() {
    setModal(null)
    setTaskBranch(null)
  }
  async function action(name: string, target = current, text = note) {
    if (!snapshot || !target || busy) return
    setBusy(true); setError('')
    try {
      const result = await goi<FocusRecord>(token, `/focus/${target.ma}/${name}`, { method: 'POST', version: snapshot.version, body: { ghiChu: text } })
      if (result.duLieu.trangThai === 'Completed') setFinished(result.duLieu)
      currentRef.current = ['Running', 'Paused'].includes(result.duLieu.trangThai) ? result.duLieu : null
      setModal(value => value === 'finish' ? null : value)
      if (name === 'note' && target.ma !== current?.ma) setRecordDetail(null)
      if (name === 'note') setNotice('Đã lưu ghi chú.')
      if (name === 'discard') { setFinished(null); setNotice('Đã bỏ phiên.') }
      await load(); window.dispatchEvent(new Event('studyplanner:focus-changed'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa lưu được thay đổi.'); await load().catch(() => {}) }
    finally { setBusy(false) }
  }
  const groups = new Map<string, FocusRecord[]>()
  for (const row of data?.lichSu ?? []) {
    const day = ngay(row.batDau, zone)
    groups.set(day, [...(groups.get(day) ?? []), row])
  }
  const time = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
  const controlsDisabled = busy || openingTask || !data || !token || !studySettings.data || studySettings.loading || !!studySettings.error
  function startBreak() {
    const end = Date.now() + preferences.rest * 60000
    setFinished(null); setRestEnd(end); enableSound()
    try { localStorage.setItem(preferenceKey + ':rest', String(end)) } catch { /* Không chặn thao tác nếu trình duyệt không lưu được giờ nghỉ. */ }
  }
  return <section className={'focus-page' + (restEnd ? ' focus-resting' : '')} ref={pageRef}>
    <div className="focus-main">
      <header className="focus-header"><h1>Tập trung</h1>
        <div className="focus-mode" role="group" aria-label="Chế độ đồng hồ"><button type="button" disabled={!!current || !!restEnd} aria-pressed={activeMode === 'Pomodoro'} onClick={() => { setMode('Pomodoro'); setFinished(null) }}>Pomodoro</button><button type="button" disabled={!!current || !!restEnd} aria-pressed={activeMode === 'Stopwatch'} onClick={() => { setMode('Stopwatch'); setFinished(null) }}>Đếm lên</button></div>
        <div className="focus-more" ref={moreRef}><button className="focus-icon" type="button" disabled={busy} aria-label="Tùy chọn đồng hồ" title="Tùy chọn đồng hồ" aria-expanded={menuOpen} aria-controls="focus-more-menu" onClick={() => setMenuOpen(value => !value)}><Icon name="dots" size={22} /></button>{menuOpen && <div id="focus-more-menu" className="focus-more-menu" role="group" aria-label="Các tùy chọn đồng hồ"><button type="button" onClick={() => { setMenuOpen(false); setModal('statistics') }}><Icon name="chart" size={16} />Thống kê</button><button type="button" onClick={() => { setMenuOpen(false); setModal('settings') }}><Icon name="clock" size={16} />Cài đặt đồng hồ</button></div>}</div>
      </header>
      {!token && <p className="focus-error" role="alert">Đăng nhập để lưu phiên tập trung.</p>}
      {error && <div role="alert" className="focus-error">{error}<button type="button" onClick={() => { setError(''); void load().catch(e => setError(e.message)) }}>Tải lại</button></div>}
      {notice && <p role="status" className="focus-notice">{notice}</p>}
      {studySettings.error && <p role="alert" className="focus-error">{studySettings.error}<button type="button" onClick={studySettings.refresh}>Tải lại cấu hình học</button></p>}
      <div className="focus-stage">
        <button type="button" ref={taskSelect} className="focus-task-select" disabled={!!current || !!restEnd || controlsDisabled}
          aria-label={current?.tieuDe ?? selectedTask?.tieuDe ?? 'Chọn nhiệm vụ tập trung'} aria-haspopup="dialog" aria-expanded={modal === 'task'} onClick={() => setModal('task')}>
          <span>{current?.tieuDe ?? selectedTask?.tieuDe ?? 'Tập trung'}</span>{!current && <Icon name="chevron-right" size={14} />}
        </button>
        {current?.maPhienTuHoc && <span className="focus-plan-label"><Icon name="calendar" size={13} />Phiên tự học</span>}
        <div className="focus-clock" aria-label={restEnd ? 'Đồng hồ nghỉ' : 'Đồng hồ tập trung'}>
          <svg viewBox="0 0 300 300" aria-hidden="true"><circle className="focus-ring-bg" cx="150" cy="150" r="138" /><circle className="focus-ring-progress" cx="150" cy="150" r="138" pathLength="100" opacity={progress > 0 ? 1 : 0} strokeDasharray={`${Math.max(0, Math.min(1, progress)) * 100} 100`} /></svg>
          <div className="focus-clock-face">
            {restEnd && <span>Đang nghỉ</span>}
            {!restEnd && current?.trangThai === 'Paused' && <span>Đã tạm dừng</span>}
            <strong role="timer" aria-label={restEnd ? 'Thời gian nghỉ còn lại' : 'Thời gian tập trung'}>{clockText(clockSeconds)}</strong>
            {!restEnd && current && activeMode === 'Pomodoro' && <small>{durationText(elapsed)} đã tập trung</small>}
          </div>
        </div>
        <div className="focus-controls">
          {restEnd ? <button className="focus-primary" type="button" onClick={() => { setRestEnd(null); try { localStorage.removeItem(preferenceKey + ':rest') } catch { /* Không chặn thao tác nếu trình duyệt không lưu được giờ nghỉ. */ } }}>Bỏ qua giờ nghỉ</button>
            : !current ? <button className="focus-primary" type="button" disabled={controlsDisabled} onClick={() => { enableSound(); const linked = Number(params.get('session') ?? data?.maPhienDangHocCu ?? ''); void begin(Number.isSafeInteger(linked) && linked > 0 ? linked : undefined, sessionMode) }}>{busy ? 'Đang bắt đầu…' : data?.maPhienDangHocCu ? 'Tiếp tục phiên đang học' : 'Bắt đầu'}</button>
            : <><button className="focus-primary" type="button" disabled={busy} onClick={() => { enableSound(); void action(current.trangThai === 'Running' ? 'pause' : 'resume') }}><Icon name={current.trangThai === 'Running' ? 'pause' : 'play'} size={18} />{current.trangThai === 'Running' ? 'Tạm dừng' : 'Tiếp tục'}</button><button className="focus-secondary" type="button" disabled={busy} onClick={() => setModal('finish')}>Kết thúc</button></>}
        </div>
        {current && <p className="focus-hint">Thời gian tạm dừng không tính vào phiên.</p>}
        {finished && !current && !restEnd && <div className="focus-completion" role="status"><span className="focus-complete-icon"><Icon name="check" size={20} /></span><h2>Đã lưu {durationText(finished.soMiliGiayDaHoc)} tập trung</h2><p>{finished.tieuDe}</p><div>{finished.maNhiemVu && <button type="button" onClick={() => setTaskPreview(finished.maNhiemVu)}>Cập nhật tiến độ<Icon name="arrow-right" size={14} /></button>}{finished.cheDo === 'Pomodoro' && <button type="button" onClick={startBreak}>Nghỉ {preferences.rest} phút</button>}</div></div>}
      </div>
      <footer className="focus-main-footer"><button type="button" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void pageRef.current?.requestFullscreen().catch(() => setNotice('Trình duyệt chưa mở được toàn màn hình.')) }}>Toàn màn hình<Icon name="overview" size={14} /></button></footer>
    </div>
    <aside className="focus-insights" aria-label="Tổng quan tập trung">
      <header><h2>{current ? activeMode === "Pomodoro" ? "Pomodoro" : "Đếm lên" : "Tổng quan"}</h2><span className="focus-today-label">{new Intl.DateTimeFormat('vi-VN', { timeZone: zone, day: 'numeric', month: 'long' }).format(new Date(now))}</span></header>
      {!current && <><div className="focus-stats">{[
        ['Pomodoro hoàn tất hôm nay', String(data?.tongQuan.pomoHomNay ?? 0), 'sun'],
        ['Tập trung hôm nay', durationText(data?.tongQuan.miliGiayHomNay ?? 0), 'clock'],
        ['Tổng Pomodoro hoàn tất', String(data?.tongQuan.tongPomo ?? 0), 'leaf'],
        ['Tổng thời gian', durationText(data?.tongQuan.tongMiliGiay ?? 0), 'chart'],
      ].map(([label, value, icon]) => <div key={label}><span>{label}</span><strong>{value}</strong><Icon name={icon as 'sun' | 'clock' | 'leaf' | 'chart'} size={18} /></div>)}</div></>}
      {current && <FocusTimeline current={current} records={data?.lichSu ?? []} now={serverNow} zone={zone} />}
      {current && <section className="focus-note-panel"><div className="focus-section-title"><h2>Ghi chú phiên</h2><Icon name="edit" size={16} /></div><label><span className="sr-only">Ghi chú phiên tập trung</span><textarea value={note} maxLength={2000} placeholder="Ghi chú cho phiên này…" onChange={e => setNote(e.target.value)} /></label><div><small>{note.length}/2.000</small><button type="button" disabled={busy || note.trim() === (current.ghiChu ?? '')} onClick={() => void action('note')}>Lưu ghi chú</button></div></section>}
      {!current && <section className="focus-history"><div className="focus-section-title"><h2>Lịch sử tập trung</h2><button type="button" className="focus-icon" title="Thêm bản ghi tập trung" aria-label="Thêm bản ghi tập trung" disabled={controlsDisabled} onClick={() => setModal('manual')}><Icon name="plus" size={20} /></button></div>
        {!data && !error && <p role="status" className="focus-empty">Đang tải phiên tập trung…</p>}
        {data && !data.lichSu.length && <div className="focus-history-empty"><Icon name="clock" size={29} /><p>Chưa có phiên tập trung.</p></div>}
        {[...groups].map(([day, rows]) => <div className="focus-history-day" key={day}><h3>{day === ngay(now, zone) ? 'Hôm nay' : new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00Z'))}</h3>{rows.map(row => <article className="focus-record" key={row.ma}><button type="button" className="focus-record-open" aria-label={'Chi tiết lần tập trung: ' + row.tieuDe} onClick={() => setRecordDetail(row)}><span className="focus-record-icon"><Icon name={row.cheDo === 'Pomodoro' ? 'leaf' : 'clock'} size={15} /></span></button><div className="focus-record-body"><button type="button" className="focus-record-time" onClick={() => setRecordDetail(row)}>{time(row.batDau)} – {row.ketThuc ? time(row.ketThuc) : ''}{row.nhapThuCong ? ' · Nhập tay' : ''}</button><button type="button" className="focus-record-task" data-linked={row.maNhiemVu != null} onClick={() => { if (row.maNhiemVu != null) setTaskPreview(row.maNhiemVu); else setRecordDetail(row) }}>{row.tieuDe}</button>{row.ghiChu && <p>{row.ghiChu}</p>}</div><button type="button" className="focus-record-duration" onClick={() => setRecordDetail(row)}>{durationText(row.soMiliGiayDaHoc)}</button></article>)}</div>)}
        {data && data.tongSo > 20 && <div className="focus-pagination"><button type="button" disabled={page <= 1 || busy} onClick={() => setPage(value => value - 1)}>Trước</button><span>{page}/{Math.ceil(data.tongSo / 20)}</span><button type="button" disabled={page * 20 >= data.tongSo || busy} onClick={() => setPage(value => value + 1)}>Sau</button></div>}
      </section>}
    </aside>
    {modal === 'task' && <TaskPicker token={token} recent={recentRecords.current} zone={zone} branch={taskBranch} anchor={taskBranch ? undefined : taskSelect} close={closeTaskPicker}
      pick={task => { setSelectedTask(task); setFinished(null); closeTaskPicker() }} />}
    {modal === 'settings' && <Dialog title="Cài đặt đồng hồ" close={() => setModal(null)}><StudySettingsForm token={token} sound={preferences.sound} close={() => setModal(null)} onSaved={() => setModal(null)} saveSound={sound => { const next = { ...localPreferences, sound }; setLocalPreferences(next); try { localStorage.setItem(preferenceKey, JSON.stringify({ sound })) } catch { /* Không chặn lưu cấu hình học nếu trình duyệt không lưu được tùy chọn âm báo. */ } }} /></Dialog>}
    {modal === 'finish' && current && <Dialog title="Kết thúc phiên tập trung?" busy={busy} close={() => { if (!busy) setModal(null) }}><p>Bạn đã tập trung <strong>{durationText(elapsed)}</strong> cho {current.tieuDe}.</p><p className="focus-hint">Bỏ phiên sẽ không lưu thời gian đã học.</p>{error && <p role="alert" className="focus-error">{error}</p>}<footer><button type="button" disabled={busy} onClick={() => setModal(null)}>Quay lại</button><button type="button" className="focus-danger" disabled={busy} onClick={() => void action('discard')}>Bỏ phiên</button><button type="button" className="focus-primary" disabled={busy} onClick={() => void action('finish')}>Lưu và kết thúc</button></footer></Dialog>}
    {modal === 'manual' && snapshot && <ManualRecord token={token} version={snapshot.version} zone={zone} recent={recentRecords.current} close={() => setModal(null)} saved={async row => { setFinished(row); setModal(null); await load(); window.dispatchEvent(new Event('studyplanner:focus-changed')) }} />}
    {modal === 'statistics' && <FocusStatistics token={token} today={ngay(serverNow, zone)} close={() => setModal(null)} openTask={setTaskPreview} />}
    {recordDetail && <RecordDetail record={recordDetail} error={error} busy={busy} zone={zone} close={() => setRecordDetail(null)}
      save={text => void action('note', recordDetail, text)} openTask={setTaskPreview}
      editTime={() => { setEditingTime(recordDetail); setRecordDetail(null) }} />}
    {editingTime && <FocusRecordTime id={editingTime.ma} token={token} zone={zone}
      close={() => { setRecordDetail(editingTime); setEditingTime(null) }}
      onSaved={record => {
        setEditingTime(null)
        setRecordDetail(record)
        setFinished(previous => previous?.ma === record.ma ? record : previous)
        setNotice('Đã lưu thời gian thực học.')
        void load().catch(e => setError(e.message))
        window.dispatchEvent(new Event('studyplanner:focus-changed'))
      }} />}
    {taskPreview != null && <FocusTaskPreview key={taskPreview} id={taskPreview} token={token} zone={zone} close={() => setTaskPreview(null)} />}
  </section>
}

function ManualRecord({ token, version, zone, recent, close, saved }: { token: string; version: number; zone: string; recent: FocusRecord[]; close: () => void; saved: (record: FocusRecord) => Promise<void> }) {
  const [task, setTask] = useState<NhiemVu | null>(null)
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [start] = useState(() => gioNhap(new Date(Date.now() - 25 * 60000).toISOString(), zone))
  const [end] = useState(() => gioNhap(new Date().toISOString(), zone))
  return <><Dialog title="Thêm bản ghi tập trung" busy={busy} close={() => { if (!busy) close() }}><form onSubmit={async event => {
    event.preventDefault(); if (busy) return
    const form = new FormData(event.currentTarget); setBusy(true); setError('')
    try {
      const result = await goi<FocusRecord>(token, '/focus/records', { method: 'POST', version, body: {
        maNhiemVu: task?.ma ?? null, cheDo: form.get('mode'), mucTieuGiay: Number(form.get('target')) * 60,
        batDau: thoiDiemGui(String(form.get('start')), null, zone), ketThuc: thoiDiemGui(String(form.get('end')), null, zone), ghiChu: form.get('note') || null,
      } })
      await saved(result.duLieu)
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa lưu được bản ghi.') }
    finally { setBusy(false) }
  }}><fieldset disabled={busy}>{error && <p className="focus-error" role="alert">{error}</p>}<label>Nhiệm vụ<button type="button" className="focus-form-task" onClick={() => setPicker(true)}>{task?.tieuDe ?? 'Tập trung tự do'}<Icon name="chevron-right" size={15} /></button></label><label>Bắt đầu<input name="start" required type="datetime-local" defaultValue={start} /></label><label>Kết thúc<input name="end" required type="datetime-local" defaultValue={end} /></label><div className="focus-form-row"><label>Chế độ<select name="mode" defaultValue="Stopwatch"><option value="Stopwatch">Đếm lên</option><option value="Pomodoro">Pomodoro</option></select></label><label>Một Pomodoro (phút)<input name="target" type="number" required min="1" max="180" defaultValue="25" /></label></div><label>Ghi chú<textarea name="note" maxLength={2000} placeholder="Bạn đã làm được gì?" /></label></fieldset><footer><button type="button" disabled={busy} onClick={close}>Đóng</button><button type="submit" className="focus-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu bản ghi'}</button></footer></form></Dialog>{picker && <TaskPicker token={token} recent={recent} zone={zone} close={() => setPicker(false)} pick={value => { setTask(value); setPicker(false) }} />}</>
}
function RecordDetail({ record, error, busy, zone, close, save, openTask, editTime }: {
  record: FocusRecord; error: string; busy: boolean; zone: string; close: () => void
  save: (text: string) => void; openTask: (id: number) => void; editTime: () => void
}) {
  const [note, setNote] = useState(record.ghiChu ?? '')
  return <Dialog title="Chi tiết lần tập trung" busy={busy} close={() => { if (!busy) close() }}><h3>{record.maNhiemVu != null ? <button type="button" className="focus-record-task-name" onClick={() => openTask(record.maNhiemVu!)}><Icon name="book" size={16} />{record.tieuDe}</button> : record.tieuDe}</h3>{error && <p role="alert" className="focus-error">{error}</p>}<p>{hienGio(record.batDau, zone)} → {hienGio(record.ketThuc, zone)}</p><p><strong>{durationText(record.soMiliGiayDaHoc)}</strong> · {record.cheDo === 'Pomodoro' ? 'Pomodoro' : 'Đếm lên'}{record.nhapThuCong ? ' · Nhập thủ công' : ''}</p><label>Ghi chú<textarea value={note} maxLength={2000} disabled={busy} onChange={e => setNote(e.target.value)} /></label><footer>{record.maNhiemVu != null && <button type="button" className="focus-link" disabled={busy} onClick={() => openTask(record.maNhiemVu!)}>Xem nhiệm vụ</button>}<button type="button" disabled={busy} onClick={close}>Đóng</button><button type="button" disabled={busy} onClick={editTime}>Sửa thời gian</button><button type="button" className="focus-primary" disabled={busy} onClick={() => save(note)}>Lưu ghi chú</button></footer></Dialog>
}

function FocusTimeline({ current, records, now, zone }: { current: FocusRecord; records: FocusRecord[]; now: number; zone: string }) {
  const timeline = focusTimeline(records, current, now, zone)
  const position = (hour: number) => (hour - timeline.first) / (timeline.last - timeline.first) * 100
  return <section className="focus-timeline" aria-label="Dòng thời gian tập trung">
    <div className="focus-section-title"><h2>Dòng thời gian hôm nay</h2><Icon name="clock" size={16} /></div>
    <div className="focus-timeline-grid">
      {timeline.ticks.map(hour => <div className="focus-timeline-tick" key={hour} style={{ top: position(hour) + '%' }}><span>{timeline.label(hour)}</span></div>)}
      {timeline.blocks.map(({ row, start, end }) => <div key={row.ma} className={'focus-timeline-block' + (row.ma === current.ma ? ' current' : '') + (row.trangThai === 'Paused' ? ' paused' : '') + (position(end) - position(start) < 12 ? ' short' : '')}
        style={{ top: position(start) + '%', height: Math.max(3, position(end) - position(start)) + '%' }} title={`${row.tieuDe} · ${hienGio(row.batDau, zone)} → ${hienGio(row.ketThuc ?? new Date(now).toISOString(), zone)} · ${durationText(focusElapsed(row, now))} tập trung`}><span>{row.tieuDe}</span></div>)}
      <div className="focus-timeline-now" style={{ top: position(timeline.currentHour) + '%' }}><span /></div>
    </div>
  </section>
}
