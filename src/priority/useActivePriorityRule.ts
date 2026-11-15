import { useEffect, useRef, useState } from 'react'
import { loadActivePriorityRule } from '../api/priorityRules'
import type { PriorityRule } from './rules'

const cache = new WeakMap<() => string, { rule: PriorityRule; at: number }>()
export function useActivePriorityRule(session: () => string, enabled: boolean, revision: number) {
  const remembered = cache.get(session)
  const [rule, setRule] = useState<PriorityRule | undefined>(() => enabled && remembered && Date.now() - remembered.at < 300000 ? remembered.rule : undefined)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const generation = useRef(0)
  useEffect(() => {
    const current = ++generation.current
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      if (!enabled) { setRule(undefined); setLoading(false); return }
      setLoading(true); setError('')
      const next = await loadActivePriorityRule(session(), controller.signal)
      if (controller.signal.aborted || current !== generation.current) return
      setRule(next); cache.set(session, { rule: next, at: Date.now() })
    }).catch(error => {
      if (!controller.signal.aborted && current === generation.current) setError(error instanceof Error ? error.message : 'Chưa tải được quy tắc ưu tiên.')
    }).finally(() => { if (current === generation.current) setLoading(false) })
    return () => { generation.current = current + 1; controller.abort() }
  }, [session, enabled, revision, tick])
  useEffect(() => {
    if (!enabled) return
    const refresh = () => { if (!document.hidden) setTick(value => value + 1) }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled])
  return { rule, loading, error }
}
