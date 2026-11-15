import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../contexts/AuthContext'
import { useMockApi } from '../api/config'
import { goi } from '../hoc-tap/api'
import { clockText, focusElapsed } from './focus'
import type { FocusState } from './focus'
import './focus.css'

export function FocusDock() {
  const auth = useAuth(), location = useLocation()
  const token = auth.status === 'authenticated' && !auth.isDemo && !useMockApi ? auth.getAccessToken() : ''
  const [snapshot, setSnapshot] = useState<{ token: string; data: FocusState; received: number } | null>(null)
  const [now, setNow] = useState(Date.now)
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token || location.pathname === '/focus') return
    try {
      const r = await goi<FocusState>(token, '/focus/state?trang=1', { signal })
      if (!signal?.aborted) setSnapshot({ token, data: r.duLieu, received: Date.now() })
    } catch { /* Trang đồng hồ có nút thử lại; lỗi tải đồng hồ thu gọn không được chặn các trang khác. */ }
  }, [token, location.pathname])
  useEffect(() => {
    const controller = new AbortController(); void load(controller.signal)
    const refresh = () => { void load() }
    const timer = setInterval(refresh, 30000)
    window.addEventListener('studyplanner:focus-changed', refresh); window.addEventListener('focus', refresh)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('studyplanner:focus-changed', refresh); window.removeEventListener('focus', refresh) }
  }, [load])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const record = snapshot?.token === token ? snapshot.data.hienTai : null
  if (location.pathname === '/focus') return null
  if (!record && snapshot?.token === token && snapshot.data.maPhienDangHocCu)
    return <Link to={'/focus?session=' + snapshot.data.maPhienDangHocCu} className="focus-dock"><Icon name="headphones" size={19} /><span><strong>Phiên tự học đang chạy</strong><small>Mở đồng hồ để tiếp tục</small></span><Icon name="arrow-right" size={17} /></Link>
  if (!record) return null
  const elapsed = focusElapsed(record, now + Date.parse(snapshot!.data.thoiDiemMayChu) - snapshot!.received) / 1000
  return <Link to="/focus" className="focus-dock" aria-label="Quay lại đồng hồ tập trung"><span className={'focus-dock-dot' + (record.trangThai === 'Paused' ? ' paused' : '')}><Icon name={record.trangThai === 'Paused' ? 'pause' : 'play'} size={16} /></span><span><strong>{record.tieuDe}</strong><small>{record.trangThai === 'Paused' ? 'Đã tạm dừng' : 'Đang tập trung'} · {clockText(record.cheDo === 'Pomodoro' ? Math.max(0, record.mucTieuGiay - elapsed) : elapsed)}</small></span><Icon name="arrow-right" size={17} /></Link>
}
