import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const { loginErrors, serverLoginErrors, newPasswordError } = await server.ssrLoadModule('/src/auth/validation.ts')
const { loginAccount } = await server.ssrLoadModule('/src/api/auth.ts')
after(() => server.close())

test('login requires both fields and enforces length limits without changing credentials', () => {
  assert.deepEqual(Object.keys(loginErrors('', '')).sort(), ['password', 'taiKhoan'])
  assert(loginErrors('   ', '        ').taiKhoan)
  assert(loginErrors('0306000001', '        ').password)
  assert.deepEqual(loginErrors('0306000001', '1234567'), {})
  assert.deepEqual(loginErrors('0306000001', '12345678'), {})
  assert.deepEqual(loginErrors('a'.repeat(320), 'a'.repeat(128)), {})
  assert(loginErrors('a'.repeat(321), 'Test1234!').taiKhoan)
  assert(loginErrors('0306000001', 'a'.repeat(129)).password)
})

test('login accepts email dots, leading zeroes, letter identifiers and password special characters', () => {
  for (const account of ['0306000001', 'SvABC01', 'SV_01', 'AN@EXAMPLE.COM', 'first-last+tag@example.com', 'first_last@example.com', 'admin@caothang.edu.vn', ' 0306000001 ', 'SinhViên01']) {
    for (const password of ['Test1234!', ' Test!@#$%&*()_+-= ', 'Test1234!\n', 'a', "Test'\"`‘’“”", '        a']) assert.deepEqual(loginErrors(account, password), {})
  }
})

test('login rejects malformed emails, punctuation and embedded whitespace in MSSV', () => {
  for (const symbol of '+-.!#$%&/\\:;()[]{}<> =\n\t') assert(loginErrors('SV' + symbol + '001', 'Test1234!').taiKhoan)
  for (const account of ['an@', '@example.com', 'an@example', 'an@@example.com']) assert(loginErrors(account, 'Test1234!').taiKhoan)
  for (const quote of ['\'', '"', '\u0060', '‘', '’', '“', '”']) {
    assert.match(loginErrors('SV' + quote + '001', 'Test1234!').taiKhoan, /dấu nháy/)
    assert.deepEqual(loginErrors('0306000001', 'Test1234' + quote), {})
  }
})

test('login messages identify the invalid field and explain the rule', () => {
  assert.match(loginErrors('SV-01', 'Test1234!').taiKhoan, /email đúng định dạng hoặc MSSV/)
  assert.equal(loginErrors('SV 01', 'Test1234!').taiKhoan, 'Tên đăng nhập không được chứa khoảng trắng ở giữa.')
  assert.equal(loginErrors('SV01', '').password, 'Vui lòng nhập mật khẩu.')
  assert.equal(loginErrors('SV01', 'a'.repeat(129)).password, 'Mật khẩu không được dài quá 128 ký tự.')
  assert.deepEqual(serverLoginErrors({ TaiKhoan: ['Lỗi tên đăng nhập.'], MatKhau: ['Lỗi mật khẩu.'], unknown: ['Bỏ qua.'] }), { taiKhoan: 'Lỗi tên đăng nhập.', password: 'Lỗi mật khẩu.' })
  assert.deepEqual(serverLoginErrors({ taiKhoan: ['', 'Lỗi tài khoản.'], '$.matKhau': ['Lỗi mật khẩu.'] }), { taiKhoan: 'Lỗi tài khoản.', password: 'Lỗi mật khẩu.' })
})

test('login reports wrong credentials clearly while preserving lock, network and profile errors', async () => {
  const previousFetch = globalThis.fetch
  try {
    for (const body of [{ code: 'INVALID_CREDENTIALS', title: 'Thông tin xác thực không hợp lệ.' }, {}]) {
      globalThis.fetch = async () => new Response(JSON.stringify(body), { status: 401 })
      await assert.rejects(loginAccount('an@example.com', 'wrong-password'), (error) => error.message === 'Sai tài khoản hoặc mật khẩu.' && error.status === 401)
    }
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'ACCOUNT_DISABLED', title: 'Tài khoản đã bị khóa.' }), { status: 401 })
    await assert.rejects(loginAccount('an@example.com', 'Test1234!'), /đã bị khóa/)
    globalThis.fetch = async () => { throw new TypeError('offline') }
    await assert.rejects(loginAccount('an@example.com', 'Test1234!'), /Không thể kết nối/)
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture'
    const responses = [new Response(JSON.stringify({ tokenTruyCap: jwt }), { status: 200 }), new Response('{}', { status: 401 })]
    globalThis.fetch = async () => responses.shift()
    await assert.rejects(loginAccount('an@example.com', 'Test1234!'), /Phiên đăng nhập/)
  } finally { globalThis.fetch = previousFetch }
})

test('invalid direct login calls fail locally without sending a request', async () => {
  const previousFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected request') }
  try {
    for (const [account, password] of [['', ''], ['SV-01', 'Test1234!'], ['0306000001', ''], ['0306000001', 'a'.repeat(129)]]) {
      await assert.rejects(loginAccount(account, password), (error) => error.status === 400 && error.code === 'VALIDATION_ERROR')
    }
    assert.equal(calls, 0)
  } finally { globalThis.fetch = previousFetch }
})

test('new passwords require 8–128 characters and confirmation, allowing all character types', () => {
  for (const password of ['', '        ', 'a'.repeat(129), 'a'.repeat(7)]) assert(newPasswordError(password, password))
  for (const password of ['a'.repeat(8), 'a'.repeat(128), 'ABCdef12', " @#$!%&*'\"`‘’“” ", ' tám ký tự ']) assert.equal(newPasswordError(password, password), '')
  assert.match(newPasswordError('12345678', '12345679'), /không khớp/)
})
