import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePlanner } from '../../contexts/PlannerContext'
import { useMockApi } from '../../api/config'
import type { NhiemVu } from '../../hoc-tap/types'
import { ngay } from '../../hoc-tap/time'
import { loadTodayCalendar, loadTodayTasks } from './todayApi'
import type { TodayCalendar } from './todayModel'
import { cacheTodayCalendar, cacheTodayTasks, readTodayCache } from './todayCache'

export function useToday() {
  const auth = useAuth()
  const planner = usePlanner()
  const session = auth.getAccessToken
  const enabled = auth.status === 'authenticated' && !auth.isDemo && !useMockApi
  const initial = useRef(enabled ? readTodayCache(session) : undefined)
  const [tasks, setTasks] = useState<NhiemVu[] | undefined>(initial.current?.tasks)
  const [calendar, setCalendar] = useState<TodayCalendar | undefined>(initial.current?.calendar)
  const [taskError, setTaskError] = useState('')
  const [calendarError, setCalendarError] = useState('')
  const [taskLoading, setTaskLoading] = useState(enabled)
  const [calendarLoading, setCalendarLoading] = useState(enabled)
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const lastRead = useRef(0)
  const zone = calendar?.muiGio ?? 'Asia/Ho_Chi_Minh'
  const day = ngay(planner.now, zone)

  useEffect(() => {
    const current = ++generation.current
    const controller = new AbortController()
    if (!enabled) { setTasks(undefined); setCalendar(undefined); setTaskLoading(false); setCalendarLoading(false); return }
    setTaskError(''); setCalendarError(''); setTaskLoading(true); setCalendarLoading(true)
    // The first cancelled StrictMode effect never starts network requests.
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      const token = session()
      lastRead.current = Date.now()
      await Promise.allSettled([
        loadTodayTasks(token, controller.signal).then((value) => {
          if (controller.signal.aborted || current !== generation.current) return
          setTasks(value); cacheTodayTasks(session, value)
        }).catch((error) => { if (!controller.signal.aborted && current === generation.current) setTaskError(error instanceof Error ? error.message : 'Chưa tải được nhiệm vụ.') })
          .finally(() => { if (current === generation.current) setTaskLoading(false) }),
        loadTodayCalendar(token, Date.now(), controller.signal).then((value) => {
          if (controller.signal.aborted || current !== generation.current) return
          setCalendar(value); cacheTodayCalendar(session, value)
        }).catch((error) => { if (!controller.signal.aborted && current === generation.current) setCalendarError(error instanceof Error ? error.message : 'Chưa tải được lịch học.') })
          .finally(() => { if (current === generation.current) setCalendarLoading(false) }),
      ])
    }).catch((error) => {
      if (controller.signal.aborted || current !== generation.current) return
      setTaskError(error instanceof Error ? error.message : 'Phiên đăng nhập chưa sẵn sàng.'); setTaskLoading(false); setCalendarLoading(false)
    })
    return () => { generation.current++; controller.abort() }
  }, [enabled, session, day, revision])

  useEffect(() => {
    if (!enabled) return
    function refresh() { setRevision((value) => value + 1) }
    function focus() { if (Date.now() - lastRead.current > 30000) refresh() }
    window.addEventListener('focus', focus)
    window.addEventListener('studyplanner:saved', refresh)
    window.addEventListener('studyplanner:refresh', refresh)
    return () => {
      window.removeEventListener('focus', focus)
      window.removeEventListener('studyplanner:saved', refresh)
      window.removeEventListener('studyplanner:refresh', refresh)
    }
  }, [enabled])

  return { enabled, tasks, calendar, zone, now: planner.now, academic: planner.data, academicLoading: planner.academicLoading,
    taskError, calendarError, taskLoading, calendarLoading, reload: () => setRevision((value) => value + 1) }
}
