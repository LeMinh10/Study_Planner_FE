import assert from 'node:assert/strict'
import fs from 'node:fs'
export function createAccountEditorFixture(users) {
  const state = { fail: false }
  return { state, async handle(url, method, body, role) {
    if (!url.pathname.startsWith('/api/v1/admin/users') || !['POST', 'PUT'].includes(method)) return null
    if (role !== 'admin') return { status: 403, response: { detail: 'Không có quyền.' } }
    if (state.fail) return { status: 503, response: { detail: 'Chưa thể lưu tài khoản.' } }
    const rows = users(), id = Number(url.pathname.split('/').at(-1))
    if (rows.some(u => u.ma !== id && u.email === body.email)) return { status: 409, response: { detail: 'Email đã được sử dụng.' } }
    const old = rows.find(u => u.ma === id)
    if (method === 'PUT' && body.ngayCapNhatMongDoi !== old?.ngayCapNhat) return { status: 409, response: { detail: 'Tài khoản đã được cập nhật.' } }
    assert(!Object.hasOwn(body, 'vaiTro'))
    const { matKhau: _password, ngayCapNhatMongDoi: _expected, ...profile } = body
    const user = { ...old, ...profile, ma: old?.ma ?? 100, vaiTro: 'Student', ngayTao: old?.ngayTao ?? '2026-11-18T00:00:00Z', ngayCapNhat: '2026-11-18T01:00:00Z' }
    if (old) Object.assign(old, user); else rows.push(user)
    return { status: old ? 200 : 201, response: user }
  } }
}
export async function runAccountEditorChecks({ go, click, input, waitFor, evaluate, cdp, login, fixture, calls, errors }) {
  await go('/admin/students'); await waitFor('location.pathname === "/login"')
  await login('admin@example.com'); await waitFor('location.pathname === "/admin/overview"')
  await click('a[href="/admin/students"]'); await waitFor('document.querySelectorAll(".admin-students-table tbody tr").length === 3')
  await click('.admin-account-header button'); await waitFor('!!document.querySelector("dialog[open] .account-editor")')
  await input('managedName', 'Sinh viên mới'); await input('managedEmail', 'new@example.test'); await input('managedCode', 'SVNEW'); await input('managedPassword', 'fixture-password')
  await click('.account-editor button[type=submit]'); await waitFor('!document.querySelector("dialog[open]") && document.body.innerText.includes("Đã tạo tài khoản sinh viên.")')
  await go('/admin/students/100'); await waitFor('document.querySelector(".admin-student-summary h2")?.textContent === "Sinh viên mới"')
  await click('.admin-student-details > button.admin-detail-button'); await waitFor('!!document.querySelector("dialog[open]")')
  assert.equal(await evaluate('document.querySelector("input[name=managedPassword]") === null'), true)
  await input('managedName', 'Tên đã cập nhật')
  fixture.state.fail = true; await click('.account-editor button[type=submit]'); await waitFor('!!document.querySelector(".account-editor-error")')
  assert.equal(await evaluate('document.querySelector("input[name=managedName]").value'), 'Tên đã cập nhật')
  fixture.state.fail = false; await click('.account-editor button[type=submit]'); await waitFor('!document.querySelector("dialog[open]") && document.querySelector(".admin-student-summary h2")?.textContent === "Tên đã cập nhật"')
  await click('.admin-student-details > button.admin-detail-button'); await waitFor('!!document.querySelector("dialog[open]")')
  await input('managedEmail', '0306231307@caothang.edu.vn'); await click('.account-editor button[type=submit]'); await waitFor('document.querySelector(".account-editor-error")?.textContent.includes("Email")')
  await click('dialog .dialog-actions button:first-child'); await waitFor('!document.querySelector("dialog[open]")')
  assert(calls.filter(c => c.method === 'PUT' && c.route.includes('/admin/users/')).every(c => c.body.ngayCapNhatMongDoi && !Object.hasOwn(c.body, 'matKhau')))
  assert(!calls.some(c => c.method === 'DELETE'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await click('.admin-student-details > button.admin-detail-button'); await waitFor('!!document.querySelector("dialog[open]")')
  fs.mkdirSync('.backend-integration/screenshots', { recursive: true })
  fs.writeFileSync('.backend-integration/screenshots/admin-account-editor.png', Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await waitFor('document.documentElement.scrollWidth <= innerWidth + 1')
  assert.deepEqual(errors, [])
  console.log('PASS: account editor browser create/edit, retained input on failure, duplicate email, protected payload, password omission on edit and mobile layout.')
}
