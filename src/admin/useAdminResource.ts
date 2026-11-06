import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function useAdminResource<T>(load: (token: string, signal: AbortSignal) => Promise<T>) {
  const { getAccessToken } = useAuth()
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ load: typeof load; getAccessToken: typeof getAccessToken; revision: number; data: T | null; error: Error | null } | null>(null)
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  const current = state?.load === load && state.getAccessToken === getAccessToken && state.revision === revision ? state : null

  useEffect(() => {
    const controller = new AbortController()
    async function fetchData() {
      try {
        const data = await load(getAccessToken(), controller.signal)
        if (!controller.signal.aborted) setState({ load, getAccessToken, revision, data, error: null })
      } catch (error) {
        if (!controller.signal.aborted) setState({ load, getAccessToken, revision, data: null, error: error instanceof Error ? error : new Error('Không tải được dữ liệu. Vui lòng thử lại.') })
      }
    }
    void fetchData()
    return () => controller.abort()
  }, [load, getAccessToken, revision])

  return { data: current?.data ?? null, loading: current === null, error: current?.error ?? null, reload }
}
