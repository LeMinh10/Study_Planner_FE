import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../contexts/AuthContext'
import { useMockApi } from '../api/config'
import { goi } from '../hoc-tap/api'
import { gioNhap, hienGio, ngay, thoiDiemGui } from '../hoc-tap/time'
import type { NhiemVu, Trang } from '../hoc-tap/types'
import { clockText, durationText, focusElapsed, focusTimeline, isPersonal } from './focus'
import type { FocusRecord, FocusState } from './focus'
import { FocusDialog as Dialog } from './FocusDialog'
import { FocusTaskPreview } from './FocusTaskPreview'
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
function TaskPicker({ token, recent, pick, close }: { token: string; recent: FocusRecord[]; pick: (task: NhiemVu | null) => void; close: () => void }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<NhiemVu[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
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
      const params = new URLSearchParams({ cheDo: 'all', chiLa: 'true', trang: String(page), kichThuocTrang: '100', tuKhoa: query })
      goi<Trang<NhiemVu>>(token, '/tasks?' + params, { signal: controller.signal }).then(result => {
        if (controller.signal.aborted) return
        setRows(previous => page === 1 ? result.duLieu.danhSach : [...previous, ...result.duLieu.danhSach])
        setMore(page * 100 < result.duLieu.tongSo)
      }).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, page, token, tab, recent, retry])
  const recentIds = new Set(recent.map(row => row.maNhiemVu))
  const choices = [...new Map(rows.map(row => [row.ma, row])).values()].filter(task => !task.coNhiemVuCon && task.tienDo < 100 &&
    (tab !== 'recent' || recentIds.has(task.ma)) && task.tieuDe.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')) &&
    (scope === 'all' || (scope === 'personal') === isPersonal(task)))
  return <Dialog title="Chọn nhiệm vụ tập trung" close={close}>
    <div className="focus-picker-tabs"><button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>Tất cả</button><button type="button" aria-pressed={tab === 'recent'} onClick={() => setTab('recent')}>Gần đây</button></div>
    <label className="focus-search"><Icon name="search" size={17} /><input autoFocus type="search" placeholder="Tìm tên nhiệm vụ…" aria-label="Tìm nhiệm vụ tập trung" value={query} onChange={e => { setQuery(e.target.value); setPage(1); setRows([]) }} /></label>
    <select aria-label="Phạm vi nhiệm vụ tập trung" value={scope} onChange={e => setScope(e.target.value)}><option value="all">Học tập và cá nhân</option><option value="academic">Học tập</option><option value="personal">Việc cá nhân</option></select>
    <button type="button" className="focus-task-option" onClick={() => pick(null)}><span className="focus-task-dot" /><span>Tập trung tự do<small>Không gắn nhiệm vụ</small></span></button>
    <div className="focus-task-options">{choices.map(task => <button type="button" className="focus-task-option" key={task.ma} onClick={() => pick(task)}><span className="focus-task-dot" /><span>{task.tieuDe}<small>{isPersonal(task) ? 'Việc cá nhân' : 'Học tập'} · {task.tienDo}%</small></span></button>)}
      {!loading && !error && !choices.length && <p className="focus-empty">Không có nhiệm vụ phù hợp trong danh sách đã tải.</p>}
      {loading && <p role="status" className="focus-empty">Đang tải nhiệm vụ…</p>}
      {error && <p role="alert" className="focus-error">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></p>}
      {more && <button type="button" disabled={loading} onClick={() => setPage(value => value + 1)}>Tải thêm nhiệm vụ</button>}
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
  const [note, setNote] = useState('')
  const [finished, setFinished] = useState<FocusRecord | null>(null)
  const [now, setNow] = useState(Date.now)
  const [restEnd, setRestEnd] = useState<number | null>(() => {
    try { const value = Number(localStorage.getItem(preferenceKey + ':rest')); return value > Date.now() ? value : null } catch { return null }
  })
  const requestNumber = useRef(0)
  const autoStart = useRef(false)
  const autoFinish = useRef<number | null>(null)
  const currentRef = useRef<FocusRecord | null>(null)
  const recentRecords = useRef<FocusRecord[]>([])
  const sound = useRef<AudioContext | null>(null)
  const soundEnabled = useRef(preferences.sound)
  const pageRef = useRef<HTMLElement>(null)
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
    setNotice('Đã hết giờ nghỉ. Bạn có thể bắt đầu phiên tiếp theo.'); beep()
  }, [restEnd, restSeconds, preferenceKey])
  const begin = useCallback(async (sessionId?: number) => {
    if (!snapshot || !studySettings.data || studySettings.loading || studySettings.error || busy) return
    setBusy(true); setError(''); setNotice(''); setFinished(null); setPage(1)
    try {
      const r = await goi<FocusRecord>(token, '/focus/start', { method: 'POST', version: snapshot.version, body: {
        maNhiemVu: sessionId ? null : selectedTask?.ma ?? null, maPhienTuHoc: sessionId ?? null,
        cheDo: sessionId ? 'Stopwatch' : mode, mucTieuGiay: preferences.minutes * 60,
      } })
      currentRef.current = r.duLieu; setNote(r.duLieu.ghiChu ?? '')
      await load(); window.dispatchEvent(new Event('studyplanner:focus-changed'))
      if (sessionId) setParams({}, { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa bắt đầu được phiên.'); await load().catch(() => {}) }
    finally { setBusy(false) }
  }, [snapshot, busy, token, selectedTask, mode, preferences.minutes, studySettings.data, studySettings.loading, studySettings.error, load, setParams])
  useEffect(() => {
    const sessionId = Number(params.get('session'))
    if (!data || !studySettings.data || studySettings.loading || studySettings.error || autoStart.current || !Number.isSafeInteger(sessionId) || sessionId <= 0) return
    autoStart.current = true
    if (current) {
      if (current.maPhienTuHoc !== sessionId) setNotice('Bạn đang có phiên tập trung khác. Kết thúc phiên hiện tại trước khi chuyển nhiệm vụ.')
      setParams({}, { replace: true })
      return
    }
    void begin(sessionId)
  }, [data, current, params, begin])
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
      if (name === 'discard') { setFinished(null); setNotice('Đã bỏ phiên. Thời gian của phiên này không được cộng vào thống kê.') }
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
  const controlsDisabled = busy || !data || !token || !studySettings.data || studySettings.loading || !!studySettings.error
  function startBreak() {
    const end = Date.now() + preferences.rest * 60000
    setFinished(null); setRestEnd(end); enableSound()
    try { localStorage.setItem(preferenceKey + ':rest', String(end)) } catch { /* Không chặn thao tác nếu trình duyệt không lưu được giờ nghỉ. */ }
  }
  return <section className={'focus-page' + (restEnd ? ' focus-resting' : '')} ref={pageRef}>
    <div className="focus-main">
      <header className="focus-header"><div><span className="focus-eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Tập trung</h1></div>
        <div className="focus-mode" role="group" aria-label="Chế độ đồng hồ"><button type="button" disabled={!!current || !!restEnd} aria-pressed={activeMode === 'Pomodoro'} onClick={() => { setMode('Pomodoro'); setFinished(null) }}>Pomodoro</button><button type="button" disabled={!!current || !!restEnd} aria-pressed={activeMode === 'Stopwatch'} onClick={() => { setMode('Stopwatch'); setFinished(null) }}>Đếm lên</button></div>
        <div className="focus-more" ref={moreRef}><button className="focus-icon" type="button" disabled={busy} aria-label="Tùy chọn đồng hồ" title="Tùy chọn đồng hồ" aria-expanded={menuOpen} aria-controls="focus-more-menu" onClick={() => setMenuOpen(value => !value)}><Icon name="dots" size={22} /></button>{menuOpen && <div id="focus-more-menu" className="focus-more-menu" role="group" aria-label="Các tùy chọn đồng hồ"><button type="button" onClick={() => { setMenuOpen(false); setModal('statistics') }}><Icon name="chart" size={16} />Thống kê</button><button type="button" onClick={() => { setMenuOpen(false); setModal('settings') }}><Icon name="clock" size={16} />Cài đặt đồng hồ</button></div>}</div>
      </header>
      {!token && <p className="focus-error" role="alert">Đăng nhập bằng tài khoản kết nối backend để lưu phiên tập trung.</p>}
      {error && <div role="alert" className="focus-error">{error}<button type="button" onClick={() => { setError(''); void load().catch(e => setError(e.message)) }}>Tải lại</button></div>}
      {notice && <p role="status" className="focus-notice">{notice}</p>}
      {studySettings.error && <p role="alert" className="focus-error">{studySettings.error}<button type="button" onClick={studySettings.refresh}>Tải lại cấu hình học</button></p>}
      <div className="focus-stage">
        <button type="button" className="focus-task-select" disabled={!!current || !!restEnd || controlsDisabled} onClick={() => setModal('task')}><Icon name={current?.maNhiemVu || selectedTask ? 'flag' : 'plus'} size={17} /><span>{current?.tieuDe ?? selectedTask?.tieuDe ?? 'Bạn sẽ tập trung vào việc gì?'}</span>{!current && <Icon name="chevron-right" size={15} />}</button>
        {current?.maPhienTuHoc && <span className="focus-plan-label"><Icon name="calendar" size={13} />Được mở từ phiên tự học</span>}
        <div className="focus-clock" aria-label={restEnd ? 'Đồng hồ nghỉ' : 'Đồng hồ tập trung'}>
          <svg viewBox="0 0 300 300" aria-hidden="true"><circle className="focus-ring-bg" cx="150" cy="150" r="138" /><circle className="focus-ring-progress" cx="150" cy="150" r="138" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(1, progress)) * 100} 100`} /></svg>
          <div className="focus-clock-face"><span>{restEnd ? 'NGHỈ NGƠI MỘT CHÚT' : current?.trangThai === 'Paused' ? 'ĐÃ TẠM DỪNG' : current ? activeMode === 'Pomodoro' ? 'ĐANG TẬP TRUNG' : 'ĐANG ĐẾM LÊN' : 'SẴN SÀNG KHI BẠN MUỐN'}</span><strong role="timer" aria-label={restEnd ? 'Thời gian nghỉ còn lại' : 'Thời gian tập trung'}>{clockText(clockSeconds)}</strong><small>{restEnd ? 'Thả lỏng và nạp lại năng lượng' : current ? `${durationText(elapsed)} đã tập trung` : activeMode === 'Pomodoro' ? `${preferences.minutes} phút cho điều quan trọng` : 'Từng phút tập trung đều có ý nghĩa'}</small></div>
        </div>
        <div className="focus-controls">
          {restEnd ? <button className="focus-primary" type="button" onClick={() => { setRestEnd(null); try { localStorage.removeItem(preferenceKey + ':rest') } catch { /* Không chặn thao tác nếu trình duyệt không lưu được giờ nghỉ. */ } }}>Bỏ qua giờ nghỉ</button>
            : !current ? <button className="focus-primary" type="button" disabled={controlsDisabled} onClick={() => { enableSound(); const linked = Number(params.get('session') ?? data?.maPhienDangHocCu ?? ''); void begin(Number.isSafeInteger(linked) && linked > 0 ? linked : undefined) }}><Icon name="play" size={18} />{busy ? 'Đang bắt đầu…' : data?.maPhienDangHocCu ? 'Tiếp tục phiên đang học' : 'Bắt đầu'}</button>
            : <><button className="focus-primary" type="button" disabled={busy} onClick={() => { enableSound(); void action(current.trangThai === 'Running' ? 'pause' : 'resume') }}><Icon name={current.trangThai === 'Running' ? 'pause' : 'play'} size={18} />{current.trangThai === 'Running' ? 'Tạm dừng' : 'Tiếp tục'}</button><button className="focus-secondary" type="button" disabled={busy} onClick={() => setModal('finish')}>Kết thúc</button></>}
        </div>
        {current ? <p className="focus-hint">Thời gian tạm dừng không được tính. Bạn có thể chuyển trang và quay lại đồng hồ.</p>
          : !restEnd && !finished && <p className="focus-hint">Một việc tại một thời điểm. Bắt đầu từ đây.</p>}
        {finished && !current && !restEnd && <div className="focus-completion" role="status"><span className="focus-complete-icon"><Icon name="check" size={20} /></span><h2>Đã lưu {durationText(finished.soMiliGiayDaHoc)} tập trung</h2><p>{finished.tieuDe}</p><div>{finished.maNhiemVu && <button type="button" onClick={() => setTaskPreview(finished.maNhiemVu)}>Cập nhật tiến độ nhiệm vụ<Icon name="arrow-right" size={14} /></button>}{finished.cheDo === 'Pomodoro' && <button type="button" onClick={startBreak}>Nghỉ {preferences.rest} phút</button>}</div><small>Thời gian học và kết quả công việc được ghi nhận riêng.</small></div>}
      </div>
      <footer className="focus-main-footer"><span><Icon name="headphones" size={15} />Tạo một khoảng yên tĩnh cho chính mình</span><button type="button" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void pageRef.current?.requestFullscreen().catch(() => setNotice('Trình duyệt chưa mở được toàn màn hình.')) }}>Toàn màn hình<Icon name="overview" size={14} /></button></footer>
    </div>
    <aside className="focus-insights" aria-label="Tổng quan tập trung">
      <header><h2>{current ? activeMode === "Pomodoro" ? "Pomodoro" : "Đếm lên" : "Tổng quan"}</h2><span className="focus-today-label">{new Intl.DateTimeFormat('vi-VN', { timeZone: zone, day: 'numeric', month: 'long' }).format(new Date(now))}</span></header>
      {!current && <><div className="focus-stats">{[
        ['Pomodoro hôm nay', String(data?.tongQuan.pomoHomNay ?? 0), 'sun'],
        ['Tập trung hôm nay', durationText(data?.tongQuan.miliGiayHomNay ?? 0), 'clock'],
        ['Tổng Pomodoro', String(data?.tongQuan.tongPomo ?? 0), 'leaf'],
        ['Tổng thời gian', durationText(data?.tongQuan.tongMiliGiay ?? 0), 'chart'],
      ].map(([label, value, icon]) => <div key={label}><span>{label}</span><strong>{value}</strong><Icon name={icon as 'sun' | 'clock' | 'leaf' | 'chart'} size={18} /></div>)}</div>
      <p className="focus-stat-caption">Hôm nay tính các phiên kết thúc trong ngày. Pomodoro đủ thời lượng mới được tính một lượt.</p></>}
      {current && <FocusTimeline current={current} records={data?.lichSu ?? []} now={serverNow} zone={zone} />}
      {current && <section className="focus-note-panel"><div className="focus-section-title"><h2>Ghi chú phiên</h2><Icon name="edit" size={16} /></div><label><span className="sr-only">Ghi chú phiên tập trung</span><textarea value={note} maxLength={2000} placeholder="Điều cần nhớ, ý tưởng vừa nảy ra…" onChange={e => setNote(e.target.value)} /></label><div><small>{note.length}/2.000</small><button type="button" disabled={busy || note.trim() === (current.ghiChu ?? '')} onClick={() => void action('note')}>Lưu ghi chú</button></div></section>}
      {!current && <section className="focus-history"><div className="focus-section-title"><h2>Lịch sử tập trung</h2><button type="button" className="focus-icon" title="Thêm bản ghi tập trung" aria-label="Thêm bản ghi tập trung" disabled={controlsDisabled} onClick={() => setModal('manual')}><Icon name="plus" size={20} /></button></div>
        {!data && !error && <p role="status" className="focus-empty">Đang tải phiên tập trung…</p>}
        {data && !data.lichSu.length && <div className="focus-history-empty"><Icon name="clock" size={29} /><strong>Khoảng tập trung đầu tiên của bạn</strong><p>Bắt đầu đồng hồ, lịch sử sẽ được lưu ở đây.</p></div>}
        {[...groups].map(([day, rows]) => <div className="focus-history-day" key={day}><h3>{day === ngay(now, zone) ? 'Hôm nay' : new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00Z'))}</h3>{rows.map(row => <article className="focus-record" key={row.ma}><button type="button" className="focus-record-open" aria-label={'Chi tiết lần tập trung: ' + row.tieuDe} onClick={() => setRecordDetail(row)}><span className="focus-record-icon"><Icon name={row.cheDo === 'Pomodoro' ? 'leaf' : 'clock'} size={15} /></span></button><div className="focus-record-body"><button type="button" className="focus-record-time" onClick={() => setRecordDetail(row)}>{time(row.batDau)} – {row.ketThuc ? time(row.ketThuc) : ''}{row.nhapThuCong ? ' · Nhập tay' : ''}</button><button type="button" className="focus-record-task" data-linked={row.maNhiemVu != null} onClick={() => { if (row.maNhiemVu != null) setTaskPreview(row.maNhiemVu); else setRecordDetail(row) }}>{row.tieuDe}</button>{row.ghiChu && <p>{row.ghiChu}</p>}</div><button type="button" className="focus-record-duration" onClick={() => setRecordDetail(row)}>{durationText(row.soMiliGiayDaHoc)}</button></article>)}</div>)}
        {data && data.tongSo > 20 && <div className="focus-pagination"><button type="button" disabled={page <= 1 || busy} onClick={() => setPage(value => value - 1)}>Trước</button><span>{page}/{Math.ceil(data.tongSo / 20)}</span><button type="button" disabled={page * 20 >= data.tongSo || busy} onClick={() => setPage(value => value + 1)}>Sau</button></div>}
      </section>}
    </aside>
    {modal === 'task' && <TaskPicker token={token} recent={recentRecords.current} close={() => setModal(null)} pick={task => { setSelectedTask(task); setModal(null); setFinished(null) }} />}
    {modal === 'settings' && <Dialog title="Cài đặt đồng hồ" close={() => setModal(null)}><StudySettingsForm token={token} sound={preferences.sound} close={() => setModal(null)} onSaved={() => setModal(null)} saveSound={sound => { const next = { ...localPreferences, sound }; setLocalPreferences(next); try { localStorage.setItem(preferenceKey, JSON.stringify({ sound })) } catch { /* Không chặn lưu cấu hình học nếu trình duyệt không lưu được tùy chọn âm báo. */ } }} /></Dialog>}
    {modal === 'finish' && current && <Dialog title="Kết thúc phiên tập trung?" busy={busy} close={() => { if (!busy) setModal(null) }}><p>Bạn đã tập trung <strong>{durationText(elapsed)}</strong> cho {current.tieuDe}.</p><p className="focus-hint">Lưu thời gian đã học rồi cập nhật tiến độ sau. Nếu bỏ phiên, thời gian này sẽ không được lưu vào lịch sử.</p>{error && <p role="alert" className="focus-error">{error}</p>}<footer><button type="button" disabled={busy} onClick={() => setModal(null)}>Quay lại</button><button type="button" className="focus-danger" disabled={busy} onClick={() => void action('discard')}>Bỏ phiên</button><button type="button" className="focus-primary" disabled={busy} onClick={() => void action('finish')}>Lưu và kết thúc</button></footer></Dialog>}
    {modal === 'manual' && snapshot && <ManualRecord token={token} version={snapshot.version} zone={zone} recent={recentRecords.current} close={() => setModal(null)} saved={async row => { setFinished(row); setModal(null); await load(); window.dispatchEvent(new Event('studyplanner:focus-changed')) }} />}
    {modal === 'statistics' && <FocusStatistics token={token} today={ngay(serverNow, zone)} close={() => setModal(null)} openTask={setTaskPreview} />}
    {recordDetail && <RecordDetail record={recordDetail} error={error} busy={busy} zone={zone} close={() => setRecordDetail(null)} save={text => void action('note', recordDetail, text)} openTask={setTaskPreview} />}
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
  }}><fieldset disabled={busy}>{error && <p className="focus-error" role="alert">{error}</p>}<label>Nhiệm vụ<button type="button" className="focus-form-task" onClick={() => setPicker(true)}>{task?.tieuDe ?? 'Tập trung tự do'}<Icon name="chevron-right" size={15} /></button></label><label>Bắt đầu<input name="start" required type="datetime-local" defaultValue={start} /></label><label>Kết thúc<input name="end" required type="datetime-local" defaultValue={end} /></label><div className="focus-form-row"><label>Chế độ<select name="mode" defaultValue="Stopwatch"><option value="Stopwatch">Đếm lên</option><option value="Pomodoro">Pomodoro</option></select></label><label>Một Pomodoro (phút)<input name="target" type="number" required min="1" max="180" defaultValue="25" /></label></div><label>Ghi chú<textarea name="note" maxLength={2000} placeholder="Bạn đã làm được gì?" /></label></fieldset><footer><button type="button" disabled={busy} onClick={close}>Đóng</button><button type="submit" className="focus-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu bản ghi'}</button></footer></form></Dialog>{picker && <TaskPicker token={token} recent={recent} close={() => setPicker(false)} pick={value => { setTask(value); setPicker(false) }} />}</>
}
function RecordDetail({ record, error, busy, zone, close, save, openTask }: { record: FocusRecord; error: string; busy: boolean; zone: string; close: () => void; save: (text: string) => void; openTask: (id: number) => void }) {
  const [note, setNote] = useState(record.ghiChu ?? '')
  return <Dialog title="Chi tiết lần tập trung" busy={busy} close={() => { if (!busy) close() }}><h3>{record.maNhiemVu != null ? <button type="button" className="focus-record-task-name" onClick={() => openTask(record.maNhiemVu!)}><Icon name="book" size={16} />{record.tieuDe}</button> : record.tieuDe}</h3>{error && <p role="alert" className="focus-error">{error}</p>}<p>{hienGio(record.batDau, zone)} → {hienGio(record.ketThuc, zone)}</p><p><strong>{durationText(record.soMiliGiayDaHoc)}</strong> · {record.cheDo === 'Pomodoro' ? 'Pomodoro' : 'Đếm lên'}{record.nhapThuCong ? ' · Nhập thủ công' : ''}</p><label>Ghi chú<textarea value={note} maxLength={2000} disabled={busy} onChange={e => setNote(e.target.value)} /></label><footer>{record.maNhiemVu != null && <button type="button" className="focus-link" disabled={busy} onClick={() => openTask(record.maNhiemVu!)}>Xem nhiệm vụ</button>}<button type="button" disabled={busy} onClick={close}>Đóng</button><button type="button" className="focus-primary" disabled={busy} onClick={() => save(note)}>Lưu ghi chú</button></footer></Dialog>
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
    <p>Các phiên gần đây trong ngày. Khối thể hiện khoảng phiên; số phút tập trung không tính tạm dừng.</p>
  </section>
}
