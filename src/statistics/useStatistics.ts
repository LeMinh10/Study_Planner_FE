import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useMockApi } from '../api/config'
import { loadStatistics } from './statisticsApi'
import type { StatisticsSnapshot } from './statisticsApi'

const cache = new WeakMap<() => string, Map<string, { snapshot: StatisticsSnapshot; at: number }>>()
export function useStatistics(semesterId: string) {
  const auth = useAuth()
  const session = auth.getAccessToken
  const enabled = auth.status === 'authenticated' && !auth.isDemo && !useMockApi && !!semesterId
  const [snapshot, setSnapshot] = useState<StatisticsSnapshot | undefined>(() => {
    const entry = enabled ? cache.get(session)?.get(semesterId) : undefined
    return entry && Date.now() - entry.at < 60000 ? entry.snapshot : undefined
  })
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const lastRead = useRef(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      setLoading(true); setError('')
      lastRead.current = Date.now()
      const result = await loadStatistics(session(), semesterId, controller.signal)
      if (controller.signal.aborted) return
      const entries = cache.get(session) ?? new Map()
      entries.set(semesterId, { snapshot: result, at: Date.now() }); cache.set(session, entries)
      setSnapshot(result)
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Chưa tải được tiến độ học tập.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [enabled, session, semesterId, revision])
  useEffect(() => {
    if (!enabled) return
    const refresh = () => setRevision(value => value + 1)
    const focus = () => { if (document.visibilityState === 'visible' && Date.now() - lastRead.current > 30000) refresh() }
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', focus)
    window.addEventListener('studyplanner:saved', refresh)
    window.addEventListener('studyplanner:refresh', refresh)
    return () => {
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', focus)
      window.removeEventListener('studyplanner:saved', refresh)
      window.removeEventListener('studyplanner:refresh', refresh)
    }
  }, [enabled])
  return { snapshot, loading, error, enabled, reload: () => setRevision(value => value + 1) }
}
