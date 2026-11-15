import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useMockApi } from '../api/config'
import { loadPlanningReminders, readAllPlanningReminders, readPlanningReminder } from '../api/planningReminders'
import type { PlanningReminder, PlanningReminderInbox } from '../api/planningReminders'

export function usePlanningReminders(unreadOnly: boolean) {
  const auth = useAuth()
  const enabled = auth.status === 'authenticated' && !auth.isDemo && !useMockApi
  const session = auth.getAccessToken
  const [inbox, setInbox] = useState<PlanningReminderInbox | null>(null)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(enabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const lifetime = useRef(0)
  const refresh = () => setRevision(value => value + 1)
  // Bỏ phản hồi đến muộn khi phiên đăng nhập đã đổi, tránh hiện nhắc của tài khoản trước.
  useEffect(() => { lifetime.current++; setInbox(null); return () => { lifetime.current++ } }, [session])
  useEffect(() => { setPage(1) }, [unreadOnly])
  useEffect(() => {
    const controller = new AbortController()
    const active = lifetime.current
    if (!enabled) { setLoading(false); return }
    setLoading(true); setError('')
    loadPlanningReminders(session(), unreadOnly, page, controller.signal)
      .then(list => {
        if (controller.signal.aborted || active !== lifetime.current || busy.current) return
        if (page > 1 && !list.danhSach.length) { setPage(1); return }
        setInbox(list)
      }).catch(e => { if (!controller.signal.aborted && active === lifetime.current) setError(e instanceof Error ? e.message : 'Chưa tải được nhắc kế hoạch.') })
      .finally(() => { if (!controller.signal.aborted && active === lifetime.current) setLoading(false) })
    return () => controller.abort()
  }, [enabled, session, unreadOnly, page, revision])
  useEffect(() => {
    if (!enabled) return
    const sync = () => { if (!document.hidden && !busy.current) refresh() }
    const timer = window.setInterval(sync, 60000)
    window.addEventListener('focus', sync); window.addEventListener('studyplanner:saved', sync); window.addEventListener('studyplanner:refresh', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(timer); window.removeEventListener('focus', sync); window.removeEventListener('studyplanner:saved', sync)
      window.removeEventListener('studyplanner:refresh', sync); document.removeEventListener('visibilitychange', sync)
    }
  }, [enabled])
  async function run(operation: () => Promise<unknown>) {
    if (!enabled || busy.current) return false
    const active = lifetime.current
    busy.current = true; setSaving(true); setError('')
    try {
      await operation()
      if (active !== lifetime.current) return false
      return true
    } catch (e) { if (active === lifetime.current) setError(e instanceof Error ? e.message : 'Chưa lưu được nhắc kế hoạch.'); return false }
    finally { busy.current = false; if (active === lifetime.current) { setSaving(false); refresh() } }
  }
  const mark = (item?: PlanningReminder) => item?.ngayDoc ? Promise.resolve(true) : run(() => item
    ? readPlanningReminder(session(), item) : inbox ? readAllPlanningReminders(session(), inbox.docDenLuc) : Promise.resolve())
  return { inbox, enabled, page, loading, saving, error, refresh, setPage, mark }
}
