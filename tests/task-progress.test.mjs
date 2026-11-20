import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const api = await server.ssrLoadModule('/src/hoc-tap/api.ts')
const originalFetch = globalThis.fetch
after(() => server.close())
afterEach(() => { globalThis.fetch = originalFetch })
function replies(...values) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined })
    const value = values.shift()
    assert(value, 'Unexpected request')
    return new Response(JSON.stringify(value.body), { status: value.status ?? 200 })
  }
  return calls
}
const result = (duLieu, phienBan = 7) => ({ body: { phienBan, duLieu } })
const preview = { path: '/tasks/1/change-preview', body: { thaoTac: 'children', noiDung: { danhSach: [{ tieuDe: 'Mới' }] } } }

test('cancelling a completed-task reopen never writes children', async () => {
  const calls = replies(result({ maNhiemVuMoLai: [1, 2] }))
  const prompts = []
  assert.equal(await api.thayDoi('jwt', '/tasks/1/children', 'POST', { danhSach: [] }, 7, preview, async options => { prompts.push(options); return false }), null)
  assert.equal(calls.length, 1)
  assert.match(prompts[0].noiDung, /mở lại 2 nhiệm vụ/)
})

test('checklist conversion is explicit and keeps the captured revision', async () => {
  const calls = replies(result({ maChecklistChuyenThanhBuoc: [1] }), result([{ ma: 8 }], 8))
  const prompts = []
  await api.thayDoi('jwt', '/tasks/1/children', 'POST', { danhSach: [{ tieuDe: 'Mới' }] }, 7, preview, async options => { prompts.push(options); return true })
  assert.equal(prompts.length, 1)
  assert.match(prompts[0].noiDung, /Công việc chung/)
  assert.equal(calls[1].body.xacNhanDoiCauTruc, true)
  assert.equal(calls[1].headers['If-Match'], '"ht-7"')
  assert.equal(calls[1].body.danhSach[0].tieuDe, 'Mới')
})

test('manual progress preservation and schedule cancellation use one combined confirmation', async () => {
  const calls = replies(result({ maNhiemVuMoLai: [1], maTienDoChuyenThanhBuoc: [1], maPhienBiHuy: [9], phienBiAnhHuong: [9, 10] }), result([{ ma: 8 }], 8))
  const prompts = []
  await api.thayDoi('jwt', '/tasks/1/children', 'POST', { danhSach: [] }, 7, preview, async options => { prompts.push(options); return true })
  assert.equal(prompts.length, 1)
  assert.match(prompts[0].noiDung, /Nhiệm vụ đã bắt đầu/)
  assert.match(prompts[0].noiDung, /hủy 2 phiên/)
  assert.equal(calls[1].body.xacNhanDoiCauTruc, true)
  assert.equal(calls[1].body.huyPhienLienQuan, true)
})

test('an older form cannot confirm structure changes using a new revision', async () => {
  const calls = replies(result({ maNhiemVuMoLai: [1] }, 8))
  let prompted = false
  await assert.rejects(api.thayDoi('jwt', '/tasks/1/children', 'POST', { danhSach: [] }, 7, preview, async () => { prompted = true; return true }), /Dữ liệu đã đổi/)
  assert.equal(calls.length, 1)
  assert.equal(prompted, false)
})

test('server structure confirmation can be cancelled without retrying a write', async () => {
  const calls = replies({ status: 409, body: { code: 'TASK_STRUCTURE_CONFIRMATION_REQUIRED', details: { anhHuong: { maNhiemVuMoLai: [1] } } } })
  assert.equal(await api.thayDoi('jwt', '/tasks/1/parent', 'PATCH', { maNhiemVuCha: 2 }, 7, undefined, async () => false), null)
  assert.equal(calls.length, 1)
})

test('confirmed server structure response sends the flag once without upgrading revision', async () => {
  const calls = replies({ status: 409, body: { code: 'TASK_STRUCTURE_CONFIRMATION_REQUIRED', details: { maChecklistChuyenThanhBuoc: [2] } } }, result({ ma: 1 }, 8))
  await api.thayDoi('jwt', '/tasks/1/parent', 'PATCH', { maNhiemVuCha: 2 }, 7, undefined, async () => true)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].body.xacNhanDoiCauTruc, true)
  assert.equal(calls[1].headers['If-Match'], '"ht-7"')
})
