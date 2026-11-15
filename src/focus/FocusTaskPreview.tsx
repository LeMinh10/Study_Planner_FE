import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { usePlanner } from '../contexts/PlannerContext'
import { goi } from '../hoc-tap/api'
import { ChiTietNhiemVu } from '../hoc-tap/NhiemVuView'
import { NhiemVuProvider, useNhiemVu } from '../hoc-tap/NhiemVuContext'
import type { NhiemVuActions } from '../hoc-tap/NhiemVuContext'
import { durationText } from './focus'
import type { FocusTotals } from './focus-statistics'

export function FocusTaskPreview({ id, token, zone, close }: { id: number; token: string; zone: string; close: () => void }) {
  const { data } = usePlanner()
  const navigate = useNavigate()
  const [revision, setRevision] = useState(0)
  const [dialogs, setDialogs] = useState<{ key: number; content: ReactNode }[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener('studyplanner:focus-changed', refresh)
    return () => window.removeEventListener('studyplanner:focus-changed', refresh)
  }, [])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 5000)
    return () => clearTimeout(timer)
  }, [message])
  function reload() {
    setRevision(value => value + 1)
    // Lưu nhiệm vụ cũng đổi phiên bản lập lịch; đồng hồ cần tải lại trước thao tác tiếp theo.
    window.dispatchEvent(new Event('studyplanner:refresh'))
  }
  function closeDialog() {
    if (dialogs.length) setDialogs(value => value.slice(0, -1))
    else close()
  }
  const actions: NhiemVuActions = {
    token, zone, zoneReady: true, revision, semesters: data.semesters, subjects: data.subjects,
    hocKy: '', monHoc: '', tienDoXemTruoc: null,
    chonNhiemVu: ma => { if (ma == null) closeDialog(); else setDialogs(value => [...value, { key: Date.now(), content: <ChiTietNhiemVu ma={ma} addon={<FocusTaskSummary id={ma} />} /> }]) },
    hienNhiemVuMoi: () => { reload() },
    xemPhienNhiemVu: task => navigate('/tasks?' + new URLSearchParams({ tab: 'sessions', ...(task ? { task: String(task.ma) } : {}) })),
    reload, close: closeDialog,
    modal: content => setDialogs(value => [...value, { key: Date.now(), content }]),
    run: async operation => {
      setError('')
      try { if (await operation() !== null) reload() }
      catch (e) { setError(e instanceof Error ? e.message : 'Chưa lưu được thay đổi.') }
    },
    thongBaoThanhCong: text => setMessage(text),
  }
  return <NhiemVuProvider value={actions}>
    <ChiTietNhiemVu ma={id} addon={<><FocusTaskSummary id={id} />
      {message && <p className="focus-task-saved" role="status">{message}</p>}
      {error && <p className="ht-error" role="alert">{error}</p>}</>} />
    {dialogs.map(dialog => <Fragment key={dialog.key}>{dialog.content}</Fragment>)}
  </NhiemVuProvider>
}

function FocusTaskSummary({ id }: { id: number }) {
  const { token, revision } = useNhiemVu()
  const [summary, setSummary] = useState<FocusTotals | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); setError(''); setSummary(null)
    goi<FocusTotals>(token, `/focus/tasks/${id}/summary`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setSummary(result.duLieu) })
      .catch(e => { if (!controller.signal.aborted) setError(e.status === 404 ? 'Nhiệm vụ đã bị xóa hoặc không còn trong danh sách của bạn.' : e.message) })
    return () => controller.abort()
  }, [id, token, revision, retry])
  if (error) return <p className="ht-error" role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></p>
  if (!summary) return <p className="focus-task-saved" role="status">Đang tải thời gian tập trung…</p>
  return <div className="focus-task-summary"><Icon name="clock" size={16} /><span>Tổng thời gian <strong>{durationText(summary.tongMiliGiay)}</strong></span><span>{summary.soPhien} phiên · {summary.soPomodoro} Pomodoro · Toàn bộ lịch sử</span></div>
}
