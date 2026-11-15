import { getCurrentUser } from '../api/auth'
import { ApiError, invalidateSession, isAccountDisabled, readApiResponse } from '../api/client'
import { apiBaseUrl, useMockApi } from '../api/config'

// Read incrementally: an SSE event can span any number of network chunks.
export async function readSessionEvents(body: ReadableStream<Uint8Array>, signal: AbortSignal, onInvalid: (code: string) => void, onActivity: () => void = () => undefined) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let line = '', event = ''
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) cancel()
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) return
      onActivity()
      for (const character of decoder.decode(value, { stream: true })) {
        if (character === '\r') continue
        if (character !== '\n') {
          line += character
          if (line.length > 4096) throw new Error('Invalid session event')
          continue
        }
        if (!line) {
          if (event === 'account-disabled' || event === 'session-invalid') {
            if (!signal.aborted) onInvalid(event === 'account-disabled' ? 'ACCOUNT_DISABLED' : 'INVALID_TOKEN')
            return
          }
          event = ''
        } else if (line.startsWith('event:')) event = line.slice(6).trim()
        line = ''
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

export function watchSession(token: string) {
  const controller = new AbortController()
  const { signal } = controller
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let checking = false
  async function check() {
    if (checking || signal.aborted || stopped) return
    checking = true
    try { await getCurrentUser(token, AbortSignal.any([signal, AbortSignal.timeout(10000)])) }
    catch (error) {
      if (!signal.aborted && error instanceof ApiError && (error.status === 401 || isAccountDisabled(error.code))) {
        stopped = true
        invalidateSession(token, error.code)
      }
    } finally { checking = false }
  }
  const onFocus = () => { if (document.visibilityState === 'visible') void check() }
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onFocus)
  if (useMockApi) window.addEventListener('storage', onFocus)

  async function connect() {
    if (signal.aborted || stopped) return
    let watchdog: ReturnType<typeof setTimeout> | undefined
    const connection = new AbortController()
    const connectionSignal = AbortSignal.any([signal, connection.signal])
    const touch = () => { clearTimeout(watchdog); watchdog = setTimeout(() => connection.abort(), 35000) }
    try {
      if (useMockApi) await check()
      else {
        touch()
        const response = await fetch(apiBaseUrl + '/users/me/session-events', {
          headers: { Accept: 'text/event-stream', Authorization: 'Bearer ' + token }, signal: connectionSignal, cache: 'no-store',
        })
        if (!response.ok) await readApiResponse(response, token)
        if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Session stream unavailable')
        await readSessionEvents(response.body, connectionSignal, (code) => {
          stopped = true
          if (!signal.aborted) invalidateSession(token, code)
        }, touch)
      }
    } catch (error) {
      // A dropped stream or offline network must never sign the user out.
      if (error instanceof ApiError && (error.status === 401 || isAccountDisabled(error.code))) stopped = true
      else if (!signal.aborted) await check()
    } finally {
      clearTimeout(watchdog)
      connection.abort()
    }
    if (!signal.aborted && !stopped) timer = setTimeout(() => void connect(), 5000)
  }
  void connect()
  return () => {
    controller.abort()
    clearTimeout(timer)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onFocus)
    if (useMockApi) window.removeEventListener('storage', onFocus)
  }
}
