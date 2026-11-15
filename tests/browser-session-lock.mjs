import assert from 'node:assert/strict'

export function createSessionLockFixture() {
  const connections = new Set()
  const state = { locked: false, requests: 0 }
  return {
    state,
    get connected() { return connections.size },
    middleware(req, res, next) {
      if (req.url?.split('?')[0] !== '/api/v1/users/me/session-events') return next()
      assert(req.headers.authorization?.startsWith('Bearer '))
      assert(!req.url.includes('token='))
      state.requests++
      if (state.locked) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ code: 'ACCOUNT_DISABLED', title: 'Tài khoản của bạn đã bị khóa.' }))
      } else {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' })
        res.write(': heartbeat\n\n')
        connections.add(res)
        req.on('close', () => connections.delete(res))
      }
    },
    lock() {
      state.locked = true
      for (const response of connections) response.end('event: account-disabled\ndata: {}\n\n')
    },
    disconnect() { for (const response of connections) response.end() },
    close() { for (const response of connections) response.destroy(); connections.clear() },
  }
}

export async function runSessionLockChecks({ go, login, waitFor, evaluate, fixture, errors }) {
  await go('/login'); await waitFor('!!document.querySelector("input[name=taiKhoan]")')
  await login(); await waitFor('location.pathname === "/today"')
  for (let i = 0; !fixture.connected && i < 50; i++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(fixture.connected, 1, 'Student has a live SSE connection')
  const stored = await evaluate('sessionStorage.getItem("studyplanner.auth.v1")')
  const started = Date.now()
  fixture.lock()
  // No navigation, user action, focus event, F5 or ordinary API request is triggered here.
  await waitFor('location.pathname === "/login" && document.body.innerText.includes("Tài khoản của bạn đã bị khóa")')
  assert(Date.now() - started < 2000, 'Idle student is signed out immediately by the stream')
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)
  assert((await evaluate('document.querySelector(".auth-notice").textContent')).includes('liên hệ quản trị viên'))

  await evaluate('sessionStorage.setItem("studyplanner.auth.v1", ' + JSON.stringify(stored) + ')')
  await go('/today')
  await waitFor('location.pathname === "/login" && document.body.innerText.includes("Tài khoản của bạn đã bị khóa")')
  assert.equal(await evaluate('sessionStorage.getItem("studyplanner.auth.v1")'), null)

  fixture.state.locked = false
  await login(); await waitFor('location.pathname === "/today"')
  for (let i = 0; !fixture.connected && i < 50; i++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(fixture.connected, 1)
  const requests = fixture.state.requests
  fixture.disconnect()
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.equal(await evaluate('location.pathname'), '/today', 'Stream disconnect alone cannot sign out the student')
  for (let i = 0; fixture.state.requests <= requests && i < 70; i++) await new Promise(resolve => setTimeout(resolve, 100))
  assert(fixture.state.requests > requests && fixture.connected === 1, 'Stream reconnects automatically')
  fixture.lock()
  await waitFor('location.pathname === "/login" && document.body.innerText.includes("Tài khoản của bạn đã bị khóa")')
  assert.deepEqual(errors, [])
  console.log('PASS: idle student receives a real HTTP SSE lock and is redirected with a locked-account notice; stale restored credentials retain the reason; stream loss preserves the session and reconnects.')
}
