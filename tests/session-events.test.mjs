import assert from 'node:assert/strict'
import { test, before, after, afterEach } from 'node:test'
import { createServer } from 'vite'

let vite, sessions
const fetchOriginal = globalThis.fetch
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', envDir: false })
  sessions = await vite.ssrLoadModule('/src/auth/sessionEvents.ts')
})
after(async () => { await vite.close() })
afterEach(() => { globalThis.fetch = fetchOriginal; delete globalThis.window; delete globalThis.document })
const encoder = new TextEncoder()
const stream = (chunks) => new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close() } })

test('session stream recognizes split events, CRLF, heartbeats and ignores unknown events', async () => {
  const codes = []
  await sessions.readSessionEvents(stream([': heartbeat\r\n\r\nevent: unknown\ndata: {}\n\neve', 'nt: account-dis', 'abled\r\ndata: {}\r\n', '\r\n']), new AbortController().signal, code => codes.push(code))
  assert.deepEqual(codes, ['ACCOUNT_DISABLED'])
})
test('incomplete events never log out; expiry uses a different reason', async () => {
  const codes = []
  await sessions.readSessionEvents(stream(['event: account-disabled\n']), new AbortController().signal, code => codes.push(code))
  assert.deepEqual(codes, [])
  await sessions.readSessionEvents(stream(['event: session-invalid\ndata: {}\n\n']), new AbortController().signal, code => codes.push(code))
  assert.deepEqual(codes, ['INVALID_TOKEN'])
})
test('disposing a stream cancels the pending read without a stale logout', async () => {
  let enqueue, cancelled = false
  const body = new ReadableStream({ start(controller) { enqueue = controller }, cancel() { cancelled = true } })
  const controller = new AbortController(), codes = []
  const reading = sessions.readSessionEvents(body, controller.signal, code => codes.push(code))
  controller.abort()
  await reading
  assert(cancelled)
  assert.deepEqual(codes, [])
  assert.throws(() => enqueue.enqueue(encoder.encode('event: account-disabled\n\n')))
})
function browserEvents() {
  const window = new EventTarget(), document = new EventTarget(), received = []
  document.visibilityState = 'visible'
  window.addEventListener('studyplanner:session-invalid', event => received.push(event.detail))
  globalThis.window = window; globalThis.document = document
  return received
}
test('watcher authenticates by header and invalidates only its token on a pushed lock', async () => {
  const events = browserEvents(), calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(stream([': heartbeat\n\n', 'event: account-disabled\ndata: {}\n\n']), { headers: { 'Content-Type': 'text/event-stream' } })
  }
  const stop = sessions.watchSession('student-token')
  try {
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.deepEqual(events, [{ token: 'student-token', code: 'ACCOUNT_DISABLED' }])
    assert.equal(calls[0].url, '/api/v1/users/me/session-events')
    assert.equal(calls[0].options.headers.Authorization, 'Bearer student-token')
    assert.equal(calls.length, 1)
  } finally { stop() }
})
test('reconnect HTTP rejection preserves ACCOUNT_DISABLED instead of overwriting it', async () => {
  const events = browserEvents()
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'ACCOUNT_DISABLED' }), { status: 401 })
  const stop = sessions.watchSession('locked-token')
  try {
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.deepEqual(events, [{ token: 'locked-token', code: 'ACCOUNT_DISABLED' }])
  } finally { stop() }
})
test('network failure does not clear a session or announce a locked account', async () => {
  const events = browserEvents()
  globalThis.fetch = async () => { throw new TypeError('offline') }
  const stop = sessions.watchSession('offline-token')
  try {
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.deepEqual(events, [])
  } finally { stop() }
})
