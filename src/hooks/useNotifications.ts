import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useMockApi } from '../api/config'
import { loadNotifications, readAllNotifications, readNotification } from '../api/notifications'
import type { NotificationInbox, NotificationItem } from '../api/notifications'

// Academic/notification records stay in memory; read markers live on the server.
const cache = new WeakMap<() => string, NotificationInbox>()
export function useNotifications() {
  const auth = useAuth()
  const session = auth.getAccessToken
  const enabled = auth.status === 'authenticated' && !auth.isDemo && !useMockApi
  const [inbox, setInbox] = useState<NotificationInbox | undefined>(() => enabled ? cache.get(session) : undefined)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(enabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const generation = useRef(0)
  const mutation = useRef(0)
  const lifetime = useRef(0)
  const reload = () => setRevision(x => x + 1)
  useEffect(() => {
    const active = ++lifetime.current
    return () => { lifetime.current = active + 1 }
  }, [session])
  useEffect(() => {
    const current = ++generation.current
    const controller = new AbortController()
    const write = mutation.current
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      if (!enabled) { setInbox(undefined); setLoading(false); return }
      setLoading(true); setError('')
      const value = await loadNotifications(session(), unreadOnly, page, controller.signal)
      if (controller.signal.aborted || current !== generation.current || write !== mutation.current || busy.current) return
      if (page > 1 && !value.danhSach.length) { setPage(1); return }
      setInbox(value)
      if (!unreadOnly && page === 1) cache.set(session, value)
    }).catch(error => {
      if (!controller.signal.aborted && current === generation.current) setError(error instanceof Error ? error.message : 'Chưa tải được thông báo.')
    }).finally(() => { if (current === generation.current) setLoading(false) })
    return () => { generation.current = current + 1; controller.abort() }
  }, [enabled, session, unreadOnly, page, revision])

  useEffect(() => {
    if (!enabled) return
    const refresh = () => { if (!document.hidden) setRevision(x => x + 1) }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    window.addEventListener('studyplanner:saved', refresh)
    window.addEventListener('studyplanner:refresh', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('studyplanner:saved', refresh)
      window.removeEventListener('studyplanner:refresh', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled])

  async function mark(item?: NotificationItem) {
    if (!enabled || busy.current || !inbox) return false
    if (item?.ngayDoc) return true
    const active = lifetime.current
    busy.current = true; mutation.current++; setSaving(true); setError('')
    try {
      if (item) await readNotification(session(), item)
      else await readAllNotifications(session(), inbox.docDenLuc)
      cache.delete(session)
      if (active !== lifetime.current) return false
      const value = await loadNotifications(session(), unreadOnly, page)
      if (active !== lifetime.current) return false
      setInbox(value)
      if (!unreadOnly && page === 1) cache.set(session, value)
      return true
    } catch (error) { if (active === lifetime.current) setError(error instanceof Error ? error.message : 'Chưa đánh dấu được thông báo.'); return false }
    finally { busy.current = false; if (active === lifetime.current) { setSaving(false); reload() } }
  }
  return { inbox, enabled, loading, saving, error, unreadOnly, page, reload, mark,
    filter: (value: boolean) => { setInbox(undefined); setUnreadOnly(value); setPage(1); reload() },
    turnPage: (value: number) => { setInbox(undefined); setPage(value) } }
}
